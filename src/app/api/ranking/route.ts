import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toKstDate } from "@/lib/date";
import { getDeps } from "@/lib/server/deps";
import { rankUsers, type Metric, type Period } from "@/lib/stats/ranking";

const METRICS: Metric[] = ["consistency", "problems", "commits"];
const PERIODS: Period[] = ["week", "all"];

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const uid = session.user.id;

  const params = new URL(req.url).searchParams;
  const metric = params.get("metric") ?? "consistency";
  const period = params.get("period") ?? "week";
  if (!METRICS.includes(metric as Metric) || !PERIODS.includes(period as Period)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const deps = getDeps();
  const today = toKstDate(deps.now());
  const [users, me] = await Promise.all([deps.store.listRankingUsers(), deps.store.getUser(uid)]);
  const ranked = rankUsers(
    users.map((u) => ({
      userId: u.id,
      login: u.login,
      avatarUrl: u.avatarUrl,
      repoName: u.repoName ?? "",
      hidden: u.hideFromRanking,
      attempts: u.attempts,
    })),
    metric as Metric,
    period as Period,
    today,
  );
  return NextResponse.json({
    rows: ranked.rows,
    me: ranked.me(uid),
    hidden: me?.hideFromRanking ?? false,
  });
}
