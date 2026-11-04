import type { Page } from "@playwright/test";
import { LIVERY_ORDER, SPEEDS } from "../../../src/rail";
import {
  HIT_RADIUS,
  STORAGE_KEYS,
  THEME_NAMES,
  type ThemeName,
} from "../../../src/scene/contract";
import {
  canvas,
  expect,
  expectToggle,
  findTrain,
  focusHero,
  instrumentScenes,
  liveryButton,
  makePageTall,
  openScenePage,
  pressedLiveries,
  pressedSpeeds,
  pressKey,
  REDUCED_START_TOGGLE,
  RUNNING_TOGGLE,
  scrollPage,
  scrollY,
  showTheme,
  speedButton,
  STOPPED_TOGGLE,
  test,
  toggle,
  toggleState,
  waitFrames,
} from "./helpers";

const cursorOf = (page: Page, theme: ThemeName) =>
  canvas(page, theme).evaluate((element) => element.style.cursor);

/** Scroll can animate after a key, so reads it once it has stopped moving. */
async function settledScrollY(page: Page): Promise<number> {
  let settled = 0;
  await expect
    .poll(async () => {
      const before = await scrollY(page);
      await waitFrames(page, 10);
      settled = await scrollY(page);
      return settled === before;
    })
    .toBe(true);
  return settled;
}

test.describe("control state", () => {
  test("every theme's controls start the same, hidden themes included", async ({
    page,
  }) => {
    await openScenePage(page);

    for (const theme of THEME_NAMES) {
      await expectToggle(page, theme, RUNNING_TOGGLE);
      expect((await pressedSpeeds(page, theme)).length).toBe(1);
      expect(await pressedLiveries(page, theme)).toEqual(["metro"]);
    }
  });

  test("a press on one theme writes state to every theme's controls", async ({
    page,
  }) => {
    await openScenePage(page);

    await toggle(page, "interchange").click();
    for (const theme of THEME_NAMES) {
      await expectToggle(page, theme, STOPPED_TOGGLE);
      expect(await pressedSpeeds(page, theme)).toEqual([]);
    }

    await speedButton(page, "interchange", 2).click();
    for (const theme of THEME_NAMES) {
      await expectToggle(page, theme, RUNNING_TOGGLE);
      expect(await pressedSpeeds(page, theme)).toEqual([2]);
    }

    await liveryButton(page, "interchange", "toy").click();
    for (const theme of THEME_NAMES) {
      expect(await pressedLiveries(page, theme)).toEqual(["toy"]);
    }
  });
});

test.describe("by mouse", () => {
  for (const theme of THEME_NAMES) {
    test(`${theme}'s buttons all work`, async ({ page }) => {
      await openScenePage(page);
      await showTheme(page, theme);

      await toggle(page, theme).click();
      await expectToggle(page, theme, STOPPED_TOGGLE);
      await toggle(page, theme).click();
      await expectToggle(page, theme, RUNNING_TOGGLE);

      for (let index = 0; index < SPEEDS.length; index += 1) {
        await speedButton(page, theme, index).click();
        expect(await pressedSpeeds(page, theme)).toEqual([index]);
      }
      for (const livery of LIVERY_ORDER) {
        await liveryButton(page, theme, livery).click();
        expect(await pressedLiveries(page, theme)).toEqual([livery]);
      }
    });

    test(`${theme}'s train takes hover and press, and the empty canvas does not`, async ({
      page,
    }) => {
      // Reduced motion starts stopped, so the train stays put under the pointer.
      await openScenePage(page, { reducedMotion: true });
      await showTheme(page, theme);
      const train = await findTrain(page, theme);

      await page.mouse.move(train.x, train.y);
      await expect.poll(() => cursorOf(page, theme)).toBe("pointer");

      await page.mouse.click(train.x, train.y);
      await expectToggle(page, theme, STOPPED_TOGGLE);
      await page.mouse.click(train.x, train.y);
      await expectToggle(page, theme, RUNNING_TOGGLE);
      await toggle(page, theme).click();
      await expectToggle(page, theme, STOPPED_TOGGLE);

      const box = await canvas(page, theme).boundingBox();
      if (!box) throw new Error("The canvas is not showing.");
      const emptyCorner = await findEmptyCorner(page, theme, box);
      await page.mouse.move(emptyCorner.x, emptyCorner.y);
      await expect.poll(() => cursorOf(page, theme)).toBe("");
      await page.mouse.click(emptyCorner.x, emptyCorner.y);
      await waitFrames(page, 2);
      await expectToggle(page, theme, STOPPED_TOGGLE);
    });
  }

  /** A canvas corner the train is not over, found with the page's own hover. */
  async function findEmptyCorner(
    page: Page,
    theme: ThemeName,
    box: { x: number; y: number; width: number; height: number },
  ) {
    const corners = [
      { x: box.x + 2, y: box.y + 2 },
      { x: box.x + box.width - 2, y: box.y + 2 },
      { x: box.x + 2, y: box.y + box.height - 2 },
      { x: box.x + box.width - 2, y: box.y + box.height - 2 },
    ];
    for (const corner of corners) {
      await page.mouse.move(corner.x, corner.y);
      await waitFrames(page, 1);
      if ((await cursorOf(page, theme)) === "") return corner;
    }
    throw new Error("The train covers every corner of the canvas.");
  }
});

