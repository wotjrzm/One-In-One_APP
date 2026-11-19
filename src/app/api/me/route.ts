import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDeps } from "@/lib/server/deps";

const unauthorized = () => NextResponse.json({ error: "unauthorized" }, { status: 401 });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const user = await getDeps().store.getUser(session.user.id);
  if (!user) return unauthorized();
  return NextResponse.json({
    login: user.login,
    avatarUrl: user.avatarUrl,
    repoName: user.repoName,
    repoUrl: user.repoName ? `https://github.com/${user.login}/${user.repoName}` : null,
    repoStatus: user.repoStatus,
    hideFromRanking: user.hideFromRanking,
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const hide = (body as { hideFromRanking?: unknown } | null)?.hideFromRanking;
  if (typeof hide !== "boolean") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  await getDeps().store.updateUser(session.user.id, { hideFromRanking: hide });
  return NextResponse.json({ hideFromRanking: hide });
}
