import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDeps } from "@/lib/server/deps";
import { setDisplayName } from "@/lib/services/onboarding";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const result = await setDisplayName(getDeps(), session.user.id, (body as { displayName?: unknown } | null)?.displayName);
  if (result === "invalid") return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  return NextResponse.json({ result });
}
