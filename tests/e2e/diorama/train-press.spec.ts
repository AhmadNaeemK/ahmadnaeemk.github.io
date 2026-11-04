import type { Page } from "@playwright/test";
import {
  COMPACT_SCENE_WIDTH,
  HIT_RADIUS,
  THEME_HOOKS,
  THEME_ROOT_ATTRIBUTE,
} from "../../../src/scene/contract";
import {
  COMPACT_VIEW,
  FULL_VIEW,
  GROUND_SQUASH,
  VIEW_WIDTH,
  VIEW_X0,
} from "../../../src/themes/diorama/view";
import {
  expect,
  expectToggle,
  pressTrain,
  RUNNING_TOGGLE,
  STOPPED_TOGGLE,
  test,
  toggle,
  waitFrames,
} from "../scene/helpers";
import {
  carDrawnAt,
  DESKTOP,
  DIORAMA,
  groundBelowCar,
  ON_THE_BRIDGE,
  ON_THE_GROUND,
  openDiorama,
  PHONE,
  restTrainAt,
  TRAIN_JOURNEY_TEST_TIMEOUT_MS,
  type ViewportPoint,
} from "./support";

type Press = (page: Page, point: ViewportPoint) => Promise<void>;

const WIDTHS: readonly {
  readonly name: string;
  readonly use: Parameters<typeof test.use>[0];
  readonly press: Press;
}[] = [
  {
    name: "a desktop width, by mouse",
    use: { viewport: DESKTOP },
    press: (page, { x, y }) => page.mouse.click(x, y),
  },
  {
    name: "a phone width, by touch",
    use: { viewport: PHONE, hasTouch: true },
    press: (page, { x, y }) => page.touchscreen.tap(x, y),
  },
];

/**
 * Clicks the spot on the board farthest from every car, all in one task so a moving
 * train cannot get there first. Returns how far off that was, in world units.
 */
const clickEmptyBoard = (page: Page): Promise<number> =>
  page.evaluate(
    ({
      theme,
      canvasHook,
      rootHook,
      squash,
      x0,
      width,
      compactWidth,
      fullY0,
      compactY0,
    }) => {
      const element = document.querySelector<HTMLCanvasElement>(
        `[${rootHook}="${theme}"] ${canvasHook}`,
      );
      if (!element) throw new Error("No canvas.");
      const box = element.getBoundingClientRect();
      const scale = box.width / width;
      const y0 = box.width < compactWidth ? compactY0 : fullY0;
      const { cars } = window.__sceneSpy.contexts[theme].world;
      let best = { x: 0, y: 0, distance: -1 };
      for (let py = 4; py < box.height; py += 8) {
        for (let px = 4; px < box.width; px += 8) {
          const viewX = px / scale + x0;
          const viewY = py / scale + y0;
          const distance = Math.min(
            ...cars.map((car) =>
              Math.hypot(
                car.x - viewX,
                // In the view, so a lifted car counts where it is drawn.
                (car.y * squash - car.z - viewY) / squash,
              ),
            ),
          );
          if (distance > best.distance) best = { x: px, y: py, distance };
        }
      }
      element.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX: box.left + best.x,
          clientY: box.top + best.y,
        }),
      );
      return best.distance;
    },
    {
      theme: DIORAMA,
      canvasHook: THEME_HOOKS.canvas,
      rootHook: THEME_ROOT_ATTRIBUTE,
      squash: GROUND_SQUASH,
      x0: VIEW_X0,
      width: VIEW_WIDTH,
      compactWidth: COMPACT_SCENE_WIDTH,
      fullY0: FULL_VIEW.y0,
      compactY0: COMPACT_VIEW.y0,
    },
  );

for (const { name, use, press } of WIDTHS) {
  test.describe(`pressing the train at ${name}`, () => {
    test.use(use);
    test.setTimeout(TRAIN_JOURNEY_TEST_TIMEOUT_MS);

    test("it starts and stops on the ground", async ({ page }) => {
      await openDiorama(page, { readWorld: true });
      const [, car] = await restTrainAt(page, ON_THE_GROUND);

      await press(page, await carDrawnAt(page, car));
      await expectToggle(page, DIORAMA, RUNNING_TOGGLE);

      await pressTrain(page, DIORAMA);
      await expectToggle(page, DIORAMA, STOPPED_TOGGLE);
    });

    test("it starts on the bridge where it is drawn, not on the ground below", async ({
      page,
    }) => {
      await openDiorama(page, { readWorld: true });
      const [, car] = await restTrainAt(page, ON_THE_BRIDGE);

      await press(page, await groundBelowCar(page, car));
      await waitFrames(page, 3);
      await expectToggle(page, DIORAMA, STOPPED_TOGGLE);

      await press(page, await carDrawnAt(page, car));
      await expectToggle(page, DIORAMA, RUNNING_TOGGLE);
    });

    test("a press on the empty board does nothing, stopped or running", async ({
      page,
    }) => {
      await openDiorama(page, { readWorld: true });
      expect(await clickEmptyBoard(page)).toBeGreaterThan(HIT_RADIUS.click);
      await waitFrames(page, 3);
      await expectToggle(page, DIORAMA, RUNNING_TOGGLE);

      await toggle(page, DIORAMA).click();
      await expectToggle(page, DIORAMA, STOPPED_TOGGLE);
      expect(await clickEmptyBoard(page)).toBeGreaterThan(HIT_RADIUS.click);
      await waitFrames(page, 3);
      await expectToggle(page, DIORAMA, STOPPED_TOGGLE);
    });
  });
}
