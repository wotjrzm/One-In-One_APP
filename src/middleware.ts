import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

// Test-only bypass for Playwright; never active in production builds.
const e2eFake = process.env.E2E_FAKE_SESSION === "1" && process.env.NODE_ENV !== "production";

export default auth((req) => {
  if (!e2eFake && !req.auth) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
});

export const config = {
  matcher: ["/((?!login|api|_next|favicon.ico|.*\\..*).*)"],
};
