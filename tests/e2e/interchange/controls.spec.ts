import { type Locator, type Page } from "@playwright/test";
import { LIVERY_LABELS, LIVERY_ORDER, SPEEDS } from "../../../src/rail";
import {
  expect,
  expectToggle,
  focusHero,
  hero,
  liveryButton,
  openScenePage,
  pressedLiveries,
  pressedSpeeds,
  pressKey,
  root,
  RUNNING_TOGGLE,
  scrollY,
  speedButton,
  STOPPED_TOGGLE,
  test,
  toggle,
  waitFrames,
} from "../scene/helpers";
import { content, decodeScreenshot, DESKTOP, THEME } from "./support";
import type { Pixels } from "./support";

test.use({ viewport: DESKTOP });

const liveryIds = [...LIVERY_ORDER];
const speedIndexes = SPEEDS.map((_, index) => index);

test.describe("the hero", () => {
  test("after clicking its text, Space works the train and the page stays put", async ({
    page,
  }) => {
    await openScenePage(page);
    const { profile } = await content;

    await hero(page, THEME).getByText(profile.intro).click();
    const before = await scrollY(page);
    await pressKey(page, " ");
    await expectToggle(page, THEME, STOPPED_TOGGLE);
    await pressKey(page, " ");
    await expectToggle(page, THEME, RUNNING_TOGGLE);

    expect(await scrollY(page)).toBe(before);
  });

  test("the arrow keys step the speed", async ({ page }) => {
    await openScenePage(page);
    await speedButton(page, THEME, 1).click();
    await focusHero(page, THEME);

    await pressKey(page, "ArrowRight");
    await expect.poll(() => pressedSpeeds(page, THEME)).toEqual([2]);
    await pressKey(page, "ArrowLeft");
    await expect.poll(() => pressedSpeeds(page, THEME)).toEqual([1]);
  });
});

test.describe("by mouse", () => {
  test("each speed mark and each train swatch takes a click, named as it should be", async ({
    page,
  }) => {
    await openScenePage(page);
    const speedGroup = root(page, THEME).getByRole("group", { name: "Speed" });
    for (const index of speedIndexes) {
      await speedGroup
        .getByRole("button", {
          name: `Speed ${index + 1} of ${SPEEDS.length}`,
        })
        .click();
      expect(await pressedSpeeds(page, THEME)).toEqual([index]);
    }
    const trainGroup = root(page, THEME).getByRole("group", {
      name: "Choose a train",
    });
    for (const id of liveryIds) {
      await trainGroup
        .getByRole("button", { name: LIVERY_LABELS[id], exact: true })
        .click();
      expect(await pressedLiveries(page, THEME)).toEqual([id]);
    }
  });
});

test.describe("by keyboard", () => {
  const focusWithoutScrolling = (button: Locator) =>
    button.evaluate((element: HTMLElement) =>
      element.focus({ preventScroll: true }),
    );

  test("Enter and Space on the speed marks and train swatches press them", async ({
    page,
  }) => {
    await openScenePage(page);
    for (const index of speedIndexes) {
      await focusWithoutScrolling(speedButton(page, THEME, index));
      await pressKey(page, index % 2 === 0 ? "Enter" : " ");
      await expect.poll(() => pressedSpeeds(page, THEME)).toEqual([index]);
    }
    for (const [position, id] of liveryIds.entries()) {
      await focusWithoutScrolling(liveryButton(page, THEME, id));
      await pressKey(page, position % 2 === 0 ? "Enter" : " ");
      await expect.poll(() => pressedLiveries(page, THEME)).toEqual([id]);
    }
  });

  test("Tab walks the toggle, then the speed marks, then the swatches", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "webkit",
      "macOS WebKit skips buttons on Tab unless the system's keyboard setting is on.",
    );
    await openScenePage(page);
    await focusWithoutScrolling(toggle(page, THEME));
    const expected = [
      ...speedIndexes.map((index) => `speed ${index}`),
      ...liveryIds.map((id) => `livery ${id}`),
    ];
    const reached: string[] = [];
    for (let step = 0; step < expected.length; step += 1) {
      await pressKey(page, "Tab");
      reached.push(
        await page.evaluate(() => {
          const { dataset } = document.activeElement as HTMLElement;
          return dataset.railSpeed !== undefined
            ? `speed ${dataset.railSpeed}`
            : `livery ${dataset.railLivery}`;
        }),
      );
    }
    expect(reached).toEqual(expected);
  });

  /** Only the ring can reach this far: the marks themselves stay inside their box. */
  const RING_CLIP_MARGIN_PX = 10;
  /** Well under a ring around the smallest mark, and over any stray antialiasing. */
  const FEWEST_RING_PIXELS = 30;

  async function changedOutside(
    page: Page,
    button: Locator,
    capture: () => Promise<void>,
  ): Promise<number> {
    const box = await button.boundingBox();
    if (!box) throw new Error("The control is not showing.");
    const clip = {
      x: Math.floor(box.x - RING_CLIP_MARGIN_PX),
      y: Math.floor(box.y - RING_CLIP_MARGIN_PX),
      width: Math.ceil(box.width) + RING_CLIP_MARGIN_PX * 2,
      height: Math.ceil(box.height) + RING_CLIP_MARGIN_PX * 2,
    };
    const shoot = async (): Promise<Pixels> =>
      decodeScreenshot(await page.screenshot({ clip, scale: "css" }));
    const focused = await shoot();
    await capture();
    const blurred = await shoot();
    let changed = 0;
    for (let y = 0; y < focused.height; y += 1) {
      for (let x = 0; x < focused.width; x += 1) {
        const insideBox =
          x >= box.x - clip.x - 1 &&
          x <= box.x - clip.x + box.width + 1 &&
          y >= box.y - clip.y - 1 &&
          y <= box.y - clip.y + box.height + 1;
        if (insideBox) continue;
        const at = (y * focused.width + x) * 4;
        if (
          focused.rgba[at] !== blurred.rgba[at] ||
          focused.rgba[at + 1] !== blurred.rgba[at + 1] ||
          focused.rgba[at + 2] !== blurred.rgba[at + 2]
        ) {
          changed += 1;
        }
      }
    }
    return changed;
  }

  const expectFocusRing = async (page: Page, button: Locator) => {
    expect(
      await button.evaluate((element) => element.matches(":focus-visible")),
      "the page should treat this focus as a keyboard's",
    ).toBe(true);
    const changed = await changedOutside(page, button, async () => {
      await button.evaluate((element: HTMLElement) => element.blur());
      await waitFrames(page, 2);
    });
    expect(changed).toBeGreaterThanOrEqual(FEWEST_RING_PIXELS);
  };

  test("a focused, pressed swatch shows a ring around it, past its own outline", async ({
    page,
  }) => {
    await openScenePage(page);
    const swatch = liveryButton(page, THEME, "toy");
    await focusWithoutScrolling(swatch);
    await pressKey(page, "Enter");
    await expect.poll(() => pressedLiveries(page, THEME)).toEqual(["toy"]);

    await expectFocusRing(page, swatch);
  });

  test("the toggle and a speed mark show the ring too", async ({ page }) => {
    await openScenePage(page);
    for (const button of [toggle(page, THEME), speedButton(page, THEME, 3)]) {
      await focusWithoutScrolling(button);
      await expectFocusRing(page, button);
    }
  });
});
