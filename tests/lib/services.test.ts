import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { MemoryStore } from "../fakes/memory-store";
import { encryptToken } from "@/lib/crypto";
import { RepoAccessError } from "@/lib/github/client";
import { getDailyProblem } from "@/lib/problems/bank";
import type { ChoiceProblem, CodingProblem, Problem } from "@/lib/problems/schema";
import type { ProblemType } from "@/lib/types";
import { submit, getExplanation } from "@/lib/services/submit";
import { retryPending, retryAll } from "@/lib/services/retry";
import { connectRepo } from "@/lib/services/onboarding";
import type { Deps } from "@/lib/services/types";

process.env.TOKEN_ENC_KEY = randomBytes(32).toString("base64");

const TODAY = "2026-11-19";
const YESTERDAY = "2026-11-18";

// Two reviewed problems per type so consecutive days map to different problems.
function choice(type: ChoiceProblem["type"], n: number): ChoiceProblem {
  return {
    id: `${type}-00${n}`,
    type,
    title: `${type} ${n}`,
    prompt: "q",
    choices: ["a", "b", "c", "d"],
    answerIndex: (n % 4) as 0 | 1 | 2 | 3,
    explanation: `exp ${type} ${n}`,
    reviewed: true,
  };
}
function code(n: number): CodingProblem {
  return {
    id: `coding-test-00${n}`,
    type: "coding-test",
    title: `code ${n}`,
    prompt: "q",
    examples: [],
    starterCode: "def f(x):\n    pass\n",
    functionName: "f",
    tests: [{ args: [1], expected: 1 }],
    explanation: `exp code ${n}`,
    reviewed: true,
  };
}
const bank: Record<ProblemType, Problem[]> = {
  ai: [choice("ai", 1), choice("ai", 2)],
  network: [choice("network", 1), choice("network", 2)],
  "claude-code": [choice("claude-code", 1), choice("claude-code", 2)],
  "coding-test": [code(1), code(2)],
};

const validCode = () => ({
  kind: "code" as const,
  code: "def f(x):\n    return x\n",
  passed: true,
  results: [{ passed: true }],
});

