import { defineConfig, devices } from "@playwright/test";

const previewUrl = "http://localhost:4321";
const isCi = Boolean(process.env.CI);

// --ignore-lock keeps the server in the foreground: when run by a coding agent,
// `astro preview` otherwise detaches and Playwright reports that it exited early.
const previewCommand = "npm run preview -- --ignore-lock";

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
  // Local runs rebuild first so they never test a stale dist/. CI serves the
  // dist/ that the workflow's build step already produced.
  webServer: {
    command: isCi ? previewCommand : `npm run build && ${previewCommand}`,
    url: previewUrl,
    reuseExistingServer: !isCi,
  },
});
