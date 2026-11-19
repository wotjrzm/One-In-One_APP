import { describe, expect, it } from "vitest";
import { rankUsers, type RankUser } from "@/lib/stats/ranking";

const today = "2026-11-19";
const at = (dateKst: string, problemId = "ai-001") => ({ dateKst, problemId, type: "ai" as const, isCorrect: true });
const user = (login: string, attempts: RankUser["attempts"], hidden = false): RankUser => ({
  userId: `id-${login}`, login, displayName: null, avatarUrl: `https://a/${login}`, repoName: "One-In-One", hidden, attempts,
});

const a = user("a", [at("2026-11-17"), at("2026-11-18"), at("2026-11-19")]);
const b = user("b", [at("2026-11-10"), at("2026-11-17"), at("2026-11-18"), at("2026-11-19")]);
const c = user("c", [at("2026-11-19")], true);
const z = user("z", []);
const p1 = user("p1", [at(today, "ai-001"), at(today, "ai-002")]);
const p2 = user("p2", [at(today, "ai-003"), at(today, "ai-004")]);

describe("rankUsers", () => {
  it("consistency/all", () => {
    const { rows, me } = rankUsers([a, b, c, z], "consistency", "all", today);
    expect(rows.map((r) => r.login)).toEqual(["b", "a", "z"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(me(c.userId)).toBeNull();
    expect(me(a.userId)!.rank).toBe(2);
    expect(rows[0].repoUrl).toBe(`https://github.com/b/${b.repoName}`);
    expect(rows[0].primary).toBe(3);
    expect(rows[0].secondary).toBe(Math.round((4 / 30) * 100));
  });

  it("ties share rank, ordered by login", () => {
    expect(rankUsers([p2, p1], "problems", "all", today).rows.map((r) => [r.login, r.rank])).toEqual([
      ["p1", 1],
      ["p2", 1],
    ]);
  });

  it("standard competition ranking (1,1,3)", () => {
    const rows = rankUsers([p1, p2, a], "problems", "all", today).rows;
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("week period filters attempts; consistency/week has null secondary", () => {
    const old = user("old", [at("2026-11-02"), at("2026-11-03")]);
    const r = rankUsers([old, a], "commits", "week", today).rows;
    expect(r.map((x) => [x.login, x.primary])).toEqual([["a", 3], ["old", 0]]);
    expect(rankUsers([a], "consistency", "week", today).rows[0].secondary).toBeNull();
    expect(rankUsers([a], "commits", "all", today).rows[0].secondary).toBeNull();
  });
});

describe("rankUsers displayName", () => {
  it("passes the chosen display name through next to the login", () => {
    const named = { ...user("octo", [at(today)]), displayName: "옥토" };
    const { rows } = rankUsers([named, user("plain", [])], "commits", "all", today);
    expect(rows.find((r) => r.login === "octo")?.displayName).toBe("옥토");
    expect(rows.find((r) => r.login === "plain")?.displayName).toBeNull();
  });
});

describe("rankUsers accuracy", () => {
  const w = (dateKst: string, problemId: string) => ({ dateKst, problemId, type: "ai" as const, isCorrect: false });
  const hit = at(today, "ai-001");

  it("ranks by correct / counted commits and shows the counts", () => {
    const sharp = user("sharp", [at(today, "ai-001"), at(today, "ai-002")]); // 2/2
    const half = user("half", [at(today, "ai-001"), w(today, "ai-002")]); // 1/2
    const { rows } = rankUsers([half, sharp], "accuracy", "all", today);
    expect(rows.map((r) => [r.login, r.rank, r.primary, r.secondary, r.total])).toEqual([
      ["sharp", 1, 100, 2, 2],
      ["half", 2, 50, 1, 2],
    ]);
  });

  it("wrong attempts per problem/day are capped at 4 like the commit count", () => {
    const spam = user("spam", [hit, ...Array.from({ length: 9 }, () => w(today, "ai-002"))]);
    const r = rankUsers([spam], "accuracy", "all", today).rows[0];
    expect([r.secondary, r.total]).toEqual([1, 5]);
  });

  it("equal percentage: more counted commits ranks higher", () => {
    const big = user("big", [at(today, "ai-001"), at(today, "ai-002")]);
    const small = user("small", [at(today, "ai-003")]);
    expect(rankUsers([small, big], "accuracy", "all", today).rows.map((r) => r.login)).toEqual(["big", "small"]);
  });

  it("users with no counted commits (and hidden users) are left out; week period filters", () => {
    const hidden = user("hid", [hit], true);
    const old = user("old", [at("2026-11-02", "ai-009")]);
    expect(rankUsers([z, hidden], "accuracy", "all", today).rows).toEqual([]);
    expect(rankUsers([old, a], "accuracy", "week", today).rows.map((r) => r.login)).toEqual(["a"]);
  });

  it("other boards keep total null", () => {
    expect(rankUsers([a], "commits", "all", today).rows[0].total).toBeNull();
  });
});
