import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/integration",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx next dev -H 127.0.0.1 -p ${port}`,
    url: baseURL,
    // Always boot with Playwright env so auth bypass + mock API base URL are present.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_BASE_URL: `${baseURL}/api/e2e`,
      NEXT_PUBLIC_API_USE_DEV_PROXY: "false",
      NEXT_PUBLIC_BYPASS_AUTH: "true",
      NEXT_PUBLIC_DEV_ID_TOKEN: "playwright-id-token",
      NEXT_PUBLIC_DEV_COMPANY_ID: "playwright-company",
      NEXT_PUBLIC_DEV_EMAIL: "playwright@emsys.test",
      NEXT_PUBLIC_DEV_NAME: "Playwright User",
      NEXT_DIST_DIR: ".next-playwright",
    },
  },
});