test.describe("asking the scene about the train", () => {
  /**
   * Within 1 px, not exactly: a canvas at a fractional position reports a point such
   * as 39.6875 in Chromium and 39.703125 in WebKit, and 1 px is far inside any hit
   * radius.
   */
  const POINT_TOLERANCE = 1;
  const inside = { x: 30, y: 40 };

  async function expectAskedNear(
    page: Page,
    expected: { x: number; y: number },
    radius: number,
  ): Promise<void> {
    await expect
      .poll(async () => {
        const asked = await page.evaluate(
          () => window.__sceneSpy.lastHitTrainArgs,
        );
        if (!asked) return "nothing asked yet";
        const [point, askedRadius] = asked as [
          { x: number; y: number },
          number,
        ];
        const near =
          Math.abs(point.x - expected.x) <= POINT_TOLERANCE &&
          Math.abs(point.y - expected.y) <= POINT_TOLERANCE;
        return near && askedRadius === radius
          ? "as expected"
          : `${JSON.stringify(point)} at radius ${askedRadius}`;
      })
      .toBe("as expected");
  }

  async function expectHoverAndPressAskNear(page: Page): Promise<void> {
    const box = await canvas(page, "interchange").boundingBox();
    if (!box) throw new Error("The canvas is not showing.");

    await page.mouse.move(box.x + inside.x, box.y + inside.y);
    await expectAskedNear(page, inside, HIT_RADIUS.hover);

    await page.mouse.click(box.x + inside.x, box.y + inside.y);
    await expectAskedNear(page, inside, HIT_RADIUS.click);
  }

  test("hover and press ask with canvas-relative points and the contract's radii", async ({
    page,
  }) => {
    await instrumentScenes(page);
    await openScenePage(page);
    await expectHoverAndPressAskNear(page);
  });

  test("hover and press stay canvas-relative with the canvas at a fractional position", async ({
    page,
  }) => {
    await instrumentScenes(page);
    await openScenePage(page);
    await page.addStyleTag({
      content: `[data-rail-hero] { padding-top: 10.37px !important; }`,
    });
    await expect
      .poll(async () => {
        const box = await canvas(page, "interchange").boundingBox();
        return box ? box.y % 1 : 0;
      })
      .not.toBe(0);

    await expectHoverAndPressAskNear(page);
  });
});

test.describe("by touch", () => {
  test.use({ hasTouch: true });

  for (const theme of THEME_NAMES) {
    test(`${theme}'s buttons and train take a tap`, async ({ page }) => {
      await openScenePage(page, { reducedMotion: true });
      await showTheme(page, theme);

      const train = await findTrain(page, theme);
      await page.touchscreen.tap(train.x, train.y);
      await expectToggle(page, theme, STOPPED_TOGGLE);
      await page.touchscreen.tap(train.x, train.y);
      await expectToggle(page, theme, RUNNING_TOGGLE);

      await toggle(page, theme).tap();
      await expectToggle(page, theme, STOPPED_TOGGLE);
      await speedButton(page, theme, 2).tap();
      await expectToggle(page, theme, RUNNING_TOGGLE);
      expect(await pressedSpeeds(page, theme)).toEqual([2]);
      await liveryButton(page, theme, "toy").tap();
      expect(await pressedLiveries(page, theme)).toEqual(["toy"]);
    });
  }
});

