import type { Page } from "@playwright/test";
import { VIEW_WIDTH, FULL_VIEW } from "../../../src/themes/diorama/view";
import {
  canvas,
  canvasFingerprint,
  expect,
  expectDrawing,
  expectToggle,
  REDUCED_START_TOGGLE,
  STOPPED_TOGGLE,
  test,
  toggle,
  waitForTrainAtRest,
  waitFrames,
} from "../scene/helpers";
import {
  canvasRows,
  DESKTOP,
  DIORAMA,
  openDiorama,
  PHONE,
  TRAIN_JOURNEY_TEST_TIMEOUT_MS,
} from "./support";

const SCHEMES = ["light", "dark"] as const;
/** Long enough for anything still animating to change a pixel. */
const STILL_FRAMES = 30;

async function expectPixelIdenticalOverFrames(page: Page): Promise<void> {
  const first = await canvasFingerprint(page, DIORAMA);
  for (let read = 0; read < 3; read += 1) {
    await waitFrames(page, STILL_FRAMES / 3);
    expect(await canvasFingerprint(page, DIORAMA)).toBe(first);
  }
}

/** Two reads of what the canvas shows, until they differ, as they must when running. */
async function expectCanvasChanging(page: Page): Promise<void> {
  const first = await canvasFingerprint(page, DIORAMA);
  await expect.poll(() => canvasFingerprint(page, DIORAMA)).not.toBe(first);
}

/** Canvas rows at or below the top of the ground, which the board never reaches. */
const firstGroundRow = async (page: Page): Promise<number> => {
  const width = await canvas(page, DIORAMA).evaluate(
    (element: HTMLCanvasElement) => element.width,
  );
  return Math.floor(-FULL_VIEW.y0 * (width / VIEW_WIDTH));
};

for (const scheme of SCHEMES) {
  test.describe(`in the ${scheme} scheme`, () => {
    test.use({ colorScheme: scheme, viewport: DESKTOP });

    test("a stopped scene is pixel-identical once the train is at rest, and moves again when started", async ({
      page,
    }) => {
      test.setTimeout(TRAIN_JOURNEY_TEST_TIMEOUT_MS);
      await openDiorama(page, { readWorld: true });
      await expectCanvasChanging(page);

      await toggle(page, DIORAMA).click();
      await expectToggle(page, DIORAMA, STOPPED_TOGGLE);
      await waitForTrainAtRest(page, DIORAMA);
      await expectPixelIdenticalOverFrames(page);

      await toggle(page, DIORAMA).click();
      await expectCanvasChanging(page);
    });

    test("with reduced motion the board rolls while the ground holds, until the text is paused", async ({
      page,
    }) => {
      await openDiorama(page, { reducedMotion: true });
      await expectToggle(page, DIORAMA, REDUCED_START_TOGGLE);
      const groundStartsAt = await firstGroundRow(page);
      const before = await canvasRows(page, DIORAMA);

      await expect
        .poll(async () => {
          const now = await canvasRows(page, DIORAMA);
          return (
            now.slice(0, groundStartsAt).join() !==
            before.slice(0, groundStartsAt).join()
          );
        })
        .toBe(true);
      await waitFrames(page, STILL_FRAMES);
      const after = await canvasRows(page, DIORAMA);
      expect(after.slice(groundStartsAt)).toEqual(before.slice(groundStartsAt));

      await toggle(page, DIORAMA).click();
      await expectToggle(page, DIORAMA, STOPPED_TOGGLE);
      await waitFrames(page, 2);
      await expectPixelIdenticalOverFrames(page);
    });

    test("with reduced motion on a phone there is no board, so nothing moves at all", async ({
      page,
    }) => {
      await page.setViewportSize(PHONE);
      await openDiorama(page, { reducedMotion: true });
      await expectDrawing(page, DIORAMA);
      await expectToggle(page, DIORAMA, STOPPED_TOGGLE);
      await waitFrames(page, 2);
      await expectPixelIdenticalOverFrames(page);
    });
  });
}
