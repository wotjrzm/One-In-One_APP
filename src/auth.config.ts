import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

/** Edge-safe part of the auth config (shared with middleware). */
export const authConfig = {
  providers: [
    GitHub({ authorization: { params: { scope: "read:user public_repo" } } }),
  ],
  pages: { signIn: "/login" },
} satisfies NextAuthConfig;
