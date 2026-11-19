import { expect, test, type Page } from "@playwright/test";

const fixtureExplanation = "TCP는 연결 지향 프로토콜이라 3-way handshake를 사용합니다.";

function today(status: "none" | "correct" | "wrong" = "none") {
  return {
    date: "2026-11-19",
    streak: 1,
    heatmap: [],
    repo: { name: "One-In-One", status: "connected" },
    items: [
      { type: "ai", label: "AI", problem: null, status: "none" },
      {
        type: "network",
        label: "네트워크",
        status,
        problem: {
          id: "network-001",
          type: "network",
          title: "TCP 연결",
          prompt: "TCP 연결 수립 과정은?",
          choices: ["1-way", "2-way", "3-way handshake", "4-way"],
        },
      },
      { type: "claude-code", label: "Claude Code", problem: null, status: "none" },
      { type: "coding-test", label: "코딩 테스트", problem: null, status: "none" },
    ],
  };
}

async function stubApis(
  page: Page,
  status: "none" | "correct" | "wrong" = "none",
  commit: { status: string } = { status: "pending" },
) {
  let submits = 0;
  await page.route("**/api/today", (route) => route.fulfill({ json: today(status) }));
  await page.route("**/api/submit", (route) => {
    submits += 1;
    return route.fulfill({ json: { isCorrect: false, commit } });
  });
  await page.route("**/api/explanation**", (route) =>
    route.fulfill({ json: { explanation: fixtureExplanation, answerIndex: 2 } }),
  );
  return { submits: () => submits };
}

test("choice flow: submit wrong, retry button, explanation only after click", async ({ page }) => {
  const api = await stubApis(page);
  await page.goto("/solve/network");
  await expect(page.getByRole("tab", { name: /네트워크/ })).toHaveAttribute("aria-selected", "true");

  const submit = page.getByRole("button", { name: "제출하고 커밋하기" });
  await expect(submit).toBeDisabled();
  await page.getByRole("radio").nth(1).check();
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByText("오답", { exact: true })).toBeVisible();
  await expect(page.getByText("깃허브에 기록 중이에요. 잠시 후 자동으로 다시 시도해요")).toBeVisible();
  await expect(page.getByRole("button", { name: "다시 풀기" })).toBeVisible();
  expect(api.submits()).toBe(1);
  await expect(page.getByText(fixtureExplanation)).toHaveCount(0);

  await page.getByRole("button", { name: "해설 보기" }).click();
  await expect(page.getByText(fixtureExplanation)).toBeVisible();
  await expect(page.getByText("정답 보기")).toBeVisible();

  await page.getByRole("button", { name: "다시 풀기" }).click();
  await expect(page.getByRole("radio").nth(1)).toBeChecked();
  await expect(page.getByRole("button", { name: "제출하고 커밋하기" })).toBeEnabled();
});

test("disconnected repo shows reconnect link instead of auto-retry copy", async ({ page }) => {
  await stubApis(page, "none", { status: "disconnected" });
  await page.goto("/solve/network");
  await page.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: "제출하고 커밋하기" }).click();
  await expect(page.getByText("저장소 연결이 끊겼어요")).toBeVisible();
  await expect(page.getByRole("link", { name: "저장소 다시 연결하기" })).toHaveAttribute("href", "/onboarding");
  await expect(page.getByText("잠시 후 자동으로 다시 시도해요")).toHaveCount(0);
});

test("reopening a wrong problem shows explanation button and editable choices", async ({ page }) => {
  await stubApis(page, "wrong");
  await page.goto("/solve/network");
  await expect(page.getByRole("button", { name: "해설 보기" })).toBeVisible();
  await page.getByRole("radio").nth(0).check();
  await expect(page.getByRole("button", { name: "제출하고 커밋하기" })).toBeEnabled();
});

test("unknown type and empty problem show messages", async ({ page }) => {
  await stubApis(page);
  await page.goto("/solve/bogus");
  await expect(page.getByRole("link", { name: "홈으로" })).toBeVisible();
  await page.goto("/solve/ai");
  await expect(page.getByText(/준비 중/)).toBeVisible();
});

test("409 date_changed shows notice and refetches today", async ({ page }) => {
  let todayCalls = 0;
  await page.route("**/api/today", (route) => {
    todayCalls += 1;
    return route.fulfill({ json: today() });
  });
  await page.route("**/api/submit", (route) => route.fulfill({ status: 409, json: { error: "date_changed" } }));
  await page.goto("/solve/network");
  await page.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: "제출하고 커밋하기" }).click();
  await expect(page.getByText("날짜가 바뀌었어요. 오늘의 문제를 불러올게요")).toBeVisible();
  await expect.poll(() => todayCalls).toBe(2);
  await expect(page.getByRole("radio").nth(1)).not.toBeChecked();
});

test("412 shows a link to onboarding", async ({ page }) => {
  await page.route("**/api/today", (route) => route.fulfill({ json: today() }));
  await page.route("**/api/submit", (route) => route.fulfill({ status: 412, json: { error: "repo_not_ready" } }));
  await page.goto("/solve/network");
  await page.getByRole("radio").nth(0).check();
  await page.getByRole("button", { name: "제출하고 커밋하기" }).click();
  await expect(page.getByRole("link", { name: "저장소 다시 연결하기" })).toHaveAttribute("href", "/onboarding");
});

test("409 already_solved switches to solved state and checks the tab", async ({ page }) => {
  await page.route("**/api/today", (route) => route.fulfill({ json: today() }));
  await page.route("**/api/submit", (route) => route.fulfill({ status: 409, json: { error: "already_solved" } }));
  await page.goto("/solve/network");
  await page.getByRole("radio").nth(0).check();
  await page.getByRole("button", { name: "제출하고 커밋하기" }).click();
  await expect(page.getByText("정답", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: /네트워크/ }).getByRole("img", { name: "완료" })).toBeVisible();
});
