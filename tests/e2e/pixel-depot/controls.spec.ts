import type { Locator, Page } from "@playwright/test";
import { THEME_HOOKS } from "../../../src/scene/contract";
import {
  canvas,
  expect,
  expectToggle,
  findTrain,
  focusHero,
  liveryButton,
  openScenePage,
  pressedLiveries,
  pressedSpeeds,
  pressKey,
  pressTrain,
  REDUCED_START_TOGGLE,
  root,
  RUNNING_TOGGLE,
  scrollY,
  showTheme,
  speedButton,
  STOPPED_TOGGLE,
  test,
  toggle,
  toggleState,
  waitFrames,
} from "../scene/helpers";
import { readCanvasPixels, THEME } from "./support";

const WIDE = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
const MIN_TOUCH_HEIGHT = 44;
const PRESS_OFFSET = 4;

async function open(
  page: Page,
  viewport: { width: number; height: number },
  reducedMotion = false,
): Promise<void> {
  await page.setViewportSize(viewport);
  await openScenePage(page, { reducedMotion });
  await showTheme(page, THEME);
  await waitFrames(page, 3);
}

async function toggleBox(page: Page) {
  const box = await toggle(page, THEME).boundingBox();
  if (!box) throw new Error("The toggle is not showing.");
  return box;
}

const iconToLabelGap = (page: Page): Promise<number> =>
  toggle(page, THEME).evaluate((button, labelHook) => {
    const label = button.querySelector(labelHook);
    const icon = button.querySelector('[aria-hidden="true"]');
    if (!label || !icon) throw new Error("The toggle lacks an icon or label.");
    return (
      label.getBoundingClientRect().left - icon.getBoundingClientRect().right
    );
  }, THEME_HOOKS.toggleLabel);

async function pressJustOutside(
  page: Page,
  button: Locator,
  side: "above" | "below",
): Promise<void> {
  const box = await button.boundingBox();
  if (!box) throw new Error("The button is not showing.");
  await page.mouse.click(
    box.x + box.width / 2,
    side === "above" ? box.y - PRESS_OFFSET : box.y + box.height + PRESS_OFFSET,
  );
}

test.describe("the stop toggle", () => {
  test("keeps a touch height and one width across all three labels", async ({
    page,
  }) => {
    await open(page, WIDE, true);
    const pause = await toggleBox(page);
    expect((await toggleState(page, THEME)).label).toBe(
      REDUCED_START_TOGGLE.label,
    );
    await toggle(page, THEME).click();
    await expectToggle(page, THEME, STOPPED_TOGGLE);
    const start = await toggleBox(page);
    await toggle(page, THEME).click();
    await expectToggle(page, THEME, RUNNING_TOGGLE);
    const stop = await toggleBox(page);

    for (const box of [pause, start, stop]) {
      expect(box.height).toBeGreaterThanOrEqual(MIN_TOUCH_HEIGHT);
    }
    expect(start.width).toBeCloseTo(pause.width, 0);
    expect(stop.width).toBeCloseTo(pause.width, 0);
  });

  test("keeps one gap between its icon and its label across all three labels", async ({
    page,
  }) => {
    await open(page, WIDE, true);
    const pause = await iconToLabelGap(page);
    await toggle(page, THEME).click();
    await expectToggle(page, THEME, STOPPED_TOGGLE);
    const start = await iconToLabelGap(page);
    await toggle(page, THEME).click();
    await expectToggle(page, THEME, RUNNING_TOGGLE);
    const stop = await iconToLabelGap(page);

    expect(start).toBeCloseTo(pause, 0);
    expect(stop).toBeCloseTo(pause, 0);
  });

  test("has a touch height on a phone", async ({ page }) => {
    await open(page, PHONE);
    expect((await toggleBox(page)).height).toBeGreaterThanOrEqual(
      MIN_TOUCH_HEIGHT,
    );
  });
});

