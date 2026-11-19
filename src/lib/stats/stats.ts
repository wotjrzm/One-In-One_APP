import { addDays, daysBetween, weekStartKst } from "@/lib/date";
import { WRONG_COMMIT_CAP, type ProblemType } from "@/lib/types";

/** Attempt that was committed to GitHub; callers pass committed attempts only. */
export type CountedAttempt = {
  dateKst: string;
  problemId: string;
  type: ProblemType;
  isCorrect: boolean;
};

export function activeDays(a: CountedAttempt[]): Set<string> {
  return new Set(a.map((x) => x.dateKst));
}

/** Consecutive days counted back from today (or yesterday if today is empty), not before `floor`. */
function streakFrom(days: Set<string>, today: string, floor?: string): number {
  let cursor = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(cursor) && (floor === undefined || cursor >= floor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function currentStreak(days: Set<string>, today: string): number {
  return streakFrom(days, today);
}

export function weeklyStreak(days: Set<string>, today: string): number {
  return streakFrom(days, today, weekStartKst(today));
}

export function attendance30(days: Set<string>, today: string): number {
  let n = 0;
  for (const day of days) {
    const diff = daysBetween(day, today);
    if (diff >= 0 && diff <= 29) n++;
  }
  return n / 30;
}

export function countedCommits(a: CountedAttempt[]): number {
  let correct = 0;
  const wrong = new Map<string, number>();
  for (const x of a) {
    if (x.isCorrect) correct++;
    else {
      const key = `${x.dateKst}|${x.problemId}`;
      wrong.set(key, (wrong.get(key) ?? 0) + 1);
    }
  }
  let total = correct;
  for (const n of wrong.values()) total += Math.min(n, WRONG_COMMIT_CAP);
  return total;
}

/** Correct commits vs all counted commits (wrong ones capped per problem/day, same as countedCommits). */
export function accuracyCounts(a: CountedAttempt[]): { correct: number; total: number } {
  return { correct: a.filter((x) => x.isCorrect).length, total: countedCommits(a) };
}

export function inWeek(a: CountedAttempt[], today: string): CountedAttempt[] {
  const start = weekStartKst(today);
  return a.filter((x) => x.dateKst >= start && x.dateKst <= today);
}

/** `weeks*7` cells, Monday-first, ending on the Sunday of today's week. */
export function heatmap(days: Set<string>, today: string, weeks = 12): { date: string; active: boolean }[] {
  const start = addDays(weekStartKst(today), -(weeks - 1) * 7);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const date = addDays(start, i);
    return { date, active: days.has(date) };
  });
}
