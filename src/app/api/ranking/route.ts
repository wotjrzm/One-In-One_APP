import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toKstDate } from "@/lib/date";
import { getDeps } from "@/lib/server/deps";
import { rankUsers, type Metric, type Period } from "@/lib/stats/ranking";

const METRICS: Metric[] = ["consistency", "commits", "accuracy"];
const PERIODS: Period[] = ["week", "all"];

/** Returns all three boards (Days / Commits / Accuracy) for one period in a single response. */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const uid = session.user.id;

  const period = new URL(req.url).searchParams.get("period") ?? "week";
  if (!PERIODS.includes(period as Period)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const deps = getDeps();
  const today = toKstDate(deps.now());
  const [users, me] = await Promise.all([deps.store.listRankingUsers(), deps.store.getUser(uid)]);
  const input = users.map((u) => ({
    userId: u.id,
    login: u.login,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    repoName: u.repoName ?? "",
    hidden: u.hideFromRanking,
    attempts: u.attempts,
  }));
  const boards = Object.fromEntries(
    METRICS.map((metric) => {
      const ranked = rankUsers(input, metric, period as Period, today);
      return [metric, { rows: ranked.rows, me: ranked.me(uid) }];
    }),
  );
  return NextResponse.json({ boards, hidden: me?.hideFromRanking ?? false });
}
