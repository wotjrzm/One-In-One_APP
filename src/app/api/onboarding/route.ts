import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDeps } from "@/lib/server/deps";
import { connectRepo } from "@/lib/services/onboarding";

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
  const result = await connectRepo(getDeps(), session.user.id, name);
  return NextResponse.json({ result });
}
