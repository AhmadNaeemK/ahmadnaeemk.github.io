import { expect } from "@playwright/test";
import {
  SECTION_KEYS,
  sectionId,
  THEME_HOOKS,
} from "../../../src/scene/contract";
import { fontStylesheetUrl, test, THEMES, themeRoot } from "./support";

// Locators only in this file: `evaluate` and `addStyleTag` can hang with
// JavaScript off, and this has to stay the real thing, because `<noscript>` and
// `@media (scripting: none)` respond to nothing else.
test.use({ javaScriptEnabled: false });

for (const path of ["/", "/#diorama", "/#b-about"]) {
  test.describe(`with JavaScript off at ${path} (E1)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(path);
    });

    test("only Interchange shows", async ({ page }) => {
      await expect(themeRoot(page, "interchange")).toBeVisible();
      for (const theme of THEMES.filter((name) => name !== "interchange")) {
        await expect(themeRoot(page, theme)).toBeHidden();
      }
    });

    test("all its content is readable", async ({ page }) => {
      const root = themeRoot(page, "interchange");
      await expect(root.locator("[data-rail-static]")).toBeVisible();
      await expect(root.getByText("Right now", { exact: true })).toBeVisible();
      await expect(root.locator(".now__list li").first()).toBeVisible();
      for (const key of SECTION_KEYS) {
        await expect(
          page.locator(`[id="${sectionId("interchange", key)}"]`),
        ).toBeVisible();
      }
    });

    test("what needs JavaScript does not show", async ({ page }) => {
      const root = themeRoot(page, "interchange");
      for (const selector of [
        THEME_HOOKS.canvas,
        THEME_HOOKS.controls,
        THEME_HOOKS.colorSchemeToggle,
        THEME_HOOKS.copy,
        THEME_HOOKS.themeSwitcher,
      ]) {
        // Each is there in the markup and hidden, not simply absent.
        await expect(root.locator(selector).first()).toBeAttached();
        await expect(root.locator(`${selector}:visible`)).toHaveCount(0);
      }
    });
  });
}

test("only Interchange's font is requested", async ({ page, fontRequests }) => {
  await page.goto("/#diorama");
  await expect(themeRoot(page, "interchange")).toBeVisible();
  expect(fontRequests).toEqual([fontStylesheetUrl("interchange")]);
});