for (const [name, viewport] of [
  ["wide", WIDE],
  ["phone", PHONE],
] as const) {
  test.describe(`small controls, ${name}`, () => {
    test("each speed and livery button owns the space just above and below it", async ({
      page,
    }) => {
      await open(page, viewport);
      const misses = await root(page, THEME)
        .locator(`${THEME_HOOKS.speed}, ${THEME_HOOKS.livery}`)
        .evaluateAll(
          (buttons, offset) =>
            buttons.flatMap((button) => {
              const { left, right, top, bottom } =
                button.getBoundingClientRect();
              const x = (left + right) / 2;
              return [top - offset, bottom + offset].flatMap((y) =>
                document.elementFromPoint(x, y) === button
                  ? []
                  : [`${button.getAttribute("aria-label")} at y ${y}`],
              );
            }),
          PRESS_OFFSET,
        );
      expect(misses).toEqual([]);
    });

    test("a real press just outside a button takes effect", async ({
      page,
    }) => {
      await open(page, viewport);
      await pressJustOutside(page, speedButton(page, THEME, 2), "above");
      await expect.poll(() => pressedSpeeds(page, THEME)).toEqual([2]);

      await pressJustOutside(page, liveryButton(page, THEME, "toy"), "below");
      await expect.poll(() => pressedLiveries(page, THEME)).toEqual(["toy"]);
    });
  });

  test(`a press on the train stops it, ${name}`, async ({ page }) => {
    await open(page, viewport);
    await pressTrain(page, THEME);
    await expectToggle(page, THEME, STOPPED_TOGGLE);
  });

  test(`the pointer finds the train where it is drawn, ${name}`, async ({
    page,
  }) => {
    await open(page, viewport, true);
    if ((await toggleState(page, THEME)).label === REDUCED_START_TOGGLE.label) {
      await toggle(page, THEME).click();
    }
    await waitFrames(page, 3);
    const before = await readCanvasPixels(page);
    const current = await pressedLiveries(page, THEME);
    await liveryButton(
      page,
      THEME,
      current[0] === "toy" ? "steam" : "toy",
    ).click();
    await waitFrames(page, 3);
    const after = await readCanvasPixels(page);

    const changed = before.pixels.flatMap((pixel, index) =>
      pixel === after.pixels[index]
        ? []
        : [
            {
              column: index % before.width,
              row: Math.floor(index / before.width),
            },
          ],
    );
    expect(changed.length).toBeGreaterThan(0);

    const box = await canvas(page, THEME).boundingBox();
    if (!box) throw new Error("The canvas is not showing.");
    const cssPerPixel = box.width / before.width;
    const hit = await findTrain(page, THEME);
    const hitColumn = (hit.x - box.x) / cssPerPixel;
    const hitRow = (hit.y - box.y) / cssPerPixel;
    const columns = changed.map(({ column }) => column);
    const rows = changed.map(({ row }) => row);
    expect(hitColumn).toBeGreaterThanOrEqual(Math.min(...columns) - 1);
    expect(hitColumn).toBeLessThanOrEqual(Math.max(...columns) + 1);
    expect(hitRow).toBeGreaterThanOrEqual(Math.min(...rows) - 1);
    expect(hitRow).toBeLessThanOrEqual(Math.max(...rows) + 1);
  });
}

test.describe("the keyboard on the focused hero", () => {
  test("ArrowRight raises the speed and Space stops, without scrolling the page", async ({
    page,
  }) => {
    await open(page, WIDE);
    await focusHero(page, THEME);
    const [speed] = await pressedSpeeds(page, THEME);

    await pressKey(page, "ArrowRight");
    await expect.poll(() => pressedSpeeds(page, THEME)).toEqual([speed + 1]);

    await pressKey(page, " ");
    await expectToggle(page, THEME, STOPPED_TOGGLE);
    expect(await scrollY(page)).toBe(0);
  });
});