describe("services", () => {
  let store: MemoryStore;
  let deps: Deps;
  let uid: string;
  let github: Deps["github"];
  const todays = (t: ProblemType) => getDailyProblem(bank, t, TODAY)!;
  const net = () => todays("network") as ChoiceProblem;
  const pick = (t: ProblemType, i = 0) => ({
    type: t,
    problemId: todays(t).id,
    input: { kind: "choice" as const, choiceIndex: i },
  });

  let errSpy: ReturnType<typeof vi.spyOn>;
  afterEach(() => errSpy.mockRestore());

  beforeEach(async () => {
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    store = new MemoryStore();
    github = {
      commit: async () => "sha123",
      ensureRepo: async () => "created",
    };
    deps = { store, bank, now: () => new Date("2026-11-19T01:00:00Z"), github };
    const u = await store.upsertUser({
      githubId: 1,
      login: "octo",
      avatarUrl: "",
      tokenEnc: encryptToken("tok"),
    });
    uid = u.id;
    await store.updateUser(uid, { repoName: "One-In-One", repoStatus: "ok" });
  });

  it("test bank maps today and yesterday to different problems", () => {
    expect(getDailyProblem(bank, "network", YESTERDAY)!.id).not.toBe(net().id);
  });

  it("submit: correct commits, then rejects duplicates, stale dates and empty submissions", async () => {
    const yesterdays = getDailyProblem(bank, "network", YESTERDAY)!;
    const c = todays("coding-test") as CodingProblem;
    expect(await submit(deps, uid, pick("network", net().answerIndex))).toMatchObject({
      ok: true,
      isCorrect: true,
      commit: { status: "committed", url: "https://github.com/octo/One-In-One/commit/sha123" },
    });
    expect(await submit(deps, uid, pick("network", 0))).toMatchObject({
      ok: false,
      status: 409,
      error: "already_solved",
    });
    expect(
      await submit(deps, uid, { ...pick("network", 0), problemId: yesterdays.id }),
    ).toMatchObject({ ok: false, status: 409, error: "date_changed" });
    expect(
      await submit(deps, uid, {
        type: "coding-test",
        problemId: c.id,
        input: { kind: "code", code: c.starterCode, passed: false, results: [] },
      }),
    ).toMatchObject({ ok: false, status: 400, error: "empty" });
    expect(await store.listAttempts(uid)).toHaveLength(1);
  });

  it("submit: no problem for the type -> 404", async () => {
    const d = { ...deps, bank: { ...bank, ai: [] } };
    expect(
      await submit(d, uid, { type: "ai", problemId: "ai-001", input: { kind: "choice", choiceIndex: 0 } }),
    ).toMatchObject({ ok: false, status: 404, error: "no_problem" });
  });

  it("submit: wrong answer is recorded and result never leaks explanation or answer", async () => {
    const r = await submit(deps, uid, pick("network", (net().answerIndex + 1) % 4));
    expect(r).toMatchObject({ ok: true, isCorrect: false });
    expect(r).not.toHaveProperty("explanation");
    expect(r).not.toHaveProperty("answerIndex");
    expect(JSON.stringify(r)).not.toContain("exp network");
  });

  it("getExplanation: 403 before attempt, 404 without problem, answer after attempt", async () => {
    await submit(deps, uid, pick("network", 0));
    expect(await getExplanation(deps, uid, "claude-code")).toEqual({ ok: false, status: 403 });
    expect(await getExplanation(deps, uid, "network")).toMatchObject({
      ok: true,
      answerIndex: net().answerIndex,
    });
    expect(await getExplanation({ ...deps, bank: { ...bank, ai: [] } }, uid, "ai")).toEqual({
      ok: false,
      status: 404,
    });
  });

  it("getExplanation: coding problem has no answerIndex; pending attempt still unlocks", async () => {
    github.commit = () => Promise.reject(new Error("502"));
    const c = todays("coding-test") as CodingProblem;
    await submit(deps, uid, { type: "coding-test", problemId: c.id, input: validCode() });
    const r = await getExplanation(deps, uid, "coding-test");
    expect(r).toMatchObject({ ok: true, explanation: c.explanation });
    expect(r).not.toHaveProperty("answerIndex");
  });

  it("transient commit failure -> pending; retry next day keeps the submission date", async () => {
    let fail = true;
    github.commit = async () => {
      if (fail) {
        fail = false;
        throw new Error("502");
      }
      return "sha-retry";
    };
    const r = await submit(deps, uid, pick("ai", (todays("ai") as ChoiceProblem).answerIndex));
    expect(r).toMatchObject({ ok: true, commit: { status: "pending" } });
    expect((await store.getUser(uid))!.repoStatus).toBe("ok");
    deps.now = () => new Date("2026-11-20T01:00:00Z");
    expect(await retryPending(deps, uid)).toEqual({ committed: 1, stopped: false });
    const a = (await store.listAttempts(uid, { status: "committed" })).find((x) => x.type === "ai")!;
    expect(a.dateKst).toBe(TODAY);
    expect(a.commitSha).toBe("sha-retry");
  });

  it("revoked access -> disconnected, later submits get 412", async () => {
    github.commit = () => Promise.reject(new RepoAccessError("401"));
    const r = await submit(deps, uid, pick("claude-code", 0));
    expect(r).toMatchObject({ ok: true, commit: { status: "pending" } });
    expect((await store.getUser(uid))!.repoStatus).toBe("disconnected");
    expect(await store.listAttempts(uid, { status: "pending" })).toHaveLength(1);
    const c = todays("coding-test") as CodingProblem;
    expect(
      await submit(deps, uid, { type: "coding-test", problemId: c.id, input: validCode() }),
    ).toMatchObject({ ok: false, status: 412 });
    expect(await store.listAttempts(uid)).toHaveLength(1);
  });

  it("retryPending: oldest first, stops on access error, skips unknown problems", async () => {
    github.commit = () => Promise.reject(new Error("502"));
    // oldest: an attempt whose problem is gone from the bank (skipped, stays pending)
    await store.insertAttempt({
      userId: uid,
      dateKst: YESTERDAY,
      type: "ai",
      problemId: "ai-999",
      isCorrect: false,
      payload: { kind: "choice", choiceIndex: 0 },
    });
    for (const t of ["ai", "network", "claude-code"] as const) {
      await submit(deps, uid, pick(t, (todays(t) as ChoiceProblem).answerIndex === 0 ? 1 : 0));
    }
    const order: string[] = [];
    github.commit = async (_t, _o, _r, c) => {
      order.push(c.message);
      if (order.length === 2) throw new RepoAccessError("401");
      return "s";
    };
    expect(await retryPending(deps, uid)).toEqual({ committed: 1, stopped: true });
    expect(order).toEqual([`${TODAY} ai: wrong`, `${TODAY} network: wrong`]);
    expect((await store.getUser(uid))!.repoStatus).toBe("disconnected");
    expect(await retryPending(deps, uid)).toEqual({ committed: 0, stopped: false });
  });

  it("retryPending: non-access error leaves that attempt and continues", async () => {
    github.commit = () => Promise.reject(new Error("502"));
    for (const t of ["ai", "network"] as const) await submit(deps, uid, pick(t, 0));
    let n = 0;
    github.commit = async () => {
      if (n++ === 0) throw new Error("boom");
      return "s";
    };
    expect(await retryPending(deps, uid)).toEqual({ committed: 1, stopped: false });
    expect(await store.listAttempts(uid, { status: "pending" })).toHaveLength(1);
  });

  it("retryAll retries every user with pending attempts", async () => {
    github.commit = () => Promise.reject(new Error("502"));
    await submit(deps, uid, pick("ai", 0));
    github.commit = async () => "s";
    await retryAll(deps);
    expect(await store.listAttempts(uid, { status: "pending" })).toHaveLength(0);
  });

  it("connectRepo: validates name, reports conflict, connects and flushes pending", async () => {
    expect(await connectRepo(deps, uid, "bad name")).toBe("invalid");
    github.ensureRepo = async () => "conflict";
    expect(await connectRepo(deps, uid, "One-In-One")).toBe("conflict");

    await store.updateUser(uid, { repoName: null, repoStatus: "none" });
    await store.insertAttempt({
      userId: uid,
      dateKst: TODAY,
      type: "ai",
      problemId: todays("ai").id,
      isCorrect: false,
      payload: { kind: "choice", choiceIndex: 0 },
    });
    github.ensureRepo = async () => "existing";
    expect(await connectRepo(deps, uid, "One-In-One-2")).toBe("ok");
    expect(await store.getUser(uid)).toMatchObject({ repoName: "One-In-One-2", repoStatus: "ok" });
    expect(await store.listAttempts(uid, { status: "pending" })).toHaveLength(0);
  });

  it("connectRepo rejects dot-only names", async () => {
    expect(await connectRepo(deps, uid, ".")).toBe("invalid");
    expect(await connectRepo(deps, uid, "..")).toBe("invalid");
  });

  it("retryAll: one user's failure does not block later users", async () => {
    const s = new MemoryStore();
    const bad = await s.upsertUser({ githubId: 10, login: "bad", avatarUrl: "", tokenEnc: "corrupt" });
    const good = await s.upsertUser({ githubId: 11, login: "good", avatarUrl: "", tokenEnc: encryptToken("tok") });
    for (const u of [bad, good]) {
      await s.updateUser(u.id, { repoName: "R", repoStatus: "ok" });
      await s.insertAttempt({ userId: u.id, dateKst: TODAY, type: "ai", problemId: todays("ai").id, isCorrect: false, payload: { kind: "choice", choiceIndex: 0 } });
    }
    await retryAll({ ...deps, store: s });
    expect(await s.listAttempts(good.id, { status: "committed" })).toHaveLength(1);
    expect(await s.listAttempts(bad.id, { status: "pending" })).toHaveLength(1);
    expect(errSpy).toHaveBeenCalled();
  });

  it("submit: non-access commit error is logged and stays pending", async () => {
    github.commit = () => Promise.reject(new Error("502"));
    await submit(deps, uid, pick("ai", 0));
    expect(errSpy).toHaveBeenCalled();
  });

  it("submit: markCommitted failure propagates instead of being reported as pending", async () => {
    store.markCommitted = () => Promise.reject(new Error("db down"));
    await expect(submit(deps, uid, pick("ai", 0))).rejects.toThrow("db down");
  });

  it("retryPending: markCommitted failure is logged and processing continues", async () => {
    github.commit = () => Promise.reject(new Error("502"));
    for (const t of ["ai", "network"] as const) await submit(deps, uid, pick(t, 0));
    github.commit = async () => "s";
    const orig = store.markCommitted.bind(store);
    let n = 0;
    store.markCommitted = async (id, sha) => {
      if (n++ === 0) throw new Error("db down");
      return orig(id, sha);
    };
    expect(await retryPending(deps, uid)).toEqual({ committed: 1, stopped: false });
    expect(errSpy).toHaveBeenCalled();
  });
});
