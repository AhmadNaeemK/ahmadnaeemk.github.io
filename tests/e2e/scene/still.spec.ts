/**
 * A still scene, with its train at rest and its text paused, paints nothing until
 * something changes what the last draw showed. A scene can cost 100 ms a frame on a
 * software canvas, so a page left open should not pay that.
 */
import { THEME_NAMES, type ThemeName } from "../../../src/scene/contract";
import {
  canvas,
  canvasFingerprint,
  canvasPalette,
  drawCount,
  expect,
  expectDrawing,
  expectDrawsStop,
  expectNoDraws,
  expectToggle,
  hideTab,
  instrumentScenes,
  liveryButton,
  loadFontFace,
  makePageTall,
  openScenePage,
  scrollCanvasOffScreen,
  scrollPage,
  setColorScheme,
  showTheme,
  STOPPED_TOGGLE,
  test,
  toggle,
  waitForTrainAtRest,
  widthWriteCount,
} from "./helpers";
import type { Page } from "@playwright/test";

const THEME: ThemeName = "interchange";
const VIEWPORT = { width: 1280, height: 720 };

/** Reduced motion has no train to brake, so the scene is still at the first press. */
async function openStillScene(page: Page): Promise<void> {
  await page.setViewportSize(VIEWPORT);
  await openScenePage(page, { reducedMotion: true });
  await toggle(page, THEME).click();
  await expectToggle(page, THEME, STOPPED_TOGGLE);
  await expectDrawsStop(page, THEME);
}

/** The change paints the canvas, and paints it only once. */
async function expectOneRepaint(
  page: Page,
  change: () => Promise<unknown>,
): Promise<void> {
  const before = await drawCount(page, THEME);
  await change();
  await expect.poll(() => drawCount(page, THEME)).toBeGreaterThan(before);
  await expectNoDraws(page, THEME);
  expect(await drawCount(page, THEME)).toBe(before + 1);
}

test.describe("a stopped train", () => {
  test.describe.configure({ timeout: 60_000 });

  for (const theme of THEME_NAMES) {
    test(`${theme}: once at rest, nothing more is drawn until it starts again`, async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORT);
      await instrumentScenes(page);
      await openScenePage(page);
      if (theme !== THEME) await showTheme(page, theme);

      await toggle(page, theme).click();
      await expectToggle(page, theme, STOPPED_TOGGLE);
      await waitForTrainAtRest(page, theme);
      await expectDrawsStop(page, theme);

      await toggle(page, theme).click();
      await expectDrawing(page, theme);
    });
  }
});

test.describe("on a still scene", () => {
  test("a livery change paints once", async ({ page }) => {
    await openStillScene(page);
    const before = await canvasFingerprint(page, THEME);

    await expectOneRepaint(page, () =>
      liveryButton(page, THEME, "steam").click(),
    );

    expect(await canvasFingerprint(page, THEME)).not.toBe(before);
  });

  test("a colour change paints once", async ({ page }) => {
    await openStillScene(page);
    await setColorScheme(page, "light");
    await expectDrawsStop(page, THEME);
    const before = await canvasPalette(page, THEME);

    await expectOneRepaint(page, () => setColorScheme(page, "dark"));

    expect(await canvasPalette(page, THEME)).not.toEqual(before);
  });

  test("a resize paints once", async ({ page }) => {
    await openStillScene(page);
    const sized = await widthWriteCount(page, THEME);

    await expectOneRepaint(page, () =>
      page.setViewportSize({ width: 1000, height: VIEWPORT.height }),
    );

    // The canvas really was resized, which clears it, and it was painted again.
    expect(await widthWriteCount(page, THEME)).toBeGreaterThan(sized);
    expect(await canvasPalette(page, THEME)).not.toEqual([]);
  });

  test("a font arriving paints once", async ({ page }) => {
    await openStillScene(page);

    await expectOneRepaint(page, () => loadFontFace(page, "Late Font"));
  });

  // No browser here can drop a canvas's context on demand, so the event stands in.
  test("a canvas context restored paints once", async ({ page }) => {
    await openStillScene(page);

    await expectOneRepaint(page, () =>
      canvas(page, THEME).dispatchEvent("contextrestored"),
    );
  });

  test("coming back on screen paints once", async ({ page }) => {
    await openStillScene(page);
    await makePageTall(page);
    await scrollCanvasOffScreen(page, THEME);
    await expectNoDraws(page, THEME);

    await expectOneRepaint(page, () => scrollPage(page, 0));
  });

  test("a tab coming back into focus paints once", async ({ page }) => {
    await openStillScene(page);
    await hideTab(page, true);
    await expectNoDraws(page, THEME);

    await expectOneRepaint(page, () => hideTab(page, false));
  });
});
