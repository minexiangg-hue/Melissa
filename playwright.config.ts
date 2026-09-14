import { defineConfig, devices } from "@playwright/test";
const basePath = process.env.MELISSA_TEST_BASE_PATH ?? "";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:3100${basePath}/`,
    trace: "retain-on-failure",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 900 },
      },
    },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: `http://127.0.0.1:3100${basePath}/api/v1/health`,
    reuseExistingServer: false,
    env: {
      APP_ORIGIN: "http://127.0.0.1:3100",
      DATABASE_PATH: basePath ? ".data/e2e-subpath.db" : ".data/e2e.db",
      NEXT_PUBLIC_BASE_PATH: basePath,
      COOKIE_SECURE: "false",
    },
    timeout: 120000,
  },
});
