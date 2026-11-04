/**
 * What Diorama's specs share. A test sees the page through the contract's hooks and
 * the canvas's pixels, and reads the world the runtime hands the scene, so it knows
 * where the train is drawn without asking the scene's hit-test.
 */
import type { Page } from "@playwright/test";
import {
  COMPACT_SCENE_WIDTH,
  SCENE_STATE_ATTRIBUTE,
  THEME_HOOKS,
  THEME_ROOT_ATTRIBUTE,
  themeHash,
  type ThemeName,
} from "../../../src/scene/contract";
import {
  COMPACT_VIEW,
  FULL_VIEW,
  projectY,
  VIEW_WIDTH,
  VIEW_X0,
} from "../../../src/themes/diorama/view";
import {
  addSceneSpy,
  canvas,
  expect,
  expectToggle,
  instrumentScenes,
  root,
  STOPPED_TOGGLE,
  toggle,
  waitForTrainAtRest,
} from "../scene/helpers";

export const DIORAMA: ThemeName = "diorama";

export const DESKTOP = { width: 1280, height: 720 } as const;
export const PHONE = { width: 390, height: 844 } as const;

/** Reading these specs' results at a load near 400 needs far more than the default. */
export const LOADED_MACHINE_TIMEOUT_MS = 30_000;
/** Waiting for the train to come round, at the machine's own frame rate. */
export const TRAIN_JOURNEY_TEST_TIMEOUT_MS = 180_000;
const TRAIN_JOURNEY_TIMEOUT_MS = 120_000;

interface OpenOptions {
  readonly reducedMotion?: boolean;
  /** Lets a spec read the world the scene sees. */
  readonly readWorld?: boolean;
}

/** A first visit straight to Diorama, with its scene running. */
export async function openDiorama(
  page: Page,
  { reducedMotion = false, readWorld = false }: OpenOptions = {},
): Promise<void> {
  if (reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
  await addSceneSpy(page);
  if (readWorld) await instrumentScenes(page);
  await page.goto(`/${themeHash(DIORAMA)}`);
  await expectSceneState(page, DIORAMA, "running");
}

export const expectSceneState = (
  page: Page,
  theme: ThemeName,
  state: string,
): Promise<void> =>
  expect(root(page, theme)).toHaveAttribute(SCENE_STATE_ATTRIBUTE, state, {
    timeout: LOADED_MACHINE_TIMEOUT_MS,
  });

export interface CarNow {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly hidden: boolean;
}

/** Needs `readWorld`. */
export const carsNow = (page: Page): Promise<CarNow[]> =>
  page.evaluate(
    (theme) =>
      window.__sceneSpy.contexts[theme].world.cars.map(
        ({ x, y, z, hidden }) => ({ x, y, z, hidden }),
      ),
    DIORAMA,
  );

/** How high above the rail the middle of a car is drawn. */
const CAR_DRAWN_MIDDLE = 6;

export interface ViewportPoint {
  readonly x: number;
  readonly y: number;
}

/** Where the scene draws a world position, in viewport coordinates. */
async function drawnAt(
  page: Page,
  world: { readonly x: number; readonly y: number; readonly height: number },
): Promise<ViewportPoint> {
  const box = await canvas(page, DIORAMA).boundingBox();
  if (!box) throw new Error("The canvas is not showing.");
  const view = box.width < COMPACT_SCENE_WIDTH ? COMPACT_VIEW : FULL_VIEW;
  const scale = box.width / VIEW_WIDTH;
  return {
    x: box.x + (world.x - VIEW_X0) * scale,
    y: box.y + (projectY(world.y, world.height) - view.y0) * scale,
  };
}

/** The middle of a car as the visitor sees it, lifted by the bridge if it is on it. */
export const carDrawnAt = (page: Page, car: CarNow): Promise<ViewportPoint> =>
  drawnAt(page, { x: car.x, y: car.y, height: car.z + CAR_DRAWN_MIDDLE });

/** The spot on the ground straight below that car, ignoring its height. */
export const groundBelowCar = (
  page: Page,
  car: CarNow,
): Promise<ViewportPoint> => drawnAt(page, { x: car.x, y: car.y, height: 0 });

/** Which part of the track the whole train has to be on. */
export interface TrackPlace {
  readonly name: string;
  readonly lowestZ: number;
  readonly highestZ: number;
}

export const ON_THE_GROUND: TrackPlace = {
  name: "on the ground",
  lowestZ: 0,
  highestZ: 0,
};
/** High enough that a car's drawn middle is out of click range of its ground spot. */
export const ON_THE_BRIDGE: TrackPlace = {
  name: "on the bridge",
  lowestZ: 12,
  highestZ: 1000,
};

const isAt = (cars: readonly CarNow[], place: TrackPlace) =>
  cars.every(
    (car) => !car.hidden && car.z >= place.lowestZ && car.z <= place.highestZ,
  );

/**
 * Stops the train so it rests wholly in a place, by pressing the control in the
 * frame it gets there. It brakes over some distance and can roll out of the place,
 * even into a tunnel where it cannot be pressed, so it goes round again if it did.
 */
export async function restTrainAt(
  page: Page,
  place: TrackPlace,
): Promise<CarNow[]> {
  let resting: CarNow[] = [];
  await expect(async () => {
    await page.evaluate(
      ({ theme, toggleHook, rootHook, lowestZ, highestZ }) =>
        new Promise<void>((resolve) => {
          const button = document.querySelector<HTMLElement>(
            `[${rootHook}="${theme}"] ${toggleHook}`,
          );
          const check = () => {
            const { cars } = window.__sceneSpy.contexts[theme].world;
            const arrived = cars.every(
              (car) => !car.hidden && car.z >= lowestZ && car.z <= highestZ,
            );
            if (arrived) {
              button?.click();
              resolve();
            } else {
              window.__sceneSpy.rawFrame(check);
            }
          };
          check();
        }),
      {
        theme: DIORAMA,
        toggleHook: THEME_HOOKS.toggle,
        rootHook: THEME_ROOT_ATTRIBUTE,
        lowestZ: place.lowestZ,
        highestZ: place.highestZ,
      },
    );
    await waitForTrainAtRest(page, DIORAMA);
    resting = await carsNow(page);
    if (!isAt(resting, place)) {
      await toggle(page, DIORAMA).click();
      throw new Error(`The train rolled out of "${place.name}" as it braked.`);
    }
  }).toPass({ intervals: [0], timeout: TRAIN_JOURNEY_TIMEOUT_MS });
  await expectToggle(page, DIORAMA, STOPPED_TOGGLE);
  return resting;
}

/** Every pixel row of the canvas as one number, to see which rows change. */
export const canvasRows = (page: Page, theme: ThemeName): Promise<number[]> =>
  canvas(page, theme).evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("2d");
    if (!context) return [];
    const { data } = context.getImageData(0, 0, element.width, element.height);
    const rows: number[] = [];
    for (let row = 0; row < element.height; row += 1) {
      let hash = 0;
      const start = row * element.width * 4;
      const end = start + element.width * 4;
      for (let i = start; i < end; i += 1) hash = (hash * 31 + data[i]) | 0;
      rows.push(hash);
    }
    return rows;
  });

/** How bright the canvas is on average, from 0 to 255. */
export const canvasBrightness = (page: Page, theme: ThemeName) =>
  canvas(page, theme).evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("2d");
    if (!context) return 0;
    const { data } = context.getImageData(0, 0, element.width, element.height);
    let sum = 0;
    let painted = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
      painted += 1;
    }
    return painted === 0 ? 0 : sum / painted;
  });
