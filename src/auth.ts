import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { encryptToken } from "@/lib/crypto";
import { getStore } from "@/lib/db/supabase-store";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
