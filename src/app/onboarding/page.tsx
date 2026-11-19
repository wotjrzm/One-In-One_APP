import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDeps } from "@/lib/server/deps";
import { startOnboarding } from "@/lib/services/onboarding";
import { ERROR_COPY } from "./copy";
import { ReloginButton } from "./relogin-button";
import { NameForm } from "./name-form";
import { RepoForm } from "./repo-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const start = await startOnboarding(getDeps(), session.user.id);
  if (start.kind === "done") redirect("/");

  if (start.kind === "name") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-[#1F2328]">
        <h1 className="text-xl font-bold">이름을 알려 주세요</h1>
        <p className="mt-3 text-base text-[#59636E]">
          랭킹에 GitHub 닉네임과 함께 표시돼요. 나중에 바꿀 수 없으니 신중히 정해 주세요.
        </p>
        <NameForm />
      </main>
    );
  }

  const reauth = start.kind === "relogin" || start.reason === "reauth";
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-[#1F2328]">
      <h1 className="text-xl font-bold">저장소 연결</h1>
      {reauth ? (
        <>
          <p className="mt-3 text-base text-[#59636E]">
            깃허브 연결이 만료됐거나 해제됐어요. 다시 로그인하면 이어서 연결할 수 있어요.
          </p>
          <ReloginButton primary />
        </>
      ) : (
        <>
          <p className="mt-3 text-base text-[#59636E]">
            {start.reason === "conflict"
              ? "이미 같은 이름의 저장소가 있어요. 새 이름을 정해 주세요."
              : ERROR_COPY}
          </p>
          <RepoForm defaultName={start.defaultName} />
          {start.reason === "error" && <ReloginButton primary={false} />}
        </>
      )}
    </main>
  );
}
