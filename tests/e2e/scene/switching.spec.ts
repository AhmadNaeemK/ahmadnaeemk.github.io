import type { Page } from "@playwright/test";
import { THEME_NAMES, type ThemeName } from "../../../src/scene/contract";
import {
  drawCount,
  carsSeenBy,
  expectDrawsStop,
  expect,
  expectDrawing,
  expectNoDraws,
  expectOneLoop,
  expectState,
  expectToggle,
  hideTab,
  holdSceneChunks,
  instrumentScenes,
  liveryButton,
  makePageTall,
  measureSteps,
  openScenePage,
  openWithCheckedStep,
  pressedLiveries,
  pressedSpeeds,
  scrollCanvasOffScreen,
  scrollPage,
  selectTheme,
  showTheme,
  speedButton,
  stateOf,
  statesSeen,
  STOPPED_TOGGLE,
  RUNNING_TOGGLE,
  test,
  toggle,
  waitFrames,
  waitForTrainAtRest,
  waitForTrainToMove,
  worldClockRate,
} from "./helpers";

test.describe("quick switching (E11)", () => {
  async function openWithInterchangeLoaded(page: Page) {
    const chunks = await holdSceneChunks(page);
    await openScenePage(page, { waitForRunning: false });
    await chunks.waitForCount(1);
    await chunks.release(0);
    await expectState(page, "interchange", "running");
    return chunks;
  }

  test("a stale import arriving after the last choice starts nothing", async ({
    page,
  }) => {
    const chunks = await openWithInterchangeLoaded(page);

    await selectTheme(page, "diorama");
    await chunks.waitForCount(2);
    await selectTheme(page, "pixel-depot");
    await chunks.waitForCount(3);

    await chunks.release(2);
    await expectState(page, "pixel-depot", "running");
    await chunks.release(1);

    await expect.poll(() => stateOf(page, "diorama")).toBeNull();
    expect(await statesSeen(page, "diorama")).not.toContain("running");
    expect(await drawCount(page, "diorama")).toBe(0);
    expect(await stateOf(page, "pixel-depot")).toBe("running");
    expect(await stateOf(page, "interchange")).toBe("paused");
    await expectDrawing(page, "pixel-depot");
    await expectOneLoop(page);
  });

  test("a stale import arriving before the last choice starts nothing", async ({
    page,
  }) => {
    const chunks = await openWithInterchangeLoaded(page);

    await selectTheme(page, "diorama");
    await chunks.waitForCount(2);
    await selectTheme(page, "pixel-depot");
    await chunks.waitForCount(3);

    await chunks.release(1);
    await expect.poll(() => stateOf(page, "diorama")).toBeNull();
    expect(await stateOf(page, "pixel-depot")).toBe("loading");

    await chunks.release(2);
    await expectState(page, "pixel-depot", "running");
    expect(await statesSeen(page, "diorama")).not.toContain("running");
    await expectOneLoop(page);
  });

  test("going back to a loaded theme while an import is pending keeps that theme running", async ({
    page,
  }) => {
    const chunks = await openWithInterchangeLoaded(page);

    await selectTheme(page, "diorama");
    await chunks.waitForCount(2);
    await showTheme(page, "interchange");

    await chunks.release(1);
    await expect.poll(() => stateOf(page, "diorama")).toBeNull();
    expect(await stateOf(page, "interchange")).toBe("running");
    await expectDrawing(page, "interchange");
    await expectOneLoop(page);
  });

  test("choosing a theme again while its import is pending shows it once it arrives", async ({
    page,
  }) => {
    const chunks = await openWithInterchangeLoaded(page);

    await selectTheme(page, "diorama");
    await chunks.waitForCount(2);
    await showTheme(page, "interchange");
    await selectTheme(page, "diorama");

    // WebKit fetches the chunk again for the second import while the first waits.
    await chunks.releaseAll();
    await expectState(page, "diorama", "running");
    await expectDrawing(page, "diorama");
    expect(await stateOf(page, "interchange")).toBe("paused");
    await expectOneLoop(page);
  });

  test("two choices in one task fetch only the last", async ({ page }) => {
    const chunks = await openWithInterchangeLoaded(page);

    await page.evaluate(() => {
      const html = document.documentElement;
      html.setAttribute("data-rail-theme", "diorama");
      html.setAttribute("data-rail-theme", "pixel-depot");
    });
    await chunks.waitForCount(2);
    await chunks.release(1);

    await expectState(page, "pixel-depot", "running");
    expect(chunks.count()).toBe(2);
    expect(await stateOf(page, "diorama")).toBeNull();
  });

  test("many switches between loaded themes leave one loop, drawing only the last", async ({
    page,
  }) => {
    await openScenePage(page);
    await showTheme(page, "diorama");
    await showTheme(page, "pixel-depot");

    for (let round = 0; round < 8; round += 1) {
      for (const theme of THEME_NAMES) await selectTheme(page, theme);
    }
    await expectState(page, "pixel-depot", "running");
    await waitFrames(page, 3);

    await expectOneLoop(page);
    await expectNoDraws(page, "interchange");
    await expectNoDraws(page, "diorama");
    expect(await stateOf(page, "interchange")).toBe("paused");
    expect(await stateOf(page, "diorama")).toBe("paused");
  });
});

