import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDeps } from "@/lib/server/deps";
import { startOnboarding } from "@/lib/services/onboarding";
import { ERROR_COPY } from "./copy";
import { RepoForm } from "./repo-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const start = await startOnboarding(getDeps(), session.user.id);
  if (start.kind === "done") redirect("/");
  if (start.kind === "relogin") redirect("/login");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-[#1F2328]">
      <h1 className="text-xl font-bold">저장소 연결</h1>
      <p className="mt-3 text-base text-[#59636E]">
        {start.reason === "conflict"
          ? "이미 같은 이름의 저장소가 있어요. 새 이름을 정해 주세요."
          : ERROR_COPY}
      </p>
      <RepoForm defaultName={start.defaultName} />
      {start.reason === "error" && (
        <Link href="/login" className="mt-4 flex min-h-11 items-center text-sm text-[#1A7F37] underline">
          다시 로그인
        </Link>
      )}
    </main>
  );
}
