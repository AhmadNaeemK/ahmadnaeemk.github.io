/** What has to fit on a phone, with the real fonts and with a machine's fallback. */
import { expect, type Locator, type Page } from "@playwright/test";
import {
  NAV_SECTIONS,
  THEME_HOOKS,
  themeHash,
  type ThemeName,
} from "../../../src/scene/contract";
import {
  expectShowing,
  frames,
  sceneSettled,
  test,
  THEMES,
  themeRoot,
} from "../selection/support";
import { expectThemeFontsInUse, serveRealFonts } from "./real-fonts";

test.describe.configure({ mode: "parallel" });

const PHONE_WIDTHS = [320, 360, 390, 430];
const PHONE_HEIGHT = 800;

/** Allows WebKit's fractions of a pixel at the edge, and no more than that. */
const FULLY_IN_VIEW = { ratio: 0.95 };

/** Every width a phone can be on the way up, since which one wraps depends on the font. */
const HYPHENATED_WIDTHS = Array.from(
  { length: 17 },
  (_, step) => 320 + step * 10,
);

async function openOnPhone(
  page: Page,
  theme: ThemeName,
  fonts: "real" | "fallback",
): Promise<void> {
  if (fonts === "real") await serveRealFonts(page);
  await page.setViewportSize({ width: PHONE_WIDTHS[0], height: PHONE_HEIGHT });
  await page.goto(`/${themeHash(theme)}`);
  await expectShowing(page, theme);
  await sceneSettled(page, theme);
  if (fonts === "real") await expectThemeFontsInUse(page, theme);
}

const box = async (locator: Locator) => {
  const found = await locator.boundingBox();
  if (!found) throw new Error(`${locator} is not showing.`);
  return found;
};

/** How many lines a word of the hero's text takes, as drawn. 0 if it is not shown. */
function linesTaken(page: Page, theme: ThemeName, word: string) {
  return themeRoot(page, theme).evaluate((root, text) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const start = node.data.indexOf(text);
      if (start < 0) continue;
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + text.length);
      const tops = [...range.getClientRects()].map(({ top }) =>
        Math.round(top),
      );
      if (tops.length > 0) return new Set(tops).size;
    }
    return 0;
  }, word);
}

for (const address of [
  "mankhokhar1@gmail.com",
  "linkedin.com/in/ahmadnaeemk",
]) {
  test(`pixel-depot: at 320 px with the real fonts, ${address} stays on one line`, async ({
    page,
  }) => {
    await openOnPhone(page, "pixel-depot", "real");

    expect(await linesTaken(page, "pixel-depot", address)).toBe(1);
  });
}

for (const theme of THEMES) {
  for (const fonts of ["real", "fallback"] as const) {
    test(`${theme}, ${fonts} fonts: all five section links are in view at phone widths`, async ({
      page,
    }) => {
      await openOnPhone(page, theme, fonts);
      const nav = themeRoot(page, theme).getByRole("navigation", {
        name: "Sections",
      });

      for (const width of PHONE_WIDTHS) {
        await test.step(`${width} px`, async () => {
          await page.setViewportSize({ width, height: PHONE_HEIGHT });
          await frames(page);
          for (const { label } of NAV_SECTIONS) {
            await expect(
              nav.getByRole("link", { name: label, exact: true }),
            ).toBeInViewport(FULLY_IN_VIEW);
          }
        });
      }
    });

    test(`${theme}, ${fonts} fonts: at 320 px the colour toggle stays on the header's first row`, async ({
      page,
    }) => {
      await openOnPhone(page, theme, fonts);
      const root = themeRoot(page, theme);
      const colourToggle = root.locator(THEME_HOOKS.colorSchemeToggle);
      const firstLink = root
        .getByRole("navigation", { name: "Sections" })
        .getByRole("link")
        .first();

      await expect(colourToggle).toBeInViewport(FULLY_IN_VIEW);
      const toggleBox = await box(colourToggle);
      expect(toggleBox.y + toggleBox.height).toBeLessThanOrEqual(
        (await box(firstLink)).y,
      );
    });
  }

  test(`${theme}: "Full-stack" never breaks at its hyphen in the hero`, async ({
    page,
  }) => {
    await openOnPhone(page, theme, "real");

    for (const width of HYPHENATED_WIDTHS) {
      await page.setViewportSize({ width, height: PHONE_HEIGHT });
      await frames(page);
      expect(await linesTaken(page, theme, "Full-stack"), `${width} px`).toBe(
        1,
      );
    }
  });
}
