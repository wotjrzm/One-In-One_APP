import { expect, test } from "@playwright/test";

const row = (rank: number, login: string, primary: number, secondary: number | null) => ({
  rank,
  userId: login,
  login,
  avatarUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
  repoUrl: `https://github.com/${login}/One-In-One`,
  primary,
  secondary,
});

test("ranking tabs, URL state, values and my-rank row", async ({ page }) => {
  const seen: string[] = [];
  await page.route("**/api/ranking*", (route) => {
    const u = new URL(route.request().url());
    seen.push(u.search);
    const metric = u.searchParams.get("metric");
    const period = u.searchParams.get("period");
    const rows =
      metric === "commits"
        ? [row(1, "alice", 12, null), row(2, "bob", 9, null)]
        : period === "all"
          ? [row(1, "alice", 5, 80)]
          : [row(1, "alice", 4, null)];
    return route.fulfill({ json: { rows, me: row(23, "e2e", 1, period === "all" ? 40 : null), hidden: false } });
  });

  await page.goto("/ranking");
  await expect(page.getByRole("tab", { name: "이번 주" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "꾸준성" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("4일", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "전체" }).click();
  await expect(page).toHaveURL(/period=all/);
  await expect(page.getByText("5일 · 80%")).toBeVisible();

  await page.getByRole("tab", { name: "커밋" }).click();
  await expect(page).toHaveURL(/metric=commits/);
  await expect(page.getByText("12회")).toBeVisible();
  await expect(page.getByText("나 23위")).toBeVisible();
  const link = page.getByRole("link", { name: /alice/ });
  await expect(link).toHaveAttribute("href", "https://github.com/alice/One-In-One");
  await expect(link).toHaveAttribute("target", "_blank");
  expect(seen.some((s) => s.includes("metric=commits"))).toBe(true);
});

test("ranking empty and hidden states", async ({ page }) => {
  await page.route("**/api/ranking*", (route) => route.fulfill({ json: { rows: [], me: null, hidden: true } }));
  await page.goto("/ranking");
  await expect(page.getByText("아직 랭킹에 오른 사람이 없어요")).toBeVisible();
  await expect(page.getByText("랭킹에서 숨김 상태예요")).toBeVisible();
});

test("profile switch patches immediately and reverts on failure", async ({ page }) => {
  const patches: unknown[] = [];
  let fail = false;
  await page.route("**/api/me", async (route) => {
    if (route.request().method() === "PATCH") {
      patches.push(route.request().postDataJSON());
      return route.fulfill(fail ? { status: 500, json: { error: "x" } } : { json: { hideFromRanking: true } });
    }
    return route.fulfill({
      json: { login: "e2e", avatarUrl: "", repoName: "One-In-One", repoUrl: "https://github.com/e2e/One-In-One", repoStatus: "disconnected", hideFromRanking: false },
    });
  });

  await page.goto("/me");
  await expect(page.getByRole("link", { name: "저장소 다시 연결하기" })).toHaveAttribute("href", "/onboarding");
  const sw = page.getByRole("switch", { name: "랭킹에 나를 숨기기" });
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  expect(patches).toEqual([{ hideFromRanking: true }]);

  fail = true;
  await sw.click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
});
