import type { Page } from "@playwright/test";
import { THEME_ATTRIBUTE } from "../../../src/scene/contract";
import {
  canvas,
  expect,
  expectDrawing,
  hideTab,
  selectTheme,
  setColorScheme,
  test,
  waitFrames,
} from "../scene/helpers";
import { DESKTOP, DIORAMA, expectSceneState, openDiorama } from "./support";

test.use({ viewport: DESKTOP });

/** Long enough for a repaint on every frame, or a late one, to show in the count. */
const SETTLING_FRAMES = 12;

declare global {
  interface Window {
    __staticLayerPaints: number;
  }
}

/**
 * Counts paints rather than canvases, so one kept canvas repainted every frame still
 * shows. The board's edge is the only linear gradient on the page and is drawn once
 * per paint, and the first-show test below fails if that stops being true.
 */
const countStaticLayerPaints = (page: Page) =>
  page.addInitScript(() => {
    window.__staticLayerPaints = 0;
    const context = CanvasRenderingContext2D.prototype;
    const createLinearGradient = context.createLinearGradient;
    context.createLinearGradient = function (...args) {
      window.__staticLayerPaints += 1;
      return createLinearGradient.apply(this, args);
    };
  });

const staticLayerPaints = (page: Page) =>
  page.evaluate(() => window.__staticLayerPaints);
const clearStaticLayerPaints = (page: Page) =>
  page.evaluate(() => {
    window.__staticLayerPaints = 0;
  });

/** In one task, so a frame of the theme being left cannot land in the new count. */
async function showDioramaFromZero(page: Page): Promise<void> {
  await page.evaluate(
    ([attribute, theme]) => {
      window.__staticLayerPaints = 0;
      document.documentElement.setAttribute(attribute, theme);
    },
    [THEME_ATTRIBUTE, DIORAMA] as const,
  );
  await expectSceneState(page, DIORAMA, "running");
}

async function hideDiorama(page: Page): Promise<void> {
  await selectTheme(page, "interchange");
  await expectSceneState(page, "interchange", "running");
  await waitFrames(page, SETTLING_FRAMES);
}

async function openAndSettle(page: Page): Promise<void> {
  await page.emulateMedia({ colorScheme: "light" });
  await countStaticLayerPaints(page);
  await openDiorama(page);
  await waitFrames(page, SETTLING_FRAMES);
}

/** After a change that may paint: what it painted, once anything late has landed. */
async function paintsSince(page: Page): Promise<number> {
  await waitFrames(page, SETTLING_FRAMES);
  return staticLayerPaints(page);
}

async function setWidthAndSettle(page: Page, width: number): Promise<void> {
  const before = await canvas(page, DIORAMA).boundingBox();
  await page.setViewportSize({ width, height: DESKTOP.height });
  await expect
    .poll(async () => (await canvas(page, DIORAMA).boundingBox())?.width)
    .not.toBe(before?.width);
}

test.describe("the static layer", () => {
  test("is painted once for a first show, not once a frame", async ({
    page,
  }) => {
    await openAndSettle(page);
    expect(await staticLayerPaints(page)).toBe(1);
  });

  test("is not painted again on hiding and showing at the same size", async ({
    page,
  }) => {
    await openAndSettle(page);

    await hideDiorama(page);
    await showDioramaFromZero(page);
    expect(await paintsSince(page)).toBe(0);

    await hideTab(page, true);
    await hideTab(page, false);
    expect(await paintsSince(page)).toBe(0);
  });

  test("is painted once for each real change of size, and not for a change of height", async ({
    page,
  }) => {
    await openAndSettle(page);
    await clearStaticLayerPaints(page);

    await setWidthAndSettle(page, 1000);
    expect(await paintsSince(page)).toBe(1);
    await clearStaticLayerPaints(page);

    await page.setViewportSize({ width: 1000, height: 500 });
    expect(await paintsSince(page)).toBe(0);

    await setWidthAndSettle(page, 390);
    expect(await paintsSince(page)).toBe(1);
  });

  test("is painted once on returning to an earlier size", async ({ page }) => {
    await openAndSettle(page);
    await clearStaticLayerPaints(page);

    await setWidthAndSettle(page, 1000);
    expect(await paintsSince(page)).toBe(1);
    await clearStaticLayerPaints(page);

    await setWidthAndSettle(page, DESKTOP.width);
    expect(await paintsSince(page)).toBe(1);
  });

  test("is not painted again when the size changes and returns while hidden", async ({
    page,
  }) => {
    await openAndSettle(page);
    await hideDiorama(page);

    await page.setViewportSize({ width: 1000, height: DESKTOP.height });
    await waitFrames(page, SETTLING_FRAMES);
    await page.setViewportSize(DESKTOP);
    await waitFrames(page, SETTLING_FRAMES);

    await showDioramaFromZero(page);
    expect(await paintsSince(page)).toBe(0);
    await expectDrawing(page, DIORAMA);
  });

  test("is painted once for each change of scheme, even one made while hidden", async ({
    page,
  }) => {
    await openAndSettle(page);
    await clearStaticLayerPaints(page);

    await setColorScheme(page, "dark");
    expect(await paintsSince(page)).toBe(1);
    await clearStaticLayerPaints(page);

    await hideDiorama(page);
    await setColorScheme(page, "light");
    await waitFrames(page, SETTLING_FRAMES);
    await showDioramaFromZero(page);
    expect(await paintsSince(page)).toBe(1);
  });
});