test.describe("by keyboard", () => {
  for (const theme of THEME_NAMES) {
    test(`with focus on ${theme}'s hero, Space and the speed keys work the train`, async ({
      page,
    }) => {
      await openScenePage(page);
      await showTheme(page, theme);
      await focusHero(page, theme);

      await pressKey(page, " ");
      await expectToggle(page, theme, STOPPED_TOGGLE);
      await pressKey(page, " ");
      await expectToggle(page, theme, RUNNING_TOGGLE);

      await speedButton(page, theme, 0).click();
      await focusHero(page, theme);
      await pressKey(page, "ArrowRight");
      expect(await pressedSpeeds(page, theme)).toEqual([1]);
      await pressKey(page, "+");
      expect(await pressedSpeeds(page, theme)).toEqual([2]);
      await pressKey(page, "ArrowLeft");
      expect(await pressedSpeeds(page, theme)).toEqual([1]);
      await pressKey(page, "-");
      expect(await pressedSpeeds(page, theme)).toEqual([0]);
    });
  }

  test("the speed keys stop at each end", async ({ page }) => {
    await openScenePage(page);
    await focusHero(page, "interchange");

    await speedButton(page, "interchange", 0).click();
    await focusHero(page, "interchange");
    await pressKey(page, "ArrowLeft");
    expect(await pressedSpeeds(page, "interchange")).toEqual([0]);

    await speedButton(page, "interchange", SPEEDS.length - 1).click();
    await focusHero(page, "interchange");
    await pressKey(page, "ArrowRight");
    expect(await pressedSpeeds(page, "interchange")).toEqual([
      SPEEDS.length - 1,
    ]);
  });

  test("a speed key starts a stopped train, because it asks for motion", async ({
    page,
  }) => {
    await openScenePage(page);
    await toggle(page, "interchange").click();
    await focusHero(page, "interchange");

    await pressKey(page, "ArrowRight");

    await expectToggle(page, "interchange", RUNNING_TOGGLE);
  });

  test("holding Space toggles once", async ({ page }) => {
    await openScenePage(page);
    await focusHero(page, "interchange");

    // An even number of repeats, so toggling on each would end where it began.
    await page.keyboard.down(" ");
    await page.keyboard.down(" ");
    await page.keyboard.up(" ");

    await expectToggle(page, "interchange", STOPPED_TOGGLE);
  });

  test("Space on the hero does not scroll, while the scroll keys still do", async ({
    page,
  }) => {
    await openScenePage(page);
    await makePageTall(page);
    await focusHero(page, "interchange");

    const atTop = await settledScrollY(page);
    await pressKey(page, " ");
    await expectToggle(page, "interchange", STOPPED_TOGGLE);
    expect(await settledScrollY(page)).toBe(atTop);

    await pressKey(page, "ArrowDown");
    await expect.poll(() => scrollY(page)).toBeGreaterThan(atTop);
    const lower = await settledScrollY(page);

    await pressKey(page, "PageDown");
    await expect.poll(() => scrollY(page)).toBeGreaterThan(lower);
    await expectToggle(page, "interchange", STOPPED_TOGGLE);
  });

  test("with focus outside the hero, Space scrolls and leaves the train alone", async ({
    page,
  }) => {
    await openScenePage(page);
    await makePageTall(page);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });

    const atTop = await settledScrollY(page);
    await pressKey(page, " ");

    await expect.poll(() => scrollY(page)).toBeGreaterThan(atTop);
    await expectToggle(page, "interchange", RUNNING_TOGGLE);
  });

  test("browser shortcuts with modifiers stay with the browser", async ({
    page,
  }) => {
    await openScenePage(page);
    await makePageTall(page);
    const speedsBefore = await pressedSpeeds(page, "interchange");
    await focusHero(page, "interchange");

    await pressKey(page, "Alt+ArrowLeft");
    expect(await pressedSpeeds(page, "interchange")).toEqual(speedsBefore);

    await scrollPage(page, 400);
    await focusHero(page, "interchange");
    const before = await settledScrollY(page);
    await pressKey(page, "Shift+ ");
    await expect.poll(() => scrollY(page)).toBeLessThan(before);
    await expectToggle(page, "interchange", RUNNING_TOGGLE);
  });

  test("buttons in the hero keep their own keys, each acting once", async ({
    page,
  }) => {
    await openScenePage(page);

    await toggle(page, "interchange").focus();
    await pressKey(page, " ");
    await expectToggle(page, "interchange", STOPPED_TOGGLE);
    await pressKey(page, "Enter");
    await expectToggle(page, "interchange", RUNNING_TOGGLE);

    await speedButton(page, "interchange", 0).focus();
    await pressKey(page, "Enter");
    expect(await pressedSpeeds(page, "interchange")).toEqual([0]);
    await pressKey(page, "ArrowRight");
    expect(await pressedSpeeds(page, "interchange")).toEqual([0]);

    await liveryButton(page, "interchange", "toy").focus();
    await pressKey(page, " ");
    expect(await pressedLiveries(page, "interchange")).toEqual(["toy"]);
    await expectToggle(page, "interchange", RUNNING_TOGGLE);
  });
});

