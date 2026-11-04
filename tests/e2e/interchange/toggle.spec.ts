import { type Locator, type Page } from "@playwright/test";
import { THEME_HOOKS } from "../../../src/scene/contract";
import {
  expect,
  expectToggle,
  openScenePage,
  pressedSpeeds,
  REDUCED_START_TOGGLE,
  root,
  RUNNING_TOGGLE,
  speedButton,
  STOPPED_TOGGLE,
  test,
  toggle,
} from "../scene/helpers";
import {
  coloursBySize,
  decodeScreenshot,
  DESKTOP,
  PHONE,
  THEME,
} from "./support";

const TOUCH_TARGET_PX = 44;
/** Heights land on fractions of a pixel, differently per browser. */
const SAME_HEIGHT_PX = 1.5;

/**
 * From the prototype's stylesheet: `.service` has 8px padding and a 1px border, and
 * `.service__signal` 4px padding. A number of its own, so that nothing the toggle's
 * rules do can move this along with the bar it is compared with.
 */
const PROTOTYPE_BAR_CHROME_PX = 2 * (8 + 1);
const PROTOTYPE_TOGGLE_PADDING_PX = 2 * 4;

const NARROWEST = { width: 320, height: 640 };
const BLOCK_CENTRES_IN_ONE_ROW_PX = 12;

const controls = (page: Page) =>
  root(page, THEME).locator(THEME_HOOKS.controls);

const heightOf = async (target: Locator) => {
  const box = await target.boundingBox();
  if (!box) throw new Error("Nothing to measure: it is not showing.");
  return box.height;
};

/** How many rows the bar's three parts have wrapped into. */
const barRows = (page: Page): Promise<number> =>
  controls(page).evaluate((bar, sameRow) => {
    const centres = [...bar.children]
      .map((part) => {
        const { top, height } = part.getBoundingClientRect();
        return top + height / 2;
      })
      .sort((a, b) => a - b);
    return centres.filter(
      (centre, index) => index === 0 || centre - centres[index - 1] > sameRow,
    ).length;
  }, BLOCK_CENTRES_IN_ONE_ROW_PX);

for (const [device, viewport] of [
  ["phone", PHONE],
  ["desktop", DESKTOP],
] as const) {
  test.describe(`on a ${device}`, () => {
    test.use({ viewport, hasTouch: true });

    test("a tap anywhere on the toggle's full height works it, top edge and bottom edge", async ({
      page,
    }) => {
      await openScenePage(page);
      const box = await toggle(page, THEME).boundingBox();
      if (!box) throw new Error("The toggle is not showing.");
      expect(box.height).toBeGreaterThanOrEqual(TOUCH_TARGET_PX);

      const middle = box.x + box.width / 2;
      await page.touchscreen.tap(middle, box.y + 2);
      await expectToggle(page, THEME, STOPPED_TOGGLE);
      await page.touchscreen.tap(middle, box.y + box.height - 2);
      await expectToggle(page, THEME, RUNNING_TOGGLE);
    });
  });
}

test.describe("on a desktop", () => {
  test.use({ viewport: DESKTOP });

  test("the bigger touch target leaves the service bar at the prototype's height", async ({
    page,
  }) => {
    await openScenePage(page);
    const labelHeight = await heightOf(
      toggle(page, THEME).locator(THEME_HOOKS.toggleLabel),
    );

    expect(await barRows(page)).toBe(1);
    expect(
      Math.abs(
        (await heightOf(controls(page))) -
          (labelHeight + PROTOTYPE_TOGGLE_PADDING_PX + PROTOTYPE_BAR_CHROME_PX),
      ),
    ).toBeLessThanOrEqual(SAME_HEIGHT_PX);
  });
});

test.describe("at 320 px", () => {
  test.use({ viewport: NARROWEST });

  test("the service bar stays two rows tall whichever label the toggle shows", async ({
    page,
  }) => {
    await openScenePage(page);
    const label = toggle(page, THEME).locator(THEME_HOOKS.toggleLabel);
    const height = await heightOf(controls(page));

    // Written directly, as a compact width never reaches "Pause the text" by a press.
    for (const text of [
      RUNNING_TOGGLE.label,
      REDUCED_START_TOGGLE.label,
      STOPPED_TOGGLE.label,
    ]) {
      await label.evaluate((element, written) => {
        element.textContent = written;
      }, text);

      expect(await barRows(page), `with "${text}"`).toBe(2);
      expect(
        Math.abs((await heightOf(controls(page))) - height),
        `with "${text}"`,
      ).toBeLessThanOrEqual(SAME_HEIGHT_PX);
    }
  });
});

test.describe("on a touch phone", () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  const SELECTED_INDEX = 3;
  const OTHER_INDEX = 1;

  /** The colour in the middle of a speed mark, as painted. */
  async function markColour(page: Page, index: number): Promise<number> {
    const box = await speedButton(page, THEME, index).boundingBox();
    if (!box) throw new Error("The speed mark is not showing.");
    const pixels = decodeScreenshot(
      await page.screenshot({
        clip: {
          x: Math.round(box.x + box.width / 2) - 1,
          y: Math.round(box.y + box.height / 2) - 1,
          width: 2,
          height: 2,
        },
        scale: "css",
      }),
    );
    return coloursBySize(pixels)[0][0];
  }

  test("a tapped speed mark looks the same as one selected without touching it", async ({
    page,
  }) => {
    await openScenePage(page);
    const selected = speedButton(page, THEME, SELECTED_INDEX);
    await selected.evaluate((element: HTMLElement) => {
      element.focus({ preventScroll: true });
      element.click();
      element.blur();
    });
    await expect
      .poll(() => pressedSpeeds(page, THEME))
      .toEqual([SELECTED_INDEX]);
    const untouched = await markColour(page, SELECTED_INDEX);
    expect(untouched).not.toBe(await markColour(page, OTHER_INDEX));

    await speedButton(page, THEME, OTHER_INDEX).tap();
    await expect.poll(() => pressedSpeeds(page, THEME)).toEqual([OTHER_INDEX]);
    await selected.tap();
    await expect
      .poll(() => pressedSpeeds(page, THEME))
      .toEqual([SELECTED_INDEX]);

    await expect.poll(() => markColour(page, SELECTED_INDEX)).toBe(untouched);
  });
});
