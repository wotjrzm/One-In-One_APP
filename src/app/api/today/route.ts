import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toKstDate } from "@/lib/date";
import { getDailyProblem, toPublicProblem } from "@/lib/problems/bank";
import { getDeps } from "@/lib/server/deps";
import { retryPending } from "@/lib/services/retry";
import { activeDays, currentStreak, heatmap } from "@/lib/stats/stats";
import { PROBLEM_TYPES, TYPE_LABELS } from "@/lib/types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const uid = session.user.id;
  const deps = getDeps();

  try {
    await retryPending(deps, uid);
  } catch (e) {
    console.error(`retryPending failed for user ${uid}`, e);
  }

  const user = await deps.store.getUser(uid);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const date = toKstDate(deps.now());
  const todays = await deps.store.listAttempts(uid, { dateKst: date });
  const committed = await deps.store.listAttempts(uid, { status: "committed" });
  const days = activeDays(committed);

  const items = PROBLEM_TYPES.map((type) => {
    const problem = getDailyProblem(deps.bank, type, date);
    const mine = todays.filter((a) => a.type === type);
    const status = mine.some((a) => a.isCorrect) ? "correct" : mine.length > 0 ? "wrong" : "none";
    return {
      type,
      label: TYPE_LABELS[type],
      problem: problem ? toPublicProblem(problem) : null,
      status,
    };
  });

  return NextResponse.json({
    date,
    items,
    streak: currentStreak(days, date),
    heatmap: heatmap(days, date),
    repo: { name: user.repoName, status: user.repoStatus },
  });
}
