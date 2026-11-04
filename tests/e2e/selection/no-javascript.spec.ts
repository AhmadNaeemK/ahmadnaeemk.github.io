import { expect } from "@playwright/test";
import {
  SECTION_KEYS,
  sectionId,
  THEME_HOOKS,
} from "../../../src/scene/contract";
import { fontStylesheetUrl, test, THEMES, themeRoot } from "./support";

// JavaScript stays really off, because `<noscript>` and `@media (scripting: none)`
// respond to nothing else. `addStyleTag` can hang like this.
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

test.describe("at full width", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("Right now sits below the static hero, not over it", async ({
    page,
  }) => {
    await page.goto("/");
    const root = themeRoot(page, "interchange");
    const hero = await root.locator(THEME_HOOKS.staticHero).boundingBox();
    const line = await root.locator(".now").boundingBox();
    if (!hero || !line)
      throw new Error("The static hero or line is not showing.");
    expect(line.y).toBeGreaterThanOrEqual(hero.y + hero.height - 1);
    // Nothing will ever fill the controls, so they take no space.
    expect(await root.locator(THEME_HOOKS.controls).boundingBox()).toBeNull();
  });
});

test.describe("at 320 px", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test("the static hero fits its box without clipping", async ({ page }) => {
    await page.goto("/");
    const staticHero = themeRoot(page, "interchange").locator(
      THEME_HOOKS.staticHero,
    );
    // Counts what `overflow: hidden` would cut off, which toBeVisible cannot see.
    const overflowing = await staticHero.evaluate((element) =>
      [element, element.parentElement].flatMap((box) =>
        box && box.scrollHeight > box.clientHeight + 1
          ? [`${box.tagName}: ${box.scrollHeight} in ${box.clientHeight}`]
          : [],
      ),
    );
    expect(overflowing).toEqual([]);
  });
});

test("only Interchange's font is requested", async ({ page, fontRequests }) => {
  await page.goto("/#diorama");
  await expect(themeRoot(page, "interchange")).toBeVisible();
  expect(fontRequests).toEqual([fontStylesheetUrl("interchange")]);
});