test.describe("the saved livery", () => {
  test("a chosen livery survives a reload", async ({ page }) => {
    await openScenePage(page);
    await liveryButton(page, "interchange", "steam").click();

    await page.reload();
    await expect
      .poll(() => pressedLiveries(page, "interchange"))
      .toEqual(["steam"]);
    expect(await pressedLiveries(page, "pixel-depot")).toEqual(["steam"]);
  });

  test("an invalid saved livery falls back to the default", async ({
    page,
  }) => {
    await page.addInitScript(
      (key) => localStorage.setItem(key, "not-a-livery"),
      STORAGE_KEYS.livery,
    );

    await openScenePage(page);

    expect(await pressedLiveries(page, "interchange")).toEqual(["metro"]);
  });

  test("storage that throws leaves the controls working for the visit", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const refuse = () => {
        throw new Error("Storage is blocked");
      };
      Storage.prototype.getItem = refuse;
      Storage.prototype.setItem = refuse;
    });

    await openScenePage(page);
    await liveryButton(page, "interchange", "toy").click();

    expect(await pressedLiveries(page, "interchange")).toEqual(["toy"]);
    expect((await toggleState(page, "interchange")).state).toBe("go");
  });
});

test.describe("reduced motion", () => {
  const COMPACT_VIEWPORT = { width: 500, height: 720 };
  const WIDE_VIEWPORT = { width: 1280, height: 720 };

  test("wide: the train starts stopped with text rolling, and presses walk the table", async ({
    page,
  }) => {
    await openScenePage(page, { reducedMotion: true });
    await expectToggle(page, "interchange", REDUCED_START_TOGGLE);
    expect(await pressedSpeeds(page, "interchange")).toEqual([]);

    await toggle(page, "interchange").click();
    await expectToggle(page, "interchange", STOPPED_TOGGLE);

    await toggle(page, "interchange").click();
    await expectToggle(page, "interchange", RUNNING_TOGGLE);
    expect((await pressedSpeeds(page, "interchange")).length).toBe(1);

    await toggle(page, "interchange").click();
    await expectToggle(page, "interchange", STOPPED_TOGGLE);
  });

  test("compact: the first press starts the train, since no text moves to pause", async ({
    page,
  }) => {
    await page.setViewportSize(COMPACT_VIEWPORT);
    await openScenePage(page, { reducedMotion: true });
    await expectToggle(page, "interchange", STOPPED_TOGGLE);

    await toggle(page, "interchange").click();

    await expectToggle(page, "interchange", RUNNING_TOGGLE);
  });

  test("compact: Space on the hero goes through the same rule", async ({
    page,
  }) => {
    await page.setViewportSize(COMPACT_VIEWPORT);
    await openScenePage(page, { reducedMotion: true });
    await focusHero(page, "interchange");

    await pressKey(page, " ");

    await expectToggle(page, "interchange", RUNNING_TOGGLE);
  });

  test("the control follows a width change both ways while nothing has been pressed", async ({
    page,
  }) => {
    await openScenePage(page, { reducedMotion: true });
    await expectToggle(page, "interchange", REDUCED_START_TOGGLE);

    await page.setViewportSize(COMPACT_VIEWPORT);
    await expectToggle(page, "interchange", STOPPED_TOGGLE);

    await page.setViewportSize(WIDE_VIEWPORT);
    await expectToggle(page, "interchange", REDUCED_START_TOGGLE);
  });

  test("once the start state is left, width changes no longer bring it back", async ({
    page,
  }) => {
    await openScenePage(page, { reducedMotion: true });
    await toggle(page, "interchange").click();
    await toggle(page, "interchange").click();
    await toggle(page, "interchange").click();
    await expectToggle(page, "interchange", STOPPED_TOGGLE);

    await page.setViewportSize(COMPACT_VIEWPORT);
    await expectToggle(page, "interchange", STOPPED_TOGGLE);
    await page.setViewportSize(WIDE_VIEWPORT);
    await waitFrames(page, 5);

    await expectToggle(page, "interchange", STOPPED_TOGGLE);
  });

  test("a speed press starts the train, because it asks for motion", async ({
    page,
  }) => {
    await openScenePage(page, { reducedMotion: true });

    await speedButton(page, "interchange", 2).click();

    await expectToggle(page, "interchange", RUNNING_TOGGLE);
    expect(await pressedSpeeds(page, "interchange")).toEqual([2]);
  });
});
