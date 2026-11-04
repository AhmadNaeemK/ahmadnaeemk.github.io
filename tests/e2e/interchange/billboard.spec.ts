import { type Page } from "@playwright/test";
import { THEME_HOOKS } from "../../../src/scene/contract";
import {
  expect,
  expectDrawing,
  expectToggle,
  hero,
  isNowLineShowing,
  nowMode,
  openScenePage,
  REDUCED_START_TOGGLE,
  root,
  STOPPED_TOGGLE,
  test,
  toggle,
  waitFrames,
} from "../scene/helpers";
import {
  clearCanvasTexts,
  DESKTOP,
  lastBoardTexts,
  logCanvasTexts,
  THEME,
} from "./support";

const FRAME_AT_THE_COMPACT_LINE = 600;
/** The hero's side padding. Checked below, so a change shows as itself. */
const FRAME_PADDING_PX = 40;
const VIEWPORT_HEIGHT = 800;

const frameWidth = (page: Page) =>
  root(page, THEME)
    .locator(THEME_HOOKS.sceneFrame)
    .evaluate((frame) => frame.clientWidth);

/** Waits out the resize, which lands on the frame after a size change. */
async function expectBoard(page: Page): Promise<void> {
  await expect.poll(() => nowMode(page, THEME)).toBe("board");
  await clearCanvasTexts(page);
  await expect
    .poll(async () => (await lastBoardTexts(page)).length, {
      message: "the board was not drawn",
    })
    .toBeGreaterThan(0);
  expect(await isNowLineShowing(page, THEME)).toBe(false);
}

async function expectNoBoard(page: Page): Promise<void> {
  await expect.poll(() => nowMode(page, THEME)).toBe("html");
  // A draw from before the change could still be in the log.
  await waitFrames(page, 2);
  await clearCanvasTexts(page);
  await expectDrawing(page, THEME);
  expect(await lastBoardTexts(page)).toEqual([]);
  expect(await isNowLineShowing(page, THEME)).toBe(true);
  await expect(hero(page, THEME).locator(".now")).toBeVisible();
}

test.describe("where the billboard goes", () => {
  test.beforeEach(async ({ page }) => {
    await logCanvasTexts(page);
  });

  test("at full width the board is drawn and the line is left to screen readers", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await openScenePage(page);
    await expectBoard(page);
  });

  test("a frame of exactly 600 px still draws it, and one narrower does not", async ({
    page,
  }) => {
    await page.setViewportSize({
      width: FRAME_AT_THE_COMPACT_LINE + FRAME_PADDING_PX,
      height: VIEWPORT_HEIGHT,
    });
    await openScenePage(page);
    expect(await frameWidth(page)).toBe(FRAME_AT_THE_COMPACT_LINE);
    await expectBoard(page);

    await page.setViewportSize({
      width: FRAME_AT_THE_COMPACT_LINE + FRAME_PADDING_PX - 1,
      height: VIEWPORT_HEIGHT,
    });
    await expect
      .poll(() => frameWidth(page))
      .toBeLessThan(FRAME_AT_THE_COMPACT_LINE);
    await expectNoBoard(page);
  });

  test("narrowing and widening a running page moves between the two", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await openScenePage(page);
    await expectBoard(page);

    await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
    await expectNoBoard(page);

    await page.setViewportSize(DESKTOP);
    await expectBoard(page);
  });
});

test.describe("what the board rolls", () => {
  test.use({ viewport: DESKTOP });

  /**
   * Where the first rolled segment was last drawn: it moves only as the text rolls.
   * The log is not cleared first, because a paused scene draws nothing more to fill it.
   */
  const rollPosition = async (page: Page) => {
    await expect
      .poll(async () => (await lastBoardTexts(page)).length)
      .toBeGreaterThan(1);
    const [, firstSegment] = await lastBoardTexts(page);
    return firstSegment.box.x;
  };

  test("the loop ends in whitespace, so its end does not run into its start", async ({
    page,
  }) => {
    await logCanvasTexts(page);
    await openScenePage(page);
    await expect
      .poll(async () => (await lastBoardTexts(page)).length)
      .toBeGreaterThan(1);

    const texts = await lastBoardTexts(page);
    expect(texts.at(-1)?.text).toMatch(/\s$/);
  });

  test("with reduced motion the train holds still but the text rolls until paused", async ({
    page,
  }) => {
    await logCanvasTexts(page);
    await openScenePage(page, { reducedMotion: true });
    await expectToggle(page, THEME, REDUCED_START_TOGGLE);

    const start = await rollPosition(page);
    await expect.poll(() => rollPosition(page)).not.toBe(start);

    await toggle(page, THEME).click();
    await expectToggle(page, THEME, STOPPED_TOGGLE);
    await waitFrames(page, 2);
    const paused = await rollPosition(page);
    await waitFrames(page, 30);
    expect(await rollPosition(page)).toBe(paused);
  });
});
