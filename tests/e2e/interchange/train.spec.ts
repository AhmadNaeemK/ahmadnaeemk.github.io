import { type Page } from "@playwright/test";
import {
  canvas,
  expect,
  expectToggle,
  instrumentScenes,
  openScenePage,
  RUNNING_TOGGLE,
  speedButton,
  STOPPED_TOGGLE,
  sweepForTrain,
  test,
  toggle,
  waitForTrainAtRest,
  waitForTrainToMove,
  waitFrames,
} from "../scene/helpers";
import { DESKTOP, PHONE, THEME } from "./support";

interface Point {
  readonly x: number;
  readonly y: number;
}

const TUNNEL_RETRIES = 6;
/** Pixels that must change for a livery swap to prove a car is drawn there. */
const FEWEST_CAR_PIXELS = 12;
/** Half a car's length in the scene's units: the area a car's swap must change. */
const CAR_REACH_UNITS = 13;

/**
 * The middle of a car as the scene really drew it, in viewport coordinates, or null
 * while the train is out of view. It comes from the matrix the scene last drew with
 * and is proved by the pixels there changing with the livery, so it does not ask
 * `hitTrain`, and a hit test that disagrees with the drawing cannot pass by finding
 * its own answer, as a sweep for the pointer cursor would.
 */
const pointOnDrawnCar = (page: Page): Promise<Point | null> =>
  canvas(page, THEME).evaluate(
    async (element: HTMLCanvasElement, { theme, fewest, reach }) => {
      const context = element.getContext("2d");
      const root = element.closest("[data-rail-theme-root]");
      if (!context || !root) return null;
      const settleOn = async (id: string) => {
        root.querySelector<HTMLElement>(`[data-rail-livery="${id}"]`)?.click();
        for (let left = 3; left > 0; left -= 1) {
          await new Promise((resolve) => window.__sceneSpy.rawFrame(resolve));
        }
      };
      await settleOn("bullet");
      const before = context.getImageData(0, 0, element.width, element.height);
      await settleOn("metro");

      const { cars } = window.__sceneSpy.contexts[theme].world;
      const shown = cars.filter(({ hidden }) => !hidden);
      const car = shown[Math.floor(shown.length / 2)];
      if (!car) return null;
      const { a, d, e, f } = context.getTransform();
      const carX = a * car.x + e;
      const carY = d * car.y + f;
      const side = Math.ceil(a * reach * 2);
      const colourDiffers = (at: number) =>
        [0, 1, 2].some(
          (channel) => before.data[at + channel] !== after.data[at + channel],
        );
      const after = context.getImageData(0, 0, element.width, element.height);
      let changed = 0;
      const left = Math.max(0, Math.round(carX - side / 2));
      const top = Math.max(0, Math.round(carY - side / 2));
      for (let y = top; y < Math.min(element.height, top + side); y += 1) {
        for (let x = left; x < Math.min(element.width, left + side); x += 1) {
          if (colourDiffers((y * element.width + x) * 4)) changed += 1;
        }
      }
      if (changed < fewest) return null;
      const box = element.getBoundingClientRect();
      const scale = box.width / element.width;
      return { x: box.left + carX * scale, y: box.top + carY * scale };
    },
    { theme: THEME, fewest: FEWEST_CAR_PIXELS, reach: CAR_REACH_UNITS },
  );

/** A train can come to rest in a tunnel, so this starts it again until it rests in view. */
async function stopInView(page: Page): Promise<Point> {
  for (let attempt = 0; attempt < TUNNEL_RETRIES; attempt += 1) {
    await toggle(page, THEME).click();
    await expectToggle(page, THEME, STOPPED_TOGGLE);
    await waitForTrainAtRest(page, THEME);
    const point = await pointOnDrawnCar(page);
    if (point) return point;
    await toggle(page, THEME).click();
    await expectToggle(page, THEME, RUNNING_TOGGLE);
    await waitForTrainToMove(page, THEME);
  }
  throw new Error("The train never came to rest in view.");
}

const cursor = (page: Page) =>
  canvas(page, THEME).evaluate((element) => getComputedStyle(element).cursor);

/** The canvas corner furthest from `point`, which no train reaches from there. */
async function farCorner(page: Page, point: Point): Promise<Point> {
  const box = await canvas(page, THEME).boundingBox();
  if (!box) throw new Error("The canvas is not showing.");
  return {
    x: point.x < box.x + box.width / 2 ? box.x + box.width - 2 : box.x + 2,
    y: point.y < box.y + box.height / 2 ? box.y + box.height - 2 : box.y + 2,
  };
}

for (const [view, viewport] of [
  ["full", DESKTOP],
  ["compact", PHONE],
] as const) {
  test.describe(`in the ${view} view`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await instrumentScenes(page);
      await openScenePage(page);
    });

    test("the train answers hover and click where it is drawn, and the rest of the canvas does not", async ({
      page,
    }) => {
      test.slow();
      const onTrain = await stopInView(page);
      const miss = await farCorner(page, onTrain);

      await page.mouse.move(onTrain.x, onTrain.y);
      await expect.poll(() => cursor(page)).toBe("pointer");
      await page.mouse.move(miss.x, miss.y);
      await expect.poll(() => cursor(page)).not.toBe("pointer");

      await page.mouse.click(miss.x, miss.y);
      await waitFrames(page, 2);
      await expectToggle(page, THEME, STOPPED_TOGGLE);

      await page.mouse.click(onTrain.x, onTrain.y);
      await expectToggle(page, THEME, RUNNING_TOGGLE);
    });

    test("a click on the moving train stops it, and a click that misses leaves it running", async ({
      page,
    }) => {
      test.slow();
      // The slowest speed, so that it is still there when the pointer arrives.
      await speedButton(page, THEME, 0).click();
      await expectToggle(page, THEME, RUNNING_TOGGLE);

      await expect(async () => {
        const train = await sweepForTrain(page, THEME);
        if (!train) throw new Error("The train is out of view.");
        const miss = await farCorner(page, train);
        await page.mouse.click(miss.x, miss.y);
        await waitFrames(page, 1);
        await expectToggle(page, THEME, RUNNING_TOGGLE);
      }).toPass();

      await expect(async () => {
        const train = await sweepForTrain(page, THEME);
        if (!train) throw new Error("The train is out of view.");
        await page.mouse.click(train.x, train.y);
        await expect
          .poll(() => toggle(page, THEME).getAttribute("data-state"), {
            timeout: 500,
          })
          .toBe(STOPPED_TOGGLE.state);
      }).toPass();

      await expectToggle(page, THEME, STOPPED_TOGGLE);
      await waitForTrainAtRest(page, THEME);
    });
  });
}
