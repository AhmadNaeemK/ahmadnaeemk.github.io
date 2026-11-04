import { createHash } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env.CI);
const projectRoot = import.meta.dirname;

const FIRST_PORT = 4400;
const PORT_COUNT = 600;

/**
 * Each checkout gets its own port from its path, so parallel worktrees run
 * side by side and none uses `astro dev`'s 4321. If two paths land on the same
 * one, the second server exits on the taken port (`strictPort` in
 * astro.config.mjs) and its run fails. Set E2E_PORT to get past that.
 */
function e2ePort(): number {
  if (process.env.E2E_PORT) return Number(process.env.E2E_PORT);
  const pathHash = createHash("sha256").update(projectRoot).digest();
  return FIRST_PORT + (pathHash.readUInt32BE(0) % PORT_COUNT);
}

const port = e2ePort();
const previewUrl = `http://127.0.0.1:${port}`;

// --ignore-lock keeps the server in the foreground: when run by a coding agent,
// `astro preview` otherwise detaches and Playwright reports that it exited early.
const previewCommand = `npm run preview -- --ignore-lock --host 127.0.0.1 --port ${port}`;

/** They read `dist/` and open no page, so one run with no browser says it all. */
const BUILT_FILE_SPECS = [
  "**/conformance/built-css.spec.ts",
  "**/scene/chunk-rule.spec.ts",
];

/**
 * A wide fallback at 31 widths is about the header's text wrapping, and a section's
 * margin follows the header's measured height in any browser. The real-font spec keeps
 * clearance covered in WebKit.
 */
const CHROMIUM_ONLY_SPECS = ["**/conformance/heading-clearance.spec.ts"];

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
    { name: "built-files", testMatch: BUILT_FILE_SPECS },
    {
      name: "chromium",
      testIgnore: BUILT_FILE_SPECS,
      use: { ...devices["Desktop Chrome"] },
    },
    // WebKit stands in for iOS Safari, which Chromium cannot catch regressions for.
    {
      name: "webkit",
      testIgnore: [...BUILT_FILE_SPECS, ...CHROMIUM_ONLY_SPECS],
      use: { ...devices["Desktop Safari"] },
    },
  ],
  // Local runs rebuild first so they never test a stale dist/. CI serves the
  // dist/ that the workflow's build step already produced.
  webServer: {
    command: isCi ? previewCommand : `npm run build && ${previewCommand}`,
    cwd: projectRoot,
    // This server's own startup line, not a poll of the URL: a poll could succeed
    // against another checkout's server on this port while this one still builds.
    wait: { stdout: new RegExp(`Local\\s+http://127\\.0\\.0\\.1:${port}\\b`) },
  },
});
