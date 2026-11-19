import { NextResponse } from "next/server";
import { getDeps } from "@/lib/server/deps";
import { retryAll } from "@/lib/services/retry";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await retryAll(getDeps());
  return NextResponse.json({ ok: true });
}
