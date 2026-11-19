import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { MemoryStore } from "../fakes/memory-store";
import { encryptToken } from "@/lib/crypto";
import type { ChoiceProblem, Problem } from "@/lib/problems/schema";
import type { ProblemType } from "@/lib/types";
import type { Deps } from "@/lib/services/types";

process.env.TOKEN_ENC_KEY = randomBytes(32).toString("base64");

const authMock = vi.fn();
const depsMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/server/deps", () => ({ getDeps: () => depsMock() }));

import { POST } from "@/app/api/submit/route";

function choice(type: ChoiceProblem["type"]): ChoiceProblem {
  return {
    id: `${type}-001`,
    type,
    title: type,
    prompt: "q",
    choices: ["a", "b", "c", "d"],
    answerIndex: 1,
    explanation: "exp",
    reviewed: true,
  };
}
const bank = {
  ai: [choice("ai")],
  network: [choice("network")],
  "claude-code": [choice("claude-code")],
  "coding-test": [],
} as unknown as Record<ProblemType, Problem[]>;

const req = (body: unknown) =>
  new Request("http://localhost/api/submit", { method: "POST", body: JSON.stringify(body) });
const choiceInput = { kind: "choice", choiceIndex: 0 };

beforeEach(async () => {
  const store = new MemoryStore();
  const u = await store.upsertUser({
    githubId: 1,
    login: "me",
    avatarUrl: "x",
    tokenEnc: encryptToken("tok"),
  });
  await store.updateUser(u.id, { repoName: "One-In-One", repoStatus: "ok" });
  const deps: Deps = {
    store,
    bank,
    now: () => new Date("2026-11-19T03:00:00Z"),
    github: { commit: async () => "sha1", ensureRepo: async () => "created" },
  };
  depsMock.mockReturnValue(deps);
  authMock.mockResolvedValue({ user: { id: u.id, login: "me", image: "x" } });
});

describe("POST /api/submit", () => {
  it("401 without a session", async () => {
    authMock.mockResolvedValue(null);
    expect((await POST(req({}))).status).toBe(401);
  });

  it("400 for unknown type or malformed body", async () => {
    const res = await POST(req({ type: "nope", problemId: "x", input: choiceInput }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
    expect((await POST(req({ type: "network" }))).status).toBe(400);
    const bad = new Request("http://localhost/api/submit", { method: "POST", body: "{" });
    expect((await POST(bad)).status).toBe(400);
  });

  it("409 date_changed when the problem is not today's", async () => {
    const res = await POST(req({ type: "network", problemId: "not-today", input: choiceInput }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "date_changed" });
  });

  it("200 with the result on success", async () => {
    const res = await POST(req({ type: "network", problemId: "network-001", input: choiceInput }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isCorrect).toBe(false);
    expect(body.commit.status).toBe("committed");
  });
});
