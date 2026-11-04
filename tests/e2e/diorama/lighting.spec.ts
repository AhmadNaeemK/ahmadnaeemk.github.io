import type { Page } from "@playwright/test";
import { createWorld } from "../../../src/rail";
import type { WorldView } from "../../../src/rail";
import { THEME_HOOKS } from "../../../src/scene/contract";
import { worldStartOptions } from "../../../src/scene/world-start";
import { buildDecor } from "../../../src/themes/diorama/decor";
import { readPalette } from "../../../src/themes/diorama/palette";
import {
  FULL_VIEW,
  projectY,
  VIEW_WIDTH,
  VIEW_X0,
} from "../../../src/themes/diorama/view";
import {
  canvas,
  canvasPalette,
  expect,
  expectDrawing,
  root,
  selectTheme,
  setColorScheme,
  test,
  waitFrames,
} from "../scene/helpers";
import {
  canvasBrightness,
  DESKTOP,
  DIORAMA,
  expectSceneState,
  openDiorama,
} from "./support";

test.use({ viewport: DESKTOP });

const pageToggle = (page: Page) =>
  root(page, DIORAMA).locator(THEME_HOOKS.colorSchemeToggle);

/** Night has reached the canvas: other colours, darker overall, and it still runs. */
async function expectTurnedDark(
  page: Page,
  day: { palette: string[]; brightness: number },
) {
  await expect
    .poll(() => canvasPalette(page, DIORAMA))
    .not.toEqual(day.palette);
  expect(await canvasBrightness(page, DIORAMA)).toBeLessThan(day.brightness);
  await expectDrawing(page, DIORAMA);
}

const readLighting = async (page: Page) => ({
  palette: await canvasPalette(page, DIORAMA),
  brightness: await canvasBrightness(page, DIORAMA),
});

test.describe("day and night", () => {
  test("the page's toggle turns the running scene to night and back", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openDiorama(page);
    await waitFrames(page, 3);
    const day = await readLighting(page);

    await pageToggle(page).click();
    await expectTurnedDark(page, day);

    await pageToggle(page).click();
    await expect.poll(() => canvasPalette(page, DIORAMA)).toEqual(day.palette);
    await expectDrawing(page, DIORAMA);
  });

  test("a change of the system's scheme turns the running scene to night and back", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openDiorama(page);
    await waitFrames(page, 3);
    const day = await readLighting(page);

    await page.emulateMedia({ colorScheme: "dark" });
    await expectTurnedDark(page, day);

    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => canvasPalette(page, DIORAMA)).toEqual(day.palette);
  });

  test("a scheme changed while the theme is hidden shows from its first frame back", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openDiorama(page);
    await waitFrames(page, 3);
    const day = await readLighting(page);

    await selectTheme(page, "interchange");
    await expectSceneState(page, "interchange", "running");
    await setColorScheme(page, "dark");
    await selectTheme(page, DIORAMA);
    await expectSceneState(page, DIORAMA, "running");

    expect(await canvasPalette(page, DIORAMA)).not.toEqual(day.palette);
    expect(await canvasBrightness(page, DIORAMA)).toBeLessThan(day.brightness);
  });

  test("every token the canvas paints with is set, by day and by night", async ({
    page,
  }) => {
    const tokens: string[] = [];
    readPalette((token) => {
      tokens.push(token);
      return "";
    });
    await openDiorama(page);

    for (const scheme of ["light", "dark"] as const) {
      await setColorScheme(page, scheme);
      const unset = await root(page, DIORAMA).evaluate((element, names) => {
        const styles = getComputedStyle(element);
        return names.filter((name) => !styles.getPropertyValue(name).trim());
      }, tokens);
      expect(unset, `unset tokens in ${scheme}`).toEqual([]);
    }
  });
});

/** Well above a lamp's surroundings by day, and well below its light by night. */
const LAMP_LIFT = 15;

/** Standing where the scene lights them, from the same world and scenery. */
const lampsOnTheBoard = () => {
  const world = createWorld(
    worldStartOptions({
      firstTheme: DIORAMA,
      savedLivery: null,
      reducedMotion: false,
    }),
  ) as WorldView;
  return buildDecor(world).flatMap((decor) =>
    decor.type === "lamp"
      ? [{ x: decor.x - VIEW_X0, y: projectY(decor.y, 15) - FULL_VIEW.y0 }]
      : [],
  );
};

/**
 * For each lamp, how much brighter the board is close by than a little further out.
 * Medians, so a passing car or a tree in one ring does not decide it.
 */
const lampLift = (page: Page): Promise<number[]> =>
  canvas(page, DIORAMA).evaluate(
    (element: HTMLCanvasElement, { lamps, viewWidth }) => {
      const context = element.getContext("2d");
      if (!context) return [];
      const scale = element.width / viewWidth;
      const { data, width, height } = context.getImageData(
        0,
        0,
        element.width,
        element.height,
      );
      const brightnessOfRing = (
        lamp: { x: number; y: number },
        inner: number,
        outer: number,
      ) => {
        const values: number[] = [];
        for (let dy = -outer; dy <= outer; dy += 0.5) {
          for (let dx = -outer; dx <= outer; dx += 0.5) {
            const distance = Math.hypot(dx, dy);
            if (distance < inner || distance > outer) continue;
            const px = Math.round((lamp.x + dx) * scale);
            const py = Math.round((lamp.y + dy) * scale);
            if (px < 0 || py < 0 || px >= width || py >= height) continue;
            const i = (py * width + px) * 4;
            values.push(data[i] + data[i + 1] + data[i + 2]);
          }
        }
        values.sort((a, b) => a - b);
        return values[Math.floor(values.length / 2)] / 3;
      };
      return lamps.map(
        (lamp) => brightnessOfRing(lamp, 3, 9) - brightnessOfRing(lamp, 26, 34),
      );
    },
    { lamps: lampsOnTheBoard(), viewWidth: VIEW_WIDTH },
  );

test("at night the lamps light the board around them, and by day they do not", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openDiorama(page);
  await waitFrames(page, 3);
  const day = await lampLift(page);
  await setColorScheme(page, "dark");
  await waitFrames(page, 3);
  const night = await lampLift(page);

  expect(day.length).toBeGreaterThan(0);
  for (const lift of day) expect(lift).toBeLessThan(LAMP_LIFT);
  for (const lift of night) expect(lift).toBeGreaterThan(LAMP_LIFT);
});
