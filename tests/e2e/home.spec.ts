import { expect, test, type Page } from "@playwright/test";

const heatmap = Array.from({ length: 84 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10),
  active: i % 5 === 0,
}));

function today(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-11-19",
    streak: 3,
    heatmap,
    repo: { name: "One-In-One", status: "disconnected" },
    items: [
      { type: "ai", label: "AI", problem: null, status: "none" },
      { type: "network", label: "네트워크", problem: { id: "n1" }, status: "correct" },
      { type: "claude-code", label: "Claude Code", problem: { id: "c1" }, status: "wrong" },
      { type: "coding-test", label: "코딩 테스트", problem: { id: "t1" }, status: "none" },
    ],
    ...overrides,
  };
}

async function stub(page: Page, body: unknown, status = 200) {
  await page.route("**/api/today", (route) => route.fulfill({ status, json: body }));
}

test("home shows progress, links, placeholder and repo banner", async ({ page }) => {
  await stub(page, today());
  await page.goto("/");
  await expect(page.getByText("1 / 3 완료")).toBeVisible();
  await expect(page.getByText("3일 연속")).toBeVisible();
  await expect(page.getByRole("link", { name: /네트워크/ })).toHaveAttribute("href", "/solve/network");
  await expect(page.getByText("준비 중")).toBeVisible();
  await expect(page.getByRole("link", { name: /AI/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "저장소 다시 연결하기" })).toBeVisible();
  await expect(page.getByRole("link", { name: "홈" })).toHaveAttribute("aria-current", "page");
});

test("no horizontal scroll at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stub(page, today());
  await page.goto("/");
  await expect(page.getByText("1 / 3 완료")).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});

test("repo none redirects to onboarding", async ({ page }) => {
  await stub(page, today({ repo: { name: null, status: "none" } }));
  // The real onboarding page needs Supabase; stub it so the dev server stays quiet.
  await page.route("**/onboarding**", (route) => route.fulfill({ contentType: "text/html", body: "<html><body>onboarding</body></html>" }));
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding/);
});

test("fetch error shows retry", async ({ page }) => {
  await stub(page, { error: "x" }, 500);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
});
