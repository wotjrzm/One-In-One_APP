import { describe, expect, it } from "vitest";
import {
  activeDays,
  attendance30,
  countedCommits,
  currentStreak,
  distinctProblems,
  heatmap,
  inWeek,
  weeklyStreak,
} from "@/lib/stats/stats";

const today = "2026-11-19";
const d = (...xs: string[]) => new Set(xs);
const wrong = (n: number) =>
  Array.from({ length: n }, () => ({ dateKst: today, problemId: "network-001", type: "network" as const, isCorrect: false }));

describe("stats", () => {
  it("currentStreak", () => {
    expect(currentStreak(d("2026-11-17", "2026-11-18", "2026-11-19"), today)).toBe(3);
    expect(currentStreak(d("2026-11-17", "2026-11-18"), today)).toBe(2);
    expect(currentStreak(d("2026-11-16", "2026-11-18"), today)).toBe(1);
    expect(currentStreak(d(), today)).toBe(0);
  });

  it("weeklyStreak only counts the current week", () => {
    expect(weeklyStreak(d("2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"), today)).toBe(4);
    expect(weeklyStreak(d("2026-11-15"), "2026-11-16")).toBe(0);
  });

  it("attendance30 uses a 30-day window", () => {
    expect(attendance30(d("2026-10-20", "2026-10-21", "2026-11-19"), today)).toBeCloseTo(2 / 30);
  });

  it("countedCommits caps wrong attempts per problem per day", () => {
    expect(countedCommits([...wrong(6), { dateKst: today, problemId: "network-001", type: "network", isCorrect: true }])).toBe(5);
    expect(countedCommits(wrong(3))).toBe(3);
  });

  it("distinctProblems", () => {
    expect(distinctProblems([...wrong(3), { dateKst: today, problemId: "ai-001", type: "ai", isCorrect: true }])).toBe(2);
  });

  it("counts retried attempts by submission date", () => {
    const a = [
      { dateKst: "2026-11-18", problemId: "ai-001", type: "ai" as const, isCorrect: false },
      { dateKst: "2026-11-19", problemId: "ai-002", type: "ai" as const, isCorrect: true },
    ];
    expect(currentStreak(activeDays(a), today)).toBe(2);
  });

  it("inWeek filters to this week up to today", () => {
    const mk = (dateKst: string) => ({ dateKst, problemId: "x", type: "ai" as const, isCorrect: true });
    const r = inWeek([mk("2026-11-15"), mk("2026-11-16"), mk(today), mk("2026-11-20")], today);
    expect(r.map((x) => x.dateKst)).toEqual(["2026-11-16", today]);
  });

  it("heatmap", () => {
    expect(heatmap(d(today), today)).toHaveLength(84);
    expect(heatmap(d(today), today).at(-4)).toEqual({ date: today, active: true });
    expect(heatmap(d(today), today)[0].date).toBe("2026-08-31");
  });
});
