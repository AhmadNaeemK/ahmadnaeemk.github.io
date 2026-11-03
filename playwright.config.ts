import { defineConfig, devices } from "@playwright/test";

const previewUrl = "http://localhost:4321";
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: previewUrl,
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // WebKit stands in for iOS Safari, which Chromium cannot catch regressions for.
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  // Serves the existing dist/ folder, so run `npm run build` first.
  // --ignore-lock keeps the server in the foreground: when run by a coding agent,
  // `astro preview` otherwise detaches and Playwright reports that it exited early.
  webServer: {
    command: "npm run preview -- --ignore-lock",
    url: previewUrl,
    reuseExistingServer: !isCi,
  },
});
