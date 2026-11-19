import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDeps } from "@/lib/server/deps";
import { getExplanation } from "@/lib/services/submit";
import { PROBLEM_TYPES, type ProblemType } from "@/lib/types";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const type = new URL(req.url).searchParams.get("type");
  if (!PROBLEM_TYPES.includes(type as ProblemType)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const result = await getExplanation(getDeps(), session.user.id, type as ProblemType);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.status === 403 ? "forbidden" : "no_problem" },
      { status: result.status },
    );
  }
  const { ok: _ok, ...rest } = result;
  void _ok;
  return NextResponse.json(rest);
}
