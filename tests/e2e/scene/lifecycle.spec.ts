import type { Page } from "@playwright/test";
import { THEME_ATTRIBUTE, THEME_NAMES } from "../../../src/scene/contract";
import {
  addStyleToHtml,
  canvas,
  expect,
  expectDrawing,
  expectDrawsStop,
  expectNoDraws,
  expectOneLoop,
  expectState,
  drawCount,
  hideTab,
  instrumentScenes,
  isNowLineShowing,
  makePageTall,
  nowMode,
  openScenePage,
  sceneCalls,
  scrollCanvasOffScreen,
  scrollPage,
  showTheme,
  stateOf,
  test,
  waitFrames,
  widthWriteCount,
} from "./helpers";

const WIDE_VIEWPORT = { width: 1280, height: 720 };
const COMPACT_VIEWPORT = { width: 500, height: 720 };

test.describe("pausing (E10)", () => {
  test("a refocused tab leaves an off-screen scene paused, and scrolling back still resumes and pauses it", async ({
    page,
  }) => {
    await openScenePage(page);
    await makePageTall(page);
    await showTheme(page, "diorama");
    await showTheme(page, "interchange");
    await expectDrawing(page, "interchange");

    await scrollCanvasOffScreen(page, "interchange");
    await expectDrawsStop(page, "interchange");
    const dioramaDraws = await drawCount(page, "diorama");

    // The prototype's refocus handler marked the scene visible here for good.
    await hideTab(page, true);
    await hideTab(page, false);
    await expectNoDraws(page, "interchange");
    expect(await drawCount(page, "diorama")).toBe(dioramaDraws);
    expect(await stateOf(page, "interchange")).toBe("running");

    await scrollPage(page, 0);
    await expectDrawing(page, "interchange");

    await scrollCanvasOffScreen(page, "interchange");
    await expectDrawsStop(page, "interchange");

    await hideTab(page, true);
    await hideTab(page, false);
    await expectNoDraws(page, "interchange");
  });

  test("a refocused tab leaves a hidden theme undrawn", async ({ page }) => {
    await openScenePage(page);
    await showTheme(page, "diorama");
    await showTheme(page, "interchange");
    const dioramaDraws = await drawCount(page, "diorama");

    await hideTab(page, true);
    await hideTab(page, false);
    await expectDrawing(page, "interchange");
    await expectNoDraws(page, "diorama");

    expect(await drawCount(page, "diorama")).toBe(dioramaDraws);
    expect(await stateOf(page, "diorama")).toBe("paused");
  });

  test("a hidden tab stops drawing without changing the state, and showing it resumes one loop", async ({
    page,
  }) => {
    await openScenePage(page);
    await expectDrawing(page, "interchange");

    await hideTab(page, true);
    await expectDrawsStop(page, "interchange");
    expect(await stateOf(page, "interchange")).toBe("running");

    await hideTab(page, false);
    await expectDrawing(page, "interchange");
    await expectOneLoop(page);
  });

  test("scrolling away does not rewrite the state, and scrolling back gives one loop", async ({
    page,
  }) => {
    await openScenePage(page);
    await makePageTall(page);

    await scrollCanvasOffScreen(page, "interchange");
    await expectDrawsStop(page, "interchange");
    expect(await stateOf(page, "interchange")).toBe("running");

    await scrollPage(page, 0);
    await expectDrawing(page, "interchange");
    await expectOneLoop(page);
  });
});

test.describe("resizing", () => {
  for (const theme of THEME_NAMES) {
    test(`${theme} is told its size and colours before it first draws`, async ({
      page,
    }) => {
      await instrumentScenes(page);
      await openScenePage(page);
      await showTheme(page, theme);

      const calls = await sceneCalls(page, theme);
      expect(calls.slice(0, 4)).toEqual([
        "createScene",
        "resize",
        "applyColorScheme",
        "draw",
      ]);
    });

    test(`${theme} is resized once per show and once per size change, with nothing extra`, async ({
      page,
    }) => {
      await openScenePage(page);
      const other = theme === "interchange" ? "diorama" : "interchange";

      await showTheme(page, theme);
      await waitFrames(page, 15);
      const firstShow = await page.evaluate(
        (name) => window.__sceneSpy.widthWritesAtShow[name],
        theme,
      );
      expect(firstShow).toBeGreaterThan(0);
      expect(await widthWriteCount(page, theme)).toBe(firstShow);

      await showTheme(page, other);
      await waitFrames(page, 3);
      const afterHidden = await widthWriteCount(page, theme);
      await page.setViewportSize({ width: 1100, height: 720 });
      await waitFrames(page, 3);
      expect(await widthWriteCount(page, theme)).toBe(afterHidden);
      await page.setViewportSize(WIDE_VIEWPORT);
      await waitFrames(page, 3);

      await showTheme(page, theme);
      await waitFrames(page, 15);
      expect(
        (await widthWriteCount(page, theme)) - afterHidden,
      ).toBeLessThanOrEqual(firstShow);

      const beforeChange = await widthWriteCount(page, theme);
      await page.setViewportSize({ width: 1000, height: 720 });
      await expect
        .poll(() => widthWriteCount(page, theme))
        .toBeGreaterThan(beforeChange);
      await waitFrames(page, 15);
      expect((await widthWriteCount(page, theme)) - beforeChange).toBe(
        firstShow,
      );
    });
  }

  test("a new pixel ratio resizes the running scene, as when a window moves to another screen", async ({
    page,
  }) => {
    await openScenePage(page);
    const bitmapWidth = () =>
      canvas(page, "interchange").evaluate(
        (element: HTMLCanvasElement) => element.width,
      );
    const before = await bitmapWidth();

    await page.evaluate(() => {
      Object.defineProperty(window, "devicePixelRatio", {
        configurable: true,
        get: () => 1.5,
      });
    });

    await expect.poll(bitmapWidth).not.toBe(before);
  });
});

