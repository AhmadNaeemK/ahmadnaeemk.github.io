import type { Page } from "@playwright/test";
import {
  canvasFingerprint,
  canvasPalette,
  carsSeenBy,
  drawCount,
  expect,
  expectToggle,
  instrumentScenes,
  liveryButton,
  openScenePage,
  REDUCED_START_TOGGLE,
  rewriteThemeHtml,
  setColorScheme,
  showTheme,
  STOPPED_TOGGLE,
  test,
  toggle,
  waitForTrainAtRest,
  waitFrames,
} from "../scene/helpers";
import {
  nowItemsHtml,
  readBillboardBand,
  readTownBelowBillboard,
  samePixels,
  THEME,
  waitForVisibleRoll,
  worldClocks,
} from "./support";

async function open(page: Page, reducedMotion = false): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await instrumentScenes(page);
  await openScenePage(page, { reducedMotion });
  await showTheme(page, THEME);
  await waitFrames(page, 3);
}

test.describe("a colour scheme change", () => {
  for (const reducedMotion of [false, true]) {
    test(`repaints the canvas and back, ${reducedMotion ? "with the scene still" : "with the train running"}`, async ({
      page,
    }) => {
      await open(page, reducedMotion);
      await setColorScheme(page, "light");
      await waitFrames(page, 3);
      const light = await canvasPalette(page, THEME);
      expect(light.length).toBeGreaterThan(0);

      await setColorScheme(page, "dark");
      await expect.poll(() => canvasPalette(page, THEME)).not.toEqual(light);

      await setColorScheme(page, "light");
      await expect.poll(() => canvasPalette(page, THEME)).toEqual(light);
    });
  }
});

test.describe("a stopped train", () => {
  test.describe.configure({ timeout: 60_000 });

  test("once at rest, the whole canvas holds, steam and crowd included", async ({
    page,
  }) => {
    await open(page);
    await liveryButton(page, THEME, "steam").click();
    const running = await canvasFingerprint(page, THEME);
    await expect.poll(() => canvasFingerprint(page, THEME)).not.toBe(running);

    await toggle(page, THEME).click();
    await expectToggle(page, THEME, STOPPED_TOGGLE);
    await waitForTrainAtRest(page, THEME);
    await waitFrames(page, 3);

    const held = await canvasFingerprint(page, THEME);
    const clocks = await worldClocks(page);
    const draws = await drawCount(page, THEME);
    await waitFrames(page, 30);

    expect(await drawCount(page, THEME)).toBeGreaterThan(draws);
    expect(await canvasFingerprint(page, THEME)).toBe(held);
    expect(await worldClocks(page)).toEqual(clocks);
  });
});

test.describe("a reduced-motion start at full width (E18)", () => {
  test("rolls the text while the scene stays still", async ({ page }) => {
    await rewriteThemeHtml(
      page,
      THEME,
      nowItemsHtml([
        ["Playing", "Spider-Man"],
        ["Building", "this site"],
      ]),
    );
    await open(page, true);
    await expectToggle(page, THEME, REDUCED_START_TOGGLE);

    const band = await readBillboardBand(page);
    const town = await readTownBelowBillboard(page);
    const cars = await carsSeenBy(page, THEME);
    const { time } = await worldClocks(page);

    await waitForVisibleRoll(page);
    await waitFrames(page, 3);

    expect(samePixels(band, await readBillboardBand(page))).toBe(false);
    expect(samePixels(town, await readTownBelowBillboard(page))).toBe(true);
    expect(await carsSeenBy(page, THEME)).toEqual(cars);
    expect((await worldClocks(page)).time).toBe(time);
  });
});
