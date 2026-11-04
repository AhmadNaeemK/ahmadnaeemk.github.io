/** Finding the train through the page's own hover, and reading it from the world. */
import { expect, type Page } from "@playwright/test";
import {
  THEME_HOOKS,
  THEME_ROOT_ATTRIBUTE,
  type ThemeName,
} from "../../../src/scene/contract";
import { waitFrames } from "./page-actions";

export interface TrainHit {
  readonly x: number;
  readonly y: number;
  readonly hits: number;
}

/**
 * Finds the train through the page's own hover: it sweeps pointer moves over the
 * canvas and notes where the cursor becomes a pointer. Returns the hit nearest
 * their middle, in viewport coordinates, or null while the train is out of view,
 * such as inside a tunnel. All in one task, so the train cannot move meanwhile.
 */
export const sweepForTrain = (
  page: Page,
  theme: ThemeName,
  { pressIt = false }: { readonly pressIt?: boolean } = {},
): Promise<TrainHit | null> =>
  page.evaluate(
    ({ rootSelector, canvasSelector, press }) => {
      const element = document.querySelector<HTMLCanvasElement>(
        `${rootSelector} ${canvasSelector}`,
      );
      if (!element) return null;
      const { left, top, width, height } = element.getBoundingClientRect();
      const step = Math.max(4, Math.floor(width / 128));
      const points: { x: number; y: number }[] = [];
      const moveTo = (clientX: number, clientY: number) =>
        element.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            pointerType: "mouse",
            clientX,
            clientY,
          }),
        );
      for (let y = top + step / 2; y < top + height; y += step) {
        for (let x = left + step / 2; x < left + width; x += step) {
          moveTo(x, y);
          if (element.style.cursor === "pointer") points.push({ x, y });
        }
      }
      element.style.cursor = "";
      if (points.length === 0) return null;
      const middleX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
      const middleY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
      const distance = (p: { x: number; y: number }) =>
        Math.hypot(p.x - middleX, p.y - middleY);
      const nearest = points.reduce((best, p) =>
        distance(p) < distance(best) ? p : best,
      );
      if (press) {
        element.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            clientX: nearest.x,
            clientY: nearest.y,
          }),
        );
      }
      return { ...nearest, hits: points.length };
    },
    {
      rootSelector: `[${THEME_ROOT_ATTRIBUTE}="${theme}"]`,
      canvasSelector: THEME_HOOKS.canvas,
      press: pressIt,
    },
  );

/** Waits out a tunnel: a train out of view is on its way back unless stopped. */
export async function findTrain(
  page: Page,
  theme: ThemeName,
): Promise<TrainHit> {
  let found: TrainHit | null = null;
  await expect
    .poll(
      async () => {
        found = await sweepForTrain(page, theme);
        return found !== null;
      },
      {
        message: `no pointer hit anywhere on ${theme}'s canvas: check Scene.hitTrain, its projection, and that the train is drawn in view`,
      },
    )
    .toBe(true);
  return found as unknown as TrainHit;
}

/** Presses a moving train: finding and pressing it happen in one task. */
export async function pressTrain(page: Page, theme: ThemeName): Promise<void> {
  await expect
    .poll(
      async () =>
        (await sweepForTrain(page, theme, { pressIt: true })) !== null,
      {
        message: `no pointer hit to press on ${theme}'s canvas: check Scene.hitTrain, its projection, and that the train is drawn in view`,
      },
    )
    .toBe(true);
}

export interface CarPlace {
  readonly x: number;
  readonly y: number;
  readonly a: number;
}

/** Needs `instrumentScenes`. Reads the world each scene sees, so tunnels are no bar. */
export const carsSeenBy = (page: Page, theme: ThemeName): Promise<CarPlace[]> =>
  page.evaluate(
    (name) =>
      window.__sceneSpy.contexts[name].world.cars.map(({ x, y, a }) => ({
        x,
        y,
        a,
      })),
    theme,
  );

const TRAIN_MOVED_WORLD_UNITS = 30;
/** The real engine's train can be waiting at a station. */
const TRAIN_MOVE_TIMEOUT_MS = 20_000;

export async function waitForTrainToMove(
  page: Page,
  theme: ThemeName,
): Promise<void> {
  const [from] = await carsSeenBy(page, theme);
  await expect
    .poll(
      async () => {
        const [lead] = await carsSeenBy(page, theme);
        return Math.hypot(lead.x - from.x, lead.y - from.y);
      },
      {
        message: `the train did not move as seen by ${theme}: check that the runtime steps the world and hands scenes that world`,
        timeout: TRAIN_MOVE_TIMEOUT_MS,
      },
    )
    .toBeGreaterThan(TRAIN_MOVED_WORLD_UNITS);
}

/** Frames, as the world only moves when a frame steps it. */
const FRAMES_BETWEEN_READS = 10;

/** Where the train rests, once two reads a run of frames apart match exactly. */
export async function waitForTrainAtRest(
  page: Page,
  theme: ThemeName,
): Promise<CarPlace[]> {
  let previous: CarPlace[] = [];
  await expect
    .poll(
      async () => {
        await waitFrames(page, FRAMES_BETWEEN_READS);
        const current = await carsSeenBy(page, theme);
        const atRest = JSON.stringify(current) === JSON.stringify(previous);
        previous = current;
        return atRest;
      },
      {
        message: `the stopped train never came to rest as seen by ${theme}: check that the runtime's stop reaches the world`,
        intervals: [0],
        timeout: TRAIN_MOVE_TIMEOUT_MS,
      },
    )
    .toBe(true);
  return previous;
}
