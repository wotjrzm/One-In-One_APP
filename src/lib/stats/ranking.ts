import {
  activeDays,
  attendance30,
  countedCommits,
  currentStreak,
  distinctProblems,
  inWeek,
  weeklyStreak,
  type CountedAttempt,
} from "@/lib/stats/stats";

export type Metric = "consistency" | "problems" | "commits";
export type Period = "week" | "all";

export type RankUser = {
  userId: string;
  login: string;
  avatarUrl: string;
  repoName: string;
  hidden: boolean;
  attempts: CountedAttempt[];
};

export type RankRow = {
  rank: number;
  userId: string;
  login: string;
  avatarUrl: string;
  repoUrl: string;
  primary: number;
  secondary: number | null;
};

type Scored = { user: RankUser; keys: number[]; primary: number; secondary: number | null };

function score(u: RankUser, metric: Metric, period: Period, today: string): Scored {
  if (metric === "consistency") {
    const days = activeDays(u.attempts);
    const streak = currentStreak(days, today);
    if (period === "all") {
      const att = attendance30(days, today);
      return { user: u, keys: [streak, att], primary: streak, secondary: Math.round(att * 100) };
    }
    const weekly = weeklyStreak(days, today);
    return { user: u, keys: [weekly, streak], primary: weekly, secondary: null };
  }
  const scoped = period === "week" ? inWeek(u.attempts, today) : u.attempts;
  const value = metric === "problems" ? distinctProblems(scoped) : countedCommits(scoped);
  return { user: u, keys: [value], primary: value, secondary: null };
}

function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
  return 0;
}

export function rankUsers(
  users: RankUser[],
  metric: Metric,
  period: Period,
  today: string,
): { rows: RankRow[]; me: (userId: string) => RankRow | null } {
  const scored = users
    .filter((u) => !u.hidden)
    .map((u) => score(u, metric, period, today))
    .sort((x, y) => compareKeys(x.keys, y.keys) || (x.user.login < y.user.login ? -1 : x.user.login > y.user.login ? 1 : 0));

  const rows: RankRow[] = scored.map((s, i) => {
    const tied = i > 0 && compareKeys(scored[i - 1].keys, s.keys) === 0;
    return {
      rank: tied ? 0 : i + 1,
      userId: s.user.userId,
      login: s.user.login,
      avatarUrl: s.user.avatarUrl,
      repoUrl: `https://github.com/${s.user.login}/${s.user.repoName}`,
      primary: s.primary,
      secondary: s.secondary,
    };
  });
  for (let i = 1; i < rows.length; i++) if (rows[i].rank === 0) rows[i].rank = rows[i - 1].rank;

  const byId = new Map(rows.map((r) => [r.userId, r]));
  return { rows, me: (userId) => byId.get(userId) ?? null };
}
