import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; login: string; image: string } & Omit<DefaultSession["user"], "image">;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    login?: string;
  }
}
