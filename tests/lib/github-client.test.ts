import { describe, expect, it } from "vitest";
import { Octokit } from "@octokit/rest";
import { buildCommit, type Commit } from "@/lib/github/files";
import { RepoAccessError, commitFiles, ensureRepo, octokitFor } from "@/lib/github/client";
import type { ChoiceProblem } from "@/lib/problems/schema";

const problem: ChoiceProblem = {
  id: "network-001",
  type: "network",
  title: "t",
  prompt: "p",
  choices: ["a", "b", "c", "d"],
  answerIndex: 0,
  explanation: "e",
  reviewed: true,
};

const c: Commit = buildCommit({
  dateKst: "2026-11-19",
  problem,
  input: { kind: "choice", choiceIndex: 2 },
  isCorrect: false,
});

type Calls = { method: string; url: string; opts: Record<string, unknown> }[];

/** Real Octokit whose HTTP layer is replaced: listed route templates fail with the given status. */
function ghWith(overrides: Record<string, number | number[]>, calls: Calls = []): Octokit {
  const gh = new Octokit();
  gh.hook.wrap("request", async (_request, options) => {
    const route = `${options.method} ${options.url}`;
    calls.push({ method: options.method, url: options.url, opts: options as Record<string, unknown> });
    const o = overrides[route];
    const status = Array.isArray(o) ? o.shift() : o;
    if (status) throw Object.assign(new Error(`HTTP ${status}`), { status });
    const ok = (data: unknown, s = 200) => ({ status: s, headers: {}, url: options.url, data });
    switch (route) {
      case "GET /repos/{owner}/{repo}":
        return ok({ default_branch: "main" });
      case "GET /repos/{owner}/{repo}/contents/{path}":
        return ok({ type: "file" });
      case "POST /user/repos":
        return ok({ name: "One-In-One" }, 201);
      case "PUT /repos/{owner}/{repo}/contents/{path}":
        return ok({ content: {} }, 201);
      case "GET /repos/{owner}/{repo}/git/ref/{ref}":
        return ok({ object: { sha: "headsha" } });
      case "GET /repos/{owner}/{repo}/git/commits/{commit_sha}":
        return ok({ tree: { sha: "treesha" } });
      case "POST /repos/{owner}/{repo}/git/trees":
        return ok({ sha: "newtree" }, 201);
      case "POST /repos/{owner}/{repo}/git/commits":
        return ok({ sha: "newcommit" }, 201);
      case "PATCH /repos/{owner}/{repo}/git/refs/{ref}":
        return ok({ object: { sha: "newcommit" } });
      default:
        throw new Error(`unexpected route ${route}`);
    }
  });
  return gh;
}

describe("ensureRepo", () => {
  it("creates the repo and marker file when the repo is missing", async () => {
    const calls: Calls = [];
    await expect(
      ensureRepo(ghWith({ "GET /repos/{owner}/{repo}": 404 }, calls), "u", "One-In-One"),
    ).resolves.toBe("created");
    const routes = calls.map((x) => `${x.method} ${x.url}`);
    expect(routes).toContain("POST /user/repos");
    expect(routes).toContain("PUT /repos/{owner}/{repo}/contents/{path}");
  });

  it("creates with the expected payload and retries the marker write on 404/409", async () => {
    const calls: Calls = [];
    const gh = ghWith(
      { "GET /repos/{owner}/{repo}": 404, "PUT /repos/{owner}/{repo}/contents/{path}": [409, 409] },
      calls,
    );
    await expect(ensureRepo(gh, "u", "One-In-One", async () => {})).resolves.toBe("created");
    const create = calls.find((x) => x.url === "/user/repos")!;
    expect(create.opts).toMatchObject({
      name: "One-In-One",
      private: false,
      auto_init: false,
      description: "1일 1학습 기록 (One-In-One)",
    });
    const puts = calls.filter((x) => x.method === "PUT");
    expect(puts).toHaveLength(3);
    expect(puts[2].opts).toMatchObject({ path: ".one-in-one" });
  });

  it("gives up after 5 marker attempts and rethrows", async () => {
    const calls: Calls = [];
    const gh = ghWith(
      { "GET /repos/{owner}/{repo}": 404, "PUT /repos/{owner}/{repo}/contents/{path}": [409, 409, 409, 409, 409] },
      calls,
    );
    await expect(ensureRepo(gh, "u", "One-In-One", async () => {})).rejects.toMatchObject({ status: 409 });
    expect(calls.filter((x) => x.method === "PUT")).toHaveLength(5);
  });

  it("reports conflict when the repo exists without the marker", async () => {
    await expect(
      ensureRepo(ghWith({ "GET /repos/{owner}/{repo}/contents/{path}": 404 }), "u", "One-In-One"),
    ).resolves.toBe("conflict");
  });

  it("reports existing when the marker exists", async () => {
    await expect(ensureRepo(ghWith({}), "u", "One-In-One")).resolves.toBe("existing");
  });

  it("rethrows unexpected errors", async () => {
    await expect(
      ensureRepo(ghWith({ "GET /repos/{owner}/{repo}": 500 }), "u", "One-In-One"),
    ).rejects.toMatchObject({ status: 500 });
  });
});

describe("commitFiles", () => {
  it("writes one commit through the git data API and returns its sha", async () => {
    const calls: Calls = [];
    await expect(commitFiles(ghWith({}, calls), "u", "r", c)).resolves.toBe("newcommit");
    expect(calls.map((x) => `${x.method} ${x.url}`)).toEqual([
      "GET /repos/{owner}/{repo}",
      "GET /repos/{owner}/{repo}/git/ref/{ref}",
      "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
      "POST /repos/{owner}/{repo}/git/trees",
      "POST /repos/{owner}/{repo}/git/commits",
      "PATCH /repos/{owner}/{repo}/git/refs/{ref}",
    ]);
  });

  it.each([401, 403, 404])("maps %i at the ref step to RepoAccessError", async (status) => {
    await expect(
      commitFiles(ghWith({ "GET /repos/{owner}/{repo}/git/ref/{ref}": status }), "u", "r", c),
    ).rejects.toBeInstanceOf(RepoAccessError);
  });

  it("maps access errors at the repo step too", async () => {
    await expect(
      commitFiles(ghWith({ "GET /repos/{owner}/{repo}": 403 }), "u", "r", c),
    ).rejects.toBeInstanceOf(RepoAccessError);
  });

  it("rethrows other errors unchanged", async () => {
    const p = commitFiles(ghWith({ "POST /repos/{owner}/{repo}/git/trees": 500 }), "u", "r", c);
    await expect(p).rejects.not.toBeInstanceOf(RepoAccessError);
    await expect(p).rejects.toMatchObject({ status: 500 });
  });
});

describe("octokitFor", () => {
  it("returns an Octokit instance", () => {
    expect(octokitFor("tok")).toBeInstanceOf(Octokit);
  });
});
