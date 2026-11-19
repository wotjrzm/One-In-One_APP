import { signIn } from "@/auth";

/** Forces a fresh GitHub OAuth round trip (the jwt callback stores the new token), then returns to onboarding. */
export function ReloginButton({ primary }: { primary: boolean }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("github", { redirectTo: "/onboarding" });
      }}
    >
      <button
        type="submit"
        className={
          primary
            ? "mt-6 min-h-12 w-full rounded-lg bg-[#1A7F37] px-4 text-base font-medium text-white"
            : "mt-4 flex min-h-11 items-center text-sm text-[#1A7F37] underline"
        }
      >
        다시 로그인
      </button>
    </form>
  );
}
