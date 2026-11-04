/**
 * The page as a visitor with the real fonts gets it. Every other spec blocks them, and
 * CI's Linux fallback fonts have hidden and caused differences macOS's did not.
 */
import { expect, type Locator, type Page } from "@playwright/test";
import {
  SCENE_STATE_ATTRIBUTE,
  sectionId,
  THEME_HOOKS,
  themeHash,
  type SectionKey,
  type ThemeName,
} from "../../../src/scene/contract";
import {
  expectSceneNotStarted,
  expectShowing,
  frames,
  headingsUnderHeader,
  holdSceneChunks,
  pastPinSettling,
  sceneSettled,
  test,
  THEMES,
  themeRoot,
} from "../selection/support";
import { expectThemeFontsInUse, serveRealFonts } from "./real-fonts";

test.describe.configure({ mode: "parallel" });

const WIDTHS = [320, 390, 768, 1280];
const VIEWPORT_HEIGHT = 800;

/** Two rows at most: a third would cover too much of a phone's screen. */
const TALLEST_HEADER = 120;

/**
 * The contact section, last on the page, moves by what every section above it moves
 * by, so this is the most that a font's arrival can shift anything. A share and not
 * pixels, because a phone's page is several times as long as a desktop's.
 */
const FURTHEST_SHIFT_SHARE = 0.03;

/** Rounding only, as the fallback-font checks in the conformance spec allow. */
const HOLDS_WITHIN = 1;
const TOGGLE_HOLDS_WITHIN = 0.5;

const headerHeight = (page: Page, theme: ThemeName) =>
  themeRoot(page, theme)
    .locator(`header:has(${THEME_HOOKS.themeSwitcher})`)
    .evaluate((header) => header.getBoundingClientRect().height);

const sectionTop = (page: Page, theme: ThemeName, key: SectionKey) =>
  page.evaluate(
    (id) =>
      (document.getElementById(id) as HTMLElement).getBoundingClientRect().top +
      window.scrollY,
    sectionId(theme, key),
  );

const shownSize = (locator: Locator) =>
  locator.evaluate((element) => {
    const { width, height } = element.getBoundingClientRect();
    return { width, height };
  });

/** Held on the fallback until the scene is running, as a slow connection has it. */
async function openWithFontsHeld(
  page: Page,
  theme: ThemeName,
  width: number,
): Promise<() => Promise<void>> {
  const releaseFonts = await serveRealFonts(page, { holdFiles: true });
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.goto(`/${themeHash(theme)}`, { waitUntil: "domcontentloaded" });
  await expectShowing(page, theme);
  await sceneSettled(page, theme);
  await frames(page);
  return releaseFonts;
}

for (const theme of THEMES) {
  test(`${theme}: with its real fonts, headings clear a header of a sensible height`, async ({
    page,
    pageProblems,
  }) => {
    await serveRealFonts(page);
    await page.setViewportSize({ width: WIDTHS[0], height: VIEWPORT_HEIGHT });
    await page.goto(`/${themeHash(theme)}`);
    await expectShowing(page, theme);
    await sceneSettled(page, theme);
    await expectThemeFontsInUse(page, theme);
    await pastPinSettling(page);

    for (const width of WIDTHS) {
      await test.step(`${width} px`, async () => {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await frames(page);
        await expectThemeFontsInUse(page, theme);
        expect(await headerHeight(page, theme)).toBeLessThanOrEqual(
          TALLEST_HEADER,
        );
        expect(await headingsUnderHeader(page, theme)).toEqual([]);
      });
    }

    expect(pageProblems).toEqual([]);
  });

  for (const width of [390, 1280]) {
    test(`${theme}: at ${width} px, the real fonts landing on the fallback barely move the page`, async ({
      page,
    }) => {
      const releaseFonts = await openWithFontsHeld(page, theme, width);
      const onFallback = await sectionTop(page, theme, "contact");

      await releaseFonts();
      await expectThemeFontsInUse(page, theme);
      await frames(page);

      const shift = Math.abs(
        (await sectionTop(page, theme, "contact")) - onFallback,
      );
      expect(shift / onFallback).toBeLessThanOrEqual(FURTHEST_SHIFT_SHARE);
    });
  }

  for (const width of WIDTHS) {
    test(`${theme}: at ${width} px with its real fonts, the scene starting and the toggle's labels leave the hero alone`, async ({
      page,
    }) => {
      await serveRealFonts(page);
      // Reduced motion, where a full-size scene shows the toggle's third label.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      const releaseScene = await holdSceneChunks(page);
      // Not "load": WebKit holds that back for a pending dynamic import.
      await page.goto(`/${themeHash(theme)}`, {
        waitUntil: "domcontentloaded",
      });
      await expectShowing(page, theme);
      await expectSceneNotStarted(page, theme);
      await expectThemeFontsInUse(page, theme);
      const root = themeRoot(page, theme);
      const hero = root.locator(THEME_HOOKS.hero);
      const held = await shownSize(hero);

      await releaseScene();
      await expect(root).toHaveAttribute(SCENE_STATE_ATTRIBUTE, "running");
      await frames(page);
      expect(
        Math.abs((await shownSize(hero)).height - held.height),
      ).toBeLessThanOrEqual(HOLDS_WITHIN);

      const toggle = root.locator(THEME_HOOKS.toggle);
      const resting = await shownSize(toggle);
      const labels = new Set<string | null>();
      for (let press = 0; press < 3; press += 1) {
        labels.add(await toggle.locator(THEME_HOOKS.toggleLabel).textContent());
        await toggle.click();
        await frames(page);
        expect(
          Math.abs((await shownSize(toggle)).width - resting.width),
        ).toBeLessThanOrEqual(TOGGLE_HOLDS_WITHIN);
        expect(
          Math.abs((await shownSize(hero)).height - held.height),
        ).toBeLessThanOrEqual(HOLDS_WITHIN);
      }
      // Otherwise no label changed, and this tested nothing.
      expect(labels.size).toBeGreaterThan(1);
    });
  }
}

for (const theme of ["diorama", "pixel-depot"] as const) {
  for (const width of [768, 1280]) {
    test(`${theme}: at ${width} px, the real fonts landing leave the first section after the hero where it was`, async ({
      page,
    }) => {
      const releaseFonts = await openWithFontsHeld(page, theme, width);
      const onFallback = await sectionTop(page, theme, "about");

      await releaseFonts();
      await expectThemeFontsInUse(page, theme);
      await frames(page);

      expect(
        Math.abs((await sectionTop(page, theme, "about")) - onFallback),
      ).toBeLessThanOrEqual(HOLDS_WITHIN);
    });
  }
}
