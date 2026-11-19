/** Test-only fake session switch for Playwright. Never active in production or on Vercel. */
export function isE2EFakeSession(): boolean {
  return (
    process.env.E2E_FAKE_SESSION === "1" &&
    process.env.NODE_ENV !== "production" &&
    !process.env.VERCEL
  );
}
