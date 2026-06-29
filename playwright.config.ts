import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;

/** UI mode reads trace/video attachments while tests run — disable heavy artifacts to avoid corrupt zip errors. */
const isUiMode = process.argv.some((arg) => arg === "--ui" || arg.startsWith("--ui-port"));

/** Playwright UI bug: teardown can fail zipping live traces (auth appears to fail at 0s). See playwright#41351. */
if (isUiMode) {
  process.env.PLAYWRIGHT_TRACING_NO_WEBSOCKET_FRAMES = "1";
}

/** Same EMSYS API token path as local dev (`/auth/token`), not Firebase JWT. */
const playwrightDevAuthEnv = {
  NEXT_PUBLIC_BYPASS_AUTH: "true",
  NEXT_PUBLIC_DEV_EMAIL: process.env.PLAYWRIGHT_TEST_EMAIL ?? "",
  NEXT_PUBLIC_DEV_PASSWORD: process.env.PLAYWRIGHT_TEST_PASSWORD ?? "",
  NEXT_PUBLIC_DEV_COMPANY_ID: process.env.PLAYWRIGHT_TEST_COMPANY_ID ?? "",
  NEXT_DIST_DIR: ".next-playwright",
};

export default defineConfig({
  testDir: "./tests/integration",
  globalSetup: "./tests/integration/global-setup.ts",
  fullyParallel: !isUiMode,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: isUiMode || process.env.CI ? 1 : undefined,
  reporter: isUiMode ? [["list"]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    viewport: { width: 1280, height: 720 },
    trace: isUiMode ? "off" : "retain-on-failure",
    screenshot: isUiMode ? "off" : "only-on-failure",
    video: isUiMode ? "off" : "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
    },
  ],
  webServer: {
    command: `npx next dev -H 127.0.0.1 -p ${port}`,
    url: baseURL,
    // Reuse a dev server already on 3100 (common when re-running Playwright UI).
    reuseExistingServer: !process.env.CI && process.env.PLAYWRIGHT_REUSE_SERVER !== "false",
    timeout: 120_000,
    env: playwrightDevAuthEnv,
  },
});
