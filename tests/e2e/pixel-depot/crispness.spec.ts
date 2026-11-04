import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { themeHash } from "../../../src/scene/contract";
import {
  canvas,
  expect,
  openScenePage,
  REDUCED_START_TOGGLE,
  root,
  showTheme,
  test,
  toggle,
  toggleState,
  waitFrames,
} from "../scene/helpers";
import {
  bestBlockReport,
  decodePng,
  fewestWrongBlocks,
  readCanvasPixels,
  THEME,
} from "./support";

const PORTRAIT_FILE = resolve("src/content/assets/photos/portrait-px.png");
const PORTRAIT_SOURCE_WIDTH = 40;

interface Edges {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** A screenshot clip of whole CSS pixels, none of them shared with what surrounds it. */
const wholePixelsInside = ({ left, top, right, bottom }: Edges) => ({
  x: Math.ceil(left),
  y: Math.ceil(top),
  width: Math.floor(right) - Math.ceil(left),
  height: Math.floor(bottom) - Math.ceil(top),
});

const edgesOf = (element: Element): Edges => {
  const { left, top, right, bottom } = element.getBoundingClientRect();
  return { left, top, right, bottom };
};

/** Where two boxes overlap. */
const overlapOf = (a: Edges, b: Edges): Edges => ({
  left: Math.max(a.left, b.left),
  top: Math.max(a.top, b.top),
  right: Math.min(a.right, b.right),
  bottom: Math.min(a.bottom, b.bottom),
});

/** A town has far more colours than this, so a blank canvas cannot pass as crisp. */
const FEWEST_TOWN_COLOURS = 20;

const waitTwoFrames = (page: Page): Promise<void> =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );

for (const deviceScaleFactor of [1, 2]) {
  test.describe(`the canvas at a device pixel ratio of ${deviceScaleFactor}`, () => {
    test.use({ deviceScaleFactor });
    test.describe.configure({ timeout: 90_000 });

    for (const width of [320, 700, 999, 1001, 1280]) {
      test(`shows every buffer pixel as a solid block at ${width} px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 });
        await openScenePage(page, { reducedMotion: true });
        await showTheme(page, THEME);
        await waitFrames(page, 3);
        // Holds the canvas still, so the screenshot and the buffer are one frame.
        const { label } = await toggleState(page, THEME);
        if (label === REDUCED_START_TOGGLE.label) {
          await toggle(page, THEME).click();
        }
        await waitFrames(page, 3);

        const box = await canvas(page, THEME).evaluate(edgesOf);
        const parentBox = await canvas(page, THEME)
          .locator("..")
          .evaluate(edgesOf);
        const buffer = await readCanvasPixels(page);
        const pixelSize = (box.right - box.left) / buffer.width;
        expect(Number.isInteger(pixelSize)).toBe(true);

        // The canvas may outgrow its `overflow: hidden` parent by under a buffer row,
        // as the contract allows. A visitor never sees that part, so the crop stops at
        // the parent: past it, the clipped row would read as a row of mixed blocks.
        const image = decodePng(
          await page.screenshot({
            clip: wholePixelsInside(overlapOf(box, parentBox)),
          }),
        );
        expect(new Set(image.pixels).size).toBeGreaterThan(FEWEST_TOWN_COLOURS);

        const block = pixelSize * deviceScaleFactor;
        const report = bestBlockReport(image, block);
        expect(report.total).toBeGreaterThan(0);
        expect(report.mixed).toBe(0);
        expect(fewestWrongBlocks(image, buffer, block, report)).toBe(0);
      });
    }

    test("the portrait shows only the source file's colours, none blended", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/${themeHash(THEME)}`);
      const portrait = root(page, THEME).locator('img[src*="portrait-px"]');
      // It stays clear of the pinned header, which `scrollIntoViewIfNeeded` does not.
      await portrait.evaluate((image) =>
        image.scrollIntoView({ block: "center", behavior: "instant" }),
      );
      await expect
        .poll(() =>
          portrait.evaluate((image: HTMLImageElement) => image.naturalWidth),
        )
        .toBeGreaterThan(0);
      await root(page, THEME)
        .locator(".portrait__full")
        .evaluate((sharp: HTMLElement) => {
          sharp.style.visibility = "hidden";
        });
      await waitTwoFrames(page);

      const box = await portrait.evaluate((image) => {
        const { left, top, right, bottom } = image.getBoundingClientRect();
        return { left, top, right, bottom };
      });
      const shown = decodePng(
        await page.screenshot({ clip: wholePixelsInside(box) }),
      );
      expect(shown.width).toBeGreaterThan(
        PORTRAIT_SOURCE_WIDTH * deviceScaleFactor,
      );

      const source = new Set(decodePng(readFileSync(PORTRAIT_FILE)).pixels);
      const blended = [...new Set(shown.pixels)].filter(
        (colour) => !source.has(colour),
      );
      expect(blended).toEqual([]);
    });
  });
}
