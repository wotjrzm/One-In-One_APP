import { isE2EFakeSession } from "@/lib/e2e";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { encryptToken } from "@/lib/crypto";
import { getStore } from "@/lib/db/supabase-store";

const nextAuth = NextAuth({
  ...authConfig,
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile && account.access_token) {
        const user = await getStore().upsertUser({
          githubId: Number(profile.id),
          login: String(profile.login),
          avatarUrl: String(profile.avatar_url),
          tokenEnc: encryptToken(account.access_token),
        });
        token.uid = user.id;
        token.login = user.login;
        token.picture = user.avatarUrl;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.login = token.login as string;
      session.user.image = (token.picture as string | null | undefined) ?? "";
      return session;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;

/** Test-only: fixed session for Playwright. Never active in production builds. */
const e2eFake = isE2EFakeSession();

export const auth: typeof nextAuth.auth = e2eFake
  ? ((async () => ({
      user: { id: "e2e-user", login: "e2e", image: "" },
      expires: "2999-01-01T00:00:00.000Z",
    })) as unknown as typeof nextAuth.auth)
  : nextAuth.auth;
