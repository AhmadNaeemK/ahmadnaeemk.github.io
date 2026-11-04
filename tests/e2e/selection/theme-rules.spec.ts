import { expect } from "@playwright/test";
import { THEME_ROOT_ATTRIBUTE, themeHash } from "../../../src/scene/contract";
import {
  DESKTOP,
  expectShowing,
  PHONE,
  sceneSettled,
  serveWithCss,
  shownRightNows,
  test,
  THEMES,
} from "./support";

/**
 * Rules a theme is free to write under its own root. They are served after the
 * shell's CSS, as the worst order the build could give them, and must not undo the
 * two things the shell promises every theme.
 */
function underEveryRoot(selectorSuffix: string, declarations: string): string {
  return THEMES.map(
    (theme) =>
      `[${THEME_ROOT_ATTRIBUTE}="${theme}"]${selectorSuffix} { ${declarations} }`,
  ).join("\n");
}

const STYLED_NOW_LINE = underEveryRoot(
  " .now",
  `display: flex; position: relative; width: 100%; height: auto; padding: 12px;
   border: 1px solid; overflow: visible; clip-path: none; white-space: normal;`,
);

const FLEX_ROOTS = underEveryRoot("", "display: flex;");

test.describe.configure({ mode: "parallel" });

for (const theme of THEMES) {
  test.describe(`a rule in ${theme}'s own CSS`, () => {
    test("styling .now leaves only the billboard on desktop", async ({
      page,
    }) => {
      await page.setViewportSize(DESKTOP);
      await serveWithCss(page, STYLED_NOW_LINE);
      await page.goto(`/${themeHash(theme)}`);
      await sceneSettled(page, theme);
      await expect
        .poll(() => shownRightNows(page, theme))
        .toEqual(["billboard"]);
    });

    test("styling .now leaves only the line on a phone", async ({ page }) => {
      await page.setViewportSize(PHONE);
      await serveWithCss(page, STYLED_NOW_LINE);
      await page.goto(`/${themeHash(theme)}`);
      await sceneSettled(page, theme);
      await expect
        .poll(() => shownRightNows(page, theme))
        .toEqual(["html line"]);
    });

    test("setting display on the root does not show a hidden theme", async ({
      page,
    }) => {
      await serveWithCss(page, FLEX_ROOTS);
      await page.goto(`/${themeHash(theme)}`);
      await expectShowing(page, theme);
    });
  });
}
