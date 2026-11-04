import { expect, type Page } from "@playwright/test";
import { themeHash, type ThemeName } from "../../../src/scene/contract";
import {
  sceneSettled,
  test,
  THEMES,
  themeRoot,
  hasSidewaysScroll,
} from "./support";

const LONG_WORDS = Array.from({ length: 40 }, () => "several long words").join(
  " ",
);
const UNBROKEN = "x".repeat(400);

const ITEM_CASES = [
  { name: "a single short item", label: "Reading", value: "One book" },
  { name: "a single long item", label: LONG_WORDS, value: LONG_WORDS },
  { name: "a single unbroken item", label: UNBROKEN, value: UNBROKEN },
];

/** Real content has none of these edge cases, so they are written into the page. */
function setNowItem(
  page: Page,
  theme: ThemeName,
  { label, value }: { label: string; value: string },
) {
  return themeRoot(page, theme)
    .locator(".now__list")
    .evaluate(
      (list, item) => {
        const [first, ...rest] = [...list.querySelectorAll("li")];
        rest.forEach((extra) => extra.remove());
        const labelElement = first?.querySelector(".now__k");
        const valueElement = first?.querySelector(".now__v");
        if (labelElement) labelElement.textContent = item.label;
        if (valueElement) valueElement.textContent = item.value;
      },
      { label, value },
    );
}

function itemFitsViewport(page: Page, theme: ThemeName): Promise<boolean> {
  return themeRoot(page, theme)
    .locator(".now__list li")
    .first()
    .evaluate((item) => {
      const { left, right } = item.getBoundingClientRect();
      return left >= 0 && right <= document.documentElement.clientWidth + 1;
    });
}

test.describe.configure({ mode: "parallel" });

for (const theme of THEMES) {
  test.describe(`the HTML line in ${theme}`, () => {
    test("fits every item at phone width", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(`/${themeHash(theme)}`);
      await sceneSettled(page, theme);
      for (const item of ITEM_CASES) {
        await test.step(item.name, async () => {
          await setNowItem(page, theme, item);
          await expect(themeRoot(page, theme).locator(".now")).toBeVisible();
          expect(await hasSidewaysScroll(page)).toBe(false);
          expect(await itemFitsViewport(page, theme)).toBe(true);
        });
      }
    });

    test.describe("with a scene failed on purpose", () => {
      test.use({ allowUncaughtErrors: true });

      test("fits every item on a desktop whose scene failed to load", async ({
        page,
      }) => {
        await page.route("**/_astro/scene.*.js", (route) => route.abort());
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto(`/${themeHash(theme)}`);
        await expect(themeRoot(page, theme)).toHaveAttribute(
          "data-scene-state",
          "failed",
        );
        for (const item of ITEM_CASES) {
          await test.step(item.name, async () => {
            await setNowItem(page, theme, item);
            await expect(themeRoot(page, theme).locator(".now")).toBeVisible();
            expect(await hasSidewaysScroll(page)).toBe(false);
            expect(await itemFitsViewport(page, theme)).toBe(true);
          });
        }
      });
    });
  });
}
