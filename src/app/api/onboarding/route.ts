import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDeps } from "@/lib/server/deps";
import { connectRepo, isUnauthorized } from "@/lib/services/onboarding";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const name = (body as { name?: unknown } | null)?.name;
  if (typeof name !== "string") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  try {
    const result = await connectRepo(getDeps(), session.user.id, name);
    return NextResponse.json({ result });
  } catch (e) {
    if (isUnauthorized(e)) return NextResponse.json({ result: "reauth" }, { status: 401 });
    console.error("onboarding connect failed", e);
    return NextResponse.json({ result: "error" }, { status: 502 });
  }
}