test.describe("zero width (E13)", () => {
  const ZERO_WIDTH_SCENE =
    ":has(> [data-rail-canvas]) { width: 0 !important; }";

  test("a scene shown at zero width stays undrawn, and gets its size before its first draw when width returns", async ({
    page,
  }) => {
    await addStyleToHtml(page, ZERO_WIDTH_SCENE);
    await openScenePage(page);

    await expectNoDraws(page, "interchange");
    expect(await drawCount(page, "interchange")).toBe(0);
    expect(await widthWriteCount(page, "interchange")).toBe(0);
    expect(await nowMode(page, "interchange")).not.toBe("board");

    await page.evaluate(() => document.getElementById("e2e")?.remove());

    await expect.poll(() => drawCount(page, "interchange")).toBeGreaterThan(0);
    const events = await page.evaluate(
      () => window.__sceneSpy.canvasEvents.interchange,
    );
    expect(events[0]).toBe("resize");
    await expect.poll(() => nowMode(page, "interchange")).toBe("board");
    const box = await canvas(page, "interchange").boundingBox();
    expect(box?.width).toBeGreaterThan(600);
  });

  test("a running scene is not resized while its width is zero, and carries on when width returns", async ({
    page,
  }) => {
    await openScenePage(page);
    await waitFrames(page, 5);
    const writes = await widthWriteCount(page, "interchange");

    await page.addStyleTag({ content: ZERO_WIDTH_SCENE });
    await waitFrames(page, 10);
    expect(await widthWriteCount(page, "interchange")).toBe(writes);

    await page.evaluate(() =>
      document
        .querySelectorAll("style")
        .forEach((style) =>
          style.textContent?.includes("width: 0") ? style.remove() : undefined,
        ),
    );
    await expectDrawing(page, "interchange");
    expect(await stateOf(page, "interchange")).toBe("running");
  });
});

test.describe("crossing the phone breakpoint (E14)", () => {
  test("an off-screen resize flips which Right now shows, in both directions, without restarting the loop", async ({
    page,
  }) => {
    await openScenePage(page);
    await makePageTall(page);
    expect(await nowMode(page, "interchange")).toBe("board");
    expect(await isNowLineShowing(page, "interchange")).toBe(false);

    await scrollCanvasOffScreen(page, "interchange");
    await expectDrawsStop(page, "interchange");

    await page.setViewportSize(COMPACT_VIEWPORT);
    await expect.poll(() => nowMode(page, "interchange")).toBe("html");
    expect(await isNowLineShowing(page, "interchange")).toBe(true);
    await expectDrawsStop(page, "interchange");

    await page.setViewportSize(WIDE_VIEWPORT);
    await expect.poll(() => nowMode(page, "interchange")).toBe("board");
    expect(await isNowLineShowing(page, "interchange")).toBe(false);
    await expectDrawsStop(page, "interchange");
  });

  test("an on-screen resize flips it too, and the running scene takes the new width", async ({
    page,
  }) => {
    await openScenePage(page);

    await page.setViewportSize(COMPACT_VIEWPORT);
    await expect.poll(() => nowMode(page, "interchange")).toBe("html");
    expect(await isNowLineShowing(page, "interchange")).toBe(true);
    const box = await canvas(page, "interchange").boundingBox();
    expect(box?.width).toBeLessThanOrEqual(COMPACT_VIEWPORT.width);

    await page.setViewportSize(WIDE_VIEWPORT);
    await expect.poll(() => nowMode(page, "interchange")).toBe("board");
    await expectOneLoop(page);
  });
});

test.describe("returning through bfcache", () => {
  const showFromCache = (page: Page) =>
    page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      ),
    );

  test("the scene keeps running on one loop", async ({ page }) => {
    await openScenePage(page);
    await expectDrawing(page, "interchange");

    await showFromCache(page);
    await showFromCache(page);

    await expectDrawing(page, "interchange");
    await expectOneLoop(page);
    expect(await stateOf(page, "interchange")).toBe("running");
  });

  test("a frame request the frozen page lost does not stop the scene for good", async ({
    page,
  }) => {
    await openScenePage(page);
    await expectDrawing(page, "interchange");

    await page.evaluate(() =>
      cancelAnimationFrame(window.__sceneSpy.lastRafId),
    );
    await expectDrawsStop(page, "interchange");

    await showFromCache(page);

    await expectDrawing(page, "interchange");
    await expectOneLoop(page);
  });

  test("a selection written just before the pageshow is shown on one loop", async ({
    page,
  }) => {
    await openScenePage(page);

    await page.evaluate((attribute) => {
      document.documentElement.setAttribute(attribute, "diorama");
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      );
    }, THEME_ATTRIBUTE);

    await expectState(page, "diorama", "running");
    await expectDrawing(page, "diorama");
    await expectOneLoop(page);
    expect(await stateOf(page, "interchange")).toBe("paused");
  });
});