/** One step a frame gives about 1, and two give about 2. */
const MOST_CLOCK_RATE = 1.5;

test.describe("what carries across a switch", () => {
  const OTHER_THEMES: readonly ThemeName[] = ["diorama", "pixel-depot"];

  test("stop state, speed and livery carry over, and the hidden theme's controls are already right", async ({
    page,
  }) => {
    await openScenePage(page);
    await speedButton(page, "interchange", 3).click();
    await liveryButton(page, "interchange", "steam").click();
    await toggle(page, "interchange").click();

    for (const theme of OTHER_THEMES) {
      await expectToggle(page, theme, STOPPED_TOGGLE);
      await showTheme(page, theme);
      await expectToggle(page, theme, STOPPED_TOGGLE);
      expect(await pressedLiveries(page, theme)).toEqual(["steam"]);
      expect(await pressedSpeeds(page, theme)).toEqual([]);
    }

    // The speed was kept all along: starting again goes back to it.
    await toggle(page, "pixel-depot").click();
    await expectToggle(page, "pixel-depot", RUNNING_TOGGLE);
    expect(await pressedSpeeds(page, "interchange")).toEqual([3]);
    expect(await pressedSpeeds(page, "pixel-depot")).toEqual([3]);
  });

  test("the train keeps its place across a switch, and moves for every theme at once", async ({
    page,
  }) => {
    await instrumentScenes(page);
    await openScenePage(page);
    await waitForTrainToMove(page, "interchange");
    await toggle(page, "interchange").click();
    const rested = await waitForTrainAtRest(page, "interchange");

    await showTheme(page, "diorama");
    await waitFrames(page, 10);
    expect(await carsSeenBy(page, "diorama")).toEqual(rested);
    await showTheme(page, "interchange");
    await waitFrames(page, 10);
    expect(await carsSeenBy(page, "interchange")).toEqual(rested);

    await showTheme(page, "diorama");
    await toggle(page, "diorama").click();
    await waitForTrainToMove(page, "diorama");
    await toggle(page, "diorama").click();
    const movedOn = await waitForTrainAtRest(page, "diorama");
    expect(movedOn).not.toEqual(rested);

    await showTheme(page, "pixel-depot");
    await waitFrames(page, 10);
    expect(await carsSeenBy(page, "pixel-depot")).toEqual(movedOn);
    await showTheme(page, "interchange");
    expect(await carsSeenBy(page, "interchange")).toEqual(movedOn);
  });
});

test.describe("one world, stepped once a frame", () => {
  test("no frame steps the world twice, across switches and wakes", async ({
    page,
  }) => {
    await openWithCheckedStep(page);
    await makePageTall(page);

    const expectOneStepAFrame = async () => {
      const steps = await measureSteps(page);
      expect(steps.framesThatStepped).toBeGreaterThan(0);
      expect(steps.mostStepsInAFrame).toBe(1);
    };
    await expectOneStepAFrame();

    await showTheme(page, "diorama");
    await showTheme(page, "pixel-depot");
    await expectOneStepAFrame();

    await hideTab(page, true);
    await hideTab(page, false);
    await expectOneStepAFrame();

    await scrollCanvasOffScreen(page, "pixel-depot");
    await expectDrawsStop(page, "pixel-depot");
    expect((await measureSteps(page)).framesThatStepped).toBe(0);
    await scrollPage(page, 0);
    await expectDrawing(page, "pixel-depot");
    await expectOneStepAFrame();
  });

  test("the world's clock keeps real time on every theme, so nothing else steps it", async ({
    page,
  }) => {
    await instrumentScenes(page);
    await openScenePage(page);

    for (const theme of THEME_NAMES) {
      await showTheme(page, theme);
      const rate = await worldClockRate(page, theme);
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThan(MOST_CLOCK_RATE);
    }
  });
});

test.describe("lazy scene chunks", () => {
  test("each theme's chunk loads on first show and never again", async ({
    page,
  }) => {
    const chunkRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/scene\.[^/]*\.js/.test(request.url())) {
        chunkRequests.push(request.url());
      }
    });

    await openScenePage(page);
    await waitFrames(page, 5);
    expect(new Set(chunkRequests).size).toBe(1);

    await showTheme(page, "diorama");
    await waitFrames(page, 5);
    expect(new Set(chunkRequests).size).toBe(2);

    await showTheme(page, "pixel-depot");
    await waitFrames(page, 5);
    expect(new Set(chunkRequests).size).toBe(3);

    const fetched = chunkRequests.length;
    expect(fetched).toBe(3);
    for (const theme of THEME_NAMES) {
      await showTheme(page, theme);
      await waitFrames(page, 3);
    }
    expect(chunkRequests.length).toBe(fetched);
  });
});
