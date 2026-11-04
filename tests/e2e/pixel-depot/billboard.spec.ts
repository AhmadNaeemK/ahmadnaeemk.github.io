import type { Page } from "@playwright/test";
import {
  expect,
  expectToggle,
  instrumentScenes,
  isNowLineShowing,
  nowMode,
  openScenePage,
  REDUCED_START_TOGGLE,
  RUNNING_TOGGLE,
  rewriteThemeHtml,
  showTheme,
  STOPPED_TOGGLE,
  test,
  toggle,
  waitFrames,
} from "../scene/helpers";
import {
  columnsWith,
  nowItemsHtml,
  readBillboardBand,
  samePixels,
  THEME,
  tokenColour,
  waitForVisibleRoll,
} from "./support";

type NowItems = readonly (readonly [string, string])[];

const SHORT_ITEM: NowItems = [["Reading", "Dune"]];
const TWO_ITEMS: NowItems = [
  ["Playing", "Spider-Man"],
  ["Building", "this site"],
];
const LONG_ITEM: NowItems = [
  [
    "Reading",
    "a very long single item about something that keeps on going and going, and then goes on a good while longer, well past the width of any board",
  ],
];

async function openWithItems(
  page: Page,
  items: NowItems,
  {
    reducedMotion = false,
    width = 1280,
  }: { reducedMotion?: boolean; width?: number } = {},
): Promise<void> {
  await page.setViewportSize({ width, height: 720 });
  await rewriteThemeHtml(page, THEME, nowItemsHtml(items));
  await instrumentScenes(page);
  await openScenePage(page, { reducedMotion });
  await showTheme(page, THEME);
  await waitFrames(page, 3);
}

async function expectBandToChange(page: Page): Promise<void> {
  const before = await readBillboardBand(page);
  await expect
    .poll(async () => samePixels(before, await readBillboardBand(page)))
    .toBe(false);
}

test.describe("the billboard at full width", () => {
  for (const reducedMotion of [false, true]) {
    const motion = reducedMotion ? "under reduced motion" : "in normal motion";

    test(`a single short item stays still ${motion}`, async ({ page }) => {
      await openWithItems(page, SHORT_ITEM, { reducedMotion });
      expect(await nowMode(page, THEME)).toBe("board");

      const before = await readBillboardBand(page);
      expect(
        columnsWith(before, await tokenColour(page, "--scene-board-value")),
        "the item's text is on the board",
      ).not.toBeNull();
      await waitForVisibleRoll(page);
      await waitFrames(page, 3);
      expect(samePixels(before, await readBillboardBand(page))).toBe(true);
    });

    test(`pressing the toggle freezes rolling text ${motion}`, async ({
      page,
    }) => {
      await openWithItems(page, TWO_ITEMS, { reducedMotion });
      await expectToggle(
        page,
        THEME,
        reducedMotion ? REDUCED_START_TOGGLE : RUNNING_TOGGLE,
      );
      await expectBandToChange(page);

      await toggle(page, THEME).click();
      await expectToggle(page, THEME, STOPPED_TOGGLE);
      await waitFrames(page, 3);
      const frozen = await readBillboardBand(page);
      await waitFrames(page, 30);
      expect(samePixels(frozen, await readBillboardBand(page))).toBe(true);

      await toggle(page, THEME).click();
      await expectToggle(page, THEME, RUNNING_TOGGLE);
      await expectBandToChange(page);
    });
  }

  test("two items roll", async ({ page }) => {
    await openWithItems(page, TWO_ITEMS);
    await expectBandToChange(page);
  });

  test("a single item too long for the board rolls", async ({ page }) => {
    await openWithItems(page, LONG_ITEM);
    await expectBandToChange(page);
  });

  test("a long item stays on the canvas and off the label at a 660 px viewport", async ({
    page,
  }) => {
    await openWithItems(page, LONG_ITEM, { width: 660 });
    expect(await nowMode(page, THEME)).toBe("board");
    await waitForVisibleRoll(page);

    const band = await readBillboardBand(page);
    const panel = columnsWith(band, await tokenColour(page, "--scene-board"));
    const label = columnsWith(
      band,
      await tokenColour(page, "--scene-board-label"),
    );
    const text = columnsWith(
      band,
      await tokenColour(page, "--scene-board-value"),
    );
    if (!panel || !label || !text) {
      throw new Error("The board's panel, label or text is not on the canvas.");
    }
    expect(label.first).toBeGreaterThan(0);
    expect(panel.last).toBeLessThan(band.width - 1);
    expect(text.first).toBeGreaterThan(label.last);
    expect(text.last).toBeLessThanOrEqual(panel.last);
  });

  test("a compact scene draws no board, as the HTML line shows instead", async ({
    page,
  }) => {
    await openWithItems(page, TWO_ITEMS, { width: 500 });
    expect(await nowMode(page, THEME)).toBe("html");
    expect(await isNowLineShowing(page, THEME)).toBe(true);
    const band = await readBillboardBand(page);
    expect(
      columnsWith(band, await tokenColour(page, "--scene-board")),
    ).toBeNull();
  });
});
