import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { MemoryStore } from "../fakes/memory-store";
import { encryptToken } from "@/lib/crypto";
import { startOnboarding } from "@/lib/services/onboarding";
import type { Deps } from "@/lib/services/types";

process.env.TOKEN_ENC_KEY = randomBytes(32).toString("base64");

let store: MemoryStore;
let ensureRepo: ReturnType<typeof vi.fn>;
let deps: Deps;
let uid: string;

beforeEach(async () => {
  store = new MemoryStore();
  ensureRepo = vi.fn().mockResolvedValue("created");
  deps = {
    store,
    bank: { ai: [], network: [], "claude-code": [], "coding-test": [] },
    now: () => new Date("2026-11-19T03:00:00Z"),
    github: { commit: async () => "sha", ensureRepo: ensureRepo as Deps["github"]["ensureRepo"] },
  };
  const u = await store.upsertUser({ githubId: 1, login: "me", avatarUrl: "x", tokenEnc: encryptToken("t") });
  uid = u.id;
});

describe("startOnboarding", () => {
  it("done without touching GitHub when already connected", async () => {
    await store.updateUser(uid, { repoName: "One-In-One-2", repoStatus: "ok" });
    expect(await startOnboarding(deps, uid)).toEqual({ kind: "done" });
    expect(ensureRepo).not.toHaveBeenCalled();
  });

  it("reconnects a disconnected user to their own repo name", async () => {
    await store.updateUser(uid, { repoName: "One-In-One-2", repoStatus: "disconnected" });
    expect(await startOnboarding(deps, uid)).toEqual({ kind: "done" });
    expect(ensureRepo).toHaveBeenCalledWith("t", "me", "One-In-One-2");
  });

  it("uses the default name for a new user", async () => {
    await startOnboarding(deps, uid);
    expect(ensureRepo).toHaveBeenCalledWith("t", "me", "One-In-One");
  });

  it("returns the form on conflict", async () => {
    ensureRepo.mockResolvedValue("conflict");
    expect(await startOnboarding(deps, uid)).toEqual({
      kind: "form",
      defaultName: "One-In-One-2",
      reason: "conflict",
    });
  });

  it("returns an error form when GitHub throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    ensureRepo.mockRejectedValue(new Error("boom"));
    expect(await startOnboarding(deps, uid)).toEqual({
      kind: "form",
      defaultName: "One-In-One",
      reason: "error",
    });
  });

  it("relogin when the user is missing", async () => {
    expect(await startOnboarding(deps, "nope")).toEqual({ kind: "relogin" });
  });
});
