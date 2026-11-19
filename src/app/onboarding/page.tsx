import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDeps } from "@/lib/server/deps";
import { connectRepo } from "@/lib/services/onboarding";
import { DEFAULT_REPO, FALLBACK_REPO } from "@/lib/types";
import { RepoForm } from "./repo-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const result = await connectRepo(getDeps(), session.user.id, DEFAULT_REPO);
  if (result === "ok") redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-[#1F2328]">
      <h1 className="text-xl font-bold">저장소 연결</h1>
      <p className="mt-3 text-base text-[#59636E]">
        이미 같은 이름의 저장소가 있어요. 새 이름을 정해 주세요.
      </p>
      <RepoForm defaultName={FALLBACK_REPO} />
    </main>
  );
}
