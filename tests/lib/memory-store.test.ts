import { beforeEach, describe, expect, it } from "vitest";
import { DuplicateCorrectError } from "@/lib/db/types";
import { MemoryStore } from "../fakes/memory-store";

const choice = { kind: "choice", choiceIndex: 1 } as const;
let store: MemoryStore;
let uid: string;
const base = () => ({
  userId: uid,
  dateKst: "2026-11-19",
  type: "ai" as const,
  problemId: "ai-1",
  payload: choice,
});

beforeEach(async () => {
  store = new MemoryStore();
  uid = (await store.upsertUser({ githubId: 1, login: "a", avatarUrl: "u", tokenEnc: "t" })).id;
});

describe("MemoryStore", () => {
  it("upsertUser updates existing github user and keeps id/repo state", async () => {
    await store.updateUser(uid, { repoName: "R", repoStatus: "ok" });
    const again = await store.upsertUser({ githubId: 1, login: "b", avatarUrl: "u2", tokenEnc: "t2" });
    expect(again.id).toBe(uid);
    expect(again.login).toBe("b");
    expect(again.tokenEnc).toBe("t2");
    expect(again.repoName).toBe("R");
    expect(again.repoStatus).toBe("ok");
    expect((await store.getUser(uid))?.login).toBe("b");
    expect(await store.getUser("nope")).toBeNull();
  });

  it("new users default to none / not hidden", async () => {
    const u = await store.getUser(uid);
    expect(u).toMatchObject({ repoName: null, repoStatus: "none", hideFromRanking: false });
  });

  it("rejects a second correct attempt for same user/date/type", async () => {
    await store.insertAttempt({ ...base(), isCorrect: true });
    await expect(store.insertAttempt({ ...base(), isCorrect: true })).rejects.toBeInstanceOf(
      DuplicateCorrectError,
    );
    await store.insertAttempt({ ...base(), isCorrect: false });
    await store.insertAttempt({ ...base(), isCorrect: false });
    // different type or date is fine
    await store.insertAttempt({ ...base(), type: "network", isCorrect: true });
    await store.insertAttempt({ ...base(), dateKst: "2026-11-20", isCorrect: true });
  });

  it("inserts as pending and markCommitted sets sha", async () => {
    const a = await store.insertAttempt({ ...base(), isCorrect: false });
    expect(a).toMatchObject({ commitStatus: "pending", commitSha: null });
    await store.markCommitted(a.id, "abc");
    const [got] = await store.listAttempts(uid);
    expect(got).toMatchObject({ commitStatus: "committed", commitSha: "abc" });
  });

  it("lists attempts by createdAt ascending with filters", async () => {
    const a1 = await store.insertAttempt({ ...base(), isCorrect: false });
    const a2 = await store.insertAttempt({ ...base(), dateKst: "2026-11-20", isCorrect: false });
    const a3 = await store.insertAttempt({ ...base(), isCorrect: false });
    await store.markCommitted(a2.id, "s");
    expect((await store.listAttempts(uid)).map((a) => a.id)).toEqual([a1.id, a2.id, a3.id]);
    expect((await store.listAttempts(uid, { dateKst: "2026-11-19" })).map((a) => a.id)).toEqual([a1.id, a3.id]);
    expect((await store.listAttempts(uid, { status: "committed" })).map((a) => a.id)).toEqual([a2.id]);
    expect(await store.listAttempts(uid, { dateKst: "2026-11-20", status: "pending" })).toEqual([]);
  });

  it("listRankingUsers returns committed attempts for users with a repo (hidden included)", async () => {
    const other = await store.upsertUser({ githubId: 2, login: "o", avatarUrl: "u", tokenEnc: "t" });
    const third = await store.upsertUser({ githubId: 3, login: "h", avatarUrl: "u", tokenEnc: "t" });
    await store.updateUser(uid, { repoName: "R", repoStatus: "ok" });
    await store.updateUser(third.id, { repoName: "R3", hideFromRanking: true });
    const done = await store.insertAttempt({ ...base(), isCorrect: true });
    await store.insertAttempt({ ...base(), type: "network", isCorrect: false }); // pending
    await store.insertAttempt({ ...base(), userId: other.id, isCorrect: true }); // no repo
    await store.markCommitted(done.id, "sha");
    const rows = await store.listRankingUsers();
    expect(rows.map((r) => r.id).sort()).toEqual([uid, third.id].sort());
    const mine = rows.find((r) => r.id === uid)!;
    expect(mine.attempts.map((a) => a.id)).toEqual([done.id]);
    expect(rows.find((r) => r.id === third.id)!.attempts).toEqual([]);
  });

  it("listUsersWithPending requires repoStatus ok and a pending attempt", async () => {
    const u2 = await store.upsertUser({ githubId: 2, login: "o", avatarUrl: "u", tokenEnc: "t" });
    await store.insertAttempt({ ...base(), isCorrect: false });
    await store.insertAttempt({ ...base(), userId: u2.id, isCorrect: false });
    expect(await store.listUsersWithPending()).toEqual([]);
    await store.updateUser(uid, { repoStatus: "ok" });
    expect(await store.listUsersWithPending()).toEqual([uid]);
    const [a] = await store.listAttempts(uid);
    await store.markCommitted(a.id, "s");
    expect(await store.listUsersWithPending()).toEqual([]);
  });
});
