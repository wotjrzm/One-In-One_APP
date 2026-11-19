import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center text-[#1F2328]">
      <h1 className="text-3xl font-bold text-[#1A7F37]">One-In-One</h1>
      <p className="mt-3 text-base text-[#59636E]">
        하루에 하나, 유형별로 한 문제씩 풀고 GitHub에 기록합니다.
      </p>
      <form
        className="mt-10 w-full"
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="min-h-12 w-full rounded-lg bg-[#1A7F37] px-4 text-base font-medium text-white"
        >
          GitHub로 시작하기
        </button>
      </form>
      <p className="mt-4 text-sm text-[#59636E]">앱은 One-In-One 저장소에만 씁니다</p>
    </main>
  );
}
