import { expect, test } from "@playwright/test";

const row = (rank: number, login: string, primary: number, secondary: number | null, displayName: string | null = null) => ({
  rank,
  userId: login,
  login,
  displayName,
  avatarUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
  repoUrl: `https://github.com/${login}/One-In-One`,
  primary,
  secondary,
});

const boards = (period: string | null) => ({
  consistency: {
    rows: period === "all" ? [row(1, "alice", 5, 80, "앨리스")] : [row(1, "alice", 4, null, "앨리스")],
    me: row(23, "e2e", 1, period === "all" ? 40 : null),
  },
  problems: { rows: [row(1, "bob", 7, null)], me: row(3, "e2e", 2, null) },
  commits: { rows: [row(1, "alice", 12, null, "앨리스"), row(2, "bob", 9, null)], me: row(5, "e2e", 3, null) },
});

test("ranking shows Days, Problems and Commits together on one screen", async ({ page }) => {
  const seen: string[] = [];
  await page.route("**/api/ranking*", (route) => {
    const u = new URL(route.request().url());
    seen.push(u.search);
    return route.fulfill({ json: { boards: boards(u.searchParams.get("period")), hidden: false } });
  });

  await page.goto("/ranking");
  await expect(page.getByRole("tab", { name: "이번 주" })).toHaveAttribute("aria-selected", "true");
  for (const title of ["Days", "Problems", "Commits"]) {
    await expect(page.getByRole("heading", { name: new RegExp(`^${title}`) })).toBeVisible();
  }
  await expect(page.getByRole("tab", { name: "꾸준성" })).toHaveCount(0);
  await expect(page.getByText("4일", { exact: true })).toBeVisible();
  await expect(page.getByText("7문제")).toBeVisible();
  await expect(page.getByText("12회")).toBeVisible();
  // chosen name next to GitHub nickname; no name falls back to login only
  await expect(page.getByText("앨리스").first()).toBeVisible();
  await expect(page.getByText("@alice").first()).toBeVisible();
  await expect(page.getByText("bob", { exact: true }).first()).toBeVisible();
  // my row is appended to each board whose top list does not include me
  await expect(page.getByText("23")).toBeVisible();

  const link = page.getByRole("link", { name: /앨리스/ }).first();
  await expect(link).toHaveAttribute("href", "https://github.com/alice/One-In-One");
  await expect(link).toHaveAttribute("target", "_blank");

  await page.getByRole("tab", { name: "전체" }).click();
  await expect(page).toHaveURL(/period=all/);
  await expect(page.getByText("5일 · 80%")).toBeVisible();
  expect(seen.every((s) => !s.includes("metric"))).toBe(true);
});

test("ranking empty and hidden states", async ({ page }) => {
  const empty = { rows: [], me: null };
  await page.route("**/api/ranking*", (route) =>
    route.fulfill({ json: { boards: { consistency: empty, problems: empty, commits: empty }, hidden: true } }),
  );
  await page.goto("/ranking");
  await expect(page.getByText("아직 랭킹에 오른 사람이 없어요")).toHaveCount(3);
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
      json: { login: "e2e", avatarUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", repoName: "One-In-One", repoUrl: "https://github.com/e2e/One-In-One", repoStatus: "disconnected", hideFromRanking: false },
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
  await expect(page.getByText("저장하지 못했어요")).toBeVisible();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
});

test("stale ranking response does not overwrite newer tab data", async ({ page }) => {
  await page.route("**/api/ranking*", async (route) => {
    const period = new URL(route.request().url()).searchParams.get("period");
    if (period !== "all") await new Promise((r) => setTimeout(r, 1500));
    const who = period === "all" ? "allguy" : "slowguy";
    const board = { rows: [row(1, who, 7, null)], me: null };
    await route.fulfill({ json: { boards: { consistency: board, problems: board, commits: board }, hidden: false } }).catch(() => {});
  });
  await page.goto("/ranking");
  await page.getByRole("tab", { name: "전체" }).click();
  await expect(page.getByText("allguy").first()).toBeVisible();
  await page.waitForTimeout(2000);
  await expect(page.getByText("allguy").first()).toBeVisible();
  await expect(page.getByText("slowguy")).toHaveCount(0);
});

test("my-rank row is omitted when me is null and not hidden", async ({ page }) => {
  const board = { rows: [row(1, "alice", 4, null)], me: null };
  await page.route("**/api/ranking*", (route) =>
    route.fulfill({ json: { boards: { consistency: board, problems: board, commits: board }, hidden: false } }),
  );
  await page.goto("/ranking");
  await expect(page.getByText("alice").first()).toBeVisible();
  await expect(page.getByText("랭킹에서 숨김 상태예요")).toHaveCount(0);
});

test("profile switch ignores clicks while PATCH is in flight", async ({ page }) => {
  let patches = 0;
  await page.route("**/api/me", async (route) => {
    if (route.request().method() === "PATCH") {
      patches++;
      await new Promise((r) => setTimeout(r, 800));
      return route.fulfill({ json: { hideFromRanking: true } });
    }
    return route.fulfill({
      json: { login: "e2e", avatarUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", repoName: "R", repoUrl: "https://github.com/e2e/R", repoStatus: "connected", hideFromRanking: false },
    });
  });
  await page.goto("/me");
  const sw = page.getByRole("switch", { name: "랭킹에 나를 숨기기" });
  await sw.click();
  await expect(sw).toBeDisabled();
  await sw.click({ force: true }).catch(() => {});
  await expect(sw).toBeEnabled();
  expect(patches).toBe(1);
  await expect(sw).toHaveAttribute("aria-checked", "true");
});

test("home sends a user without a display name to onboarding", async ({ page }) => {
  await page.route("**/api/today", (route) =>
    route.fulfill({ json: { date: "2026-11-19", items: [], streak: 0, heatmap: [], repo: { name: "One-In-One", status: "connected" }, needsName: true } }),
  );
  // stub the destination so the real onboarding page (needs a live DB) is not rendered
  await page.route("**/onboarding*", (route) => route.fulfill({ contentType: "text/html", body: "<h1>onboarding</h1>" }));
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding/);
});
