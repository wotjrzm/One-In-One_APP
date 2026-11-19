import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "npm run dev -- -p 3100",
    url: "http://localhost:3100/login",
    env: { E2E_FAKE_SESSION: "1", AUTH_SECRET: "e2e-dummy-secret" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
