/** A section link clicked in the header, as a visitor on a slow connection clicks it. */
import { expect, type Locator, type Page } from "@playwright/test";
import {
  sectionId,
  THEME_HOOKS,
  themeHash,
  type SectionKey,
  type ThemeName,
} from "../../../src/scene/contract";
import {
  expectSectionAtTop,
  expectShowing,
  pastPinSettling,
  sceneSettled,
  scrollAtRest,
  test,
  THEMES,
  themeRoot,
} from "../selection/support";
import { expectThemeFontsInUse, serveRealFonts } from "./real-fonts";

test.describe.configure({ mode: "parallel" });

const KEY: SectionKey = "projects";
const LINK_NAME = "Projects";

/** Positions strictly between start and end: a jump, or a cut-short scroll, has few. */
const FEWEST_SCROLL_STEPS = 2;

const sectionLink = (page: Page, theme: ThemeName): Locator =>
  themeRoot(page, theme)
    .getByRole("navigation", { name: "Sections" })
    .getByRole("link", { name: LINK_NAME, exact: true });

async function openSettled(
  page: Page,
  theme: ThemeName,
  viewport: { width: number; height: number },
): Promise<void> {
  await page.setViewportSize(viewport);
  // A held font would keep the load event from firing.
  await page.goto(`/${themeHash(theme)}`, { waitUntil: "domcontentloaded" });
  await expectShowing(page, theme);
  await sceneSettled(page, theme);
  await pastPinSettling(page);
}

/** How far a heading's top sits below the bottom of the header, as seen right now. */
function headingClearance(page: Page, theme: ThemeName): Promise<number> {
  return themeRoot(page, theme).evaluate(
    (root, { switcher, id }) => {
      const header = root.querySelector(`header:has(${switcher})`) as Element;
      const heading = root.querySelector(`[id="${id}"] h2`) as Element;
      return (
        heading.getBoundingClientRect().top -
        header.getBoundingClientRect().bottom
      );
    },
    { switcher: THEME_HOOKS.themeSwitcher, id: sectionId(theme, KEY) },
  );
}

for (const theme of THEMES) {
  test(`${theme}: a clicked link lands with the heading clear while the fonts arrive late`, async ({
    page,
  }) => {
    const releaseFonts = await serveRealFonts(page, { holdFiles: true });
    await openSettled(page, theme, { width: 390, height: 844 });

    await sectionLink(page, theme).click();
    // Once the scroll is under way, so its end was worked out from the fallback's layout.
    await page.waitForFunction(() => window.scrollY > 0);
    await releaseFonts();
    await expectThemeFontsInUse(page, theme);

    await scrollAtRest(page);
    await expectSectionAtTop(page, theme, KEY);
    expect(await headingClearance(page, theme)).toBeGreaterThanOrEqual(0);
  });

  test(`${theme}: a link clicked just as the fonts land ends on target`, async ({
    page,
  }) => {
    const releaseFonts = await serveRealFonts(page, { holdFiles: true });
    await openSettled(page, theme, { width: 390, height: 844 });

    await sectionLink(page, theme).click();
    await releaseFonts();
    await expectThemeFontsInUse(page, theme);

    await scrollAtRest(page);
    await expectSectionAtTop(page, theme, KEY);
  });

  test(`${theme}: a clicked link scrolls there smoothly, and the pin lets it`, async ({
    page,
  }) => {
    await openSettled(page, theme, { width: 1280, height: 720 });
    const start = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => {
      const positions: number[] = [];
      window.testScrollPositions = positions;
      const sample = () => {
        positions.push(window.scrollY);
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    await sectionLink(page, theme).click();
    await scrollAtRest(page);

    await expectSectionAtTop(page, theme, KEY);
    const end = await page.evaluate(() => window.scrollY);
    const positions = await page.evaluate(() => window.testScrollPositions);
    const steps = new Set(positions.filter((y) => y > start && y < end));
    expect(steps.size).toBeGreaterThanOrEqual(FEWEST_SCROLL_STEPS);
  });
}

declare global {
  interface Window {
    testScrollPositions: number[];
  }
}
