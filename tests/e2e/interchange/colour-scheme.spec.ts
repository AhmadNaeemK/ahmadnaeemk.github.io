import { type Page } from "@playwright/test";
import { THEME_HOOKS } from "../../../src/scene/contract";
import {
  canvasPalette,
  expect,
  openScenePage,
  root,
  test,
} from "../scene/helpers";
import {
  DESKTOP,
  lastBoardTexts,
  logCanvasTexts,
  readCanvasPixels,
  textContrast,
  THEME,
} from "./support";

test.use({ viewport: DESKTOP });

/** WCAG AA for text this size. */
const READABLE_CONTRAST = 4.5;

const pressSchemeToggle = (page: Page) =>
  root(page, THEME).locator(THEME_HOOKS.colorSchemeToggle).click();

const palette = (page: Page) => canvasPalette(page, THEME);

test.describe("the colour scheme toggle", () => {
  test("repaints the canvas both ways while the train runs", async ({
    page,
  }) => {
    await openScenePage(page);
    const light = await palette(page);
    expect(light.length).toBeGreaterThan(0);

    await pressSchemeToggle(page);
    await expect.poll(() => palette(page)).not.toEqual(light);
    const dark = await palette(page);

    await pressSchemeToggle(page);
    await expect.poll(() => palette(page)).toEqual(light);
    expect(dark).not.toEqual(light);
  });
});

/** Its text and the colour most of it is, read from what the canvas really shows. */
async function chipContrast(page: Page): Promise<number> {
  await expect
    .poll(async () => (await lastBoardTexts(page)).length)
    .toBeGreaterThan(0);
  const [chip] = await lastBoardTexts(page);
  return textContrast(await readCanvasPixels(page, chip.box));
}

test.describe("the billboard's chip stays readable", () => {
  test("in light", async ({ page }) => {
    await logCanvasTexts(page);
    await openScenePage(page);
    await expect
      .poll(() => chipContrast(page))
      .toBeGreaterThanOrEqual(READABLE_CONTRAST);
  });

  test("in dark, picked with the toggle", async ({ page }) => {
    await logCanvasTexts(page);
    await openScenePage(page);
    const light = await palette(page);

    await pressSchemeToggle(page);
    await expect.poll(() => palette(page)).not.toEqual(light);
    await expect
      .poll(() => chipContrast(page))
      .toBeGreaterThanOrEqual(READABLE_CONTRAST);
  });

  test("in dark, from the system", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await logCanvasTexts(page);
    await openScenePage(page);
    await expect
      .poll(() => chipContrast(page))
      .toBeGreaterThanOrEqual(READABLE_CONTRAST);
  });
});
