import type { Page } from "@playwright/test";
import { THEME_HOOKS, type ThemeName } from "../../../src/scene/contract";
import {
  canvas,
  clearSceneFault,
  countSceneCalls,
  drawCount,
  expect,
  expectDrawing,
  expectNoDraws,
  expectOneLoop,
  expectState,
  expectToggle,
  failSceneChunks,
  focusHero,
  holdSceneChunks,
  hideTab,
  injectSceneFault,
  instrumentScenes,
  isNowLineShowing,
  loadFontFace,
  nowMode,
  openScenePage,
  openWithCheckedStep,
  type PageProblems,
  pressKey,
  restoreSceneChunks,
  rewriteThemeHtml,
  root,
  RUNNING_TOGGLE,
  type SceneCallName,
  selectTheme,
  setColorScheme,
  showTheme,
  stateOf,
  sweepForTrain,
  test,
  waitFrames,
} from "./helpers";

async function expectStaticHero(page: Page, theme: ThemeName): Promise<void> {
  await expect(root(page, theme).locator(THEME_HOOKS.staticHero)).toBeVisible();
  await expect(canvas(page, theme)).toBeHidden();
  await expect(root(page, theme).locator(THEME_HOOKS.controls)).toBeHidden();
  expect(await nowMode(page, theme)).toBe("html");
  expect(await isNowLineShowing(page, theme)).toBe(true);
}

/** A failure is logged once it happens, and that is all the page should report. */
function expectLoggedFailure(problems: PageProblems): void {
  expect(problems.sceneErrors.length).toBeGreaterThan(0);
  expect(problems.pageErrors).toEqual([]);
  problems.sceneErrors.length = 0;
}

test.describe("a failed import", () => {
  test("an aborted chunk shows the static hero and the HTML line, and coming back retries", async ({
    page,
    problems,
  }) => {
    await openScenePage(page);

    await failSceneChunks(page);
    await selectTheme(page, "diorama");
    await expectState(page, "diorama", "failed");
    await expectStaticHero(page, "diorama");
    expectLoggedFailure(problems);

    await restoreSceneChunks(page);
    await showTheme(page, "interchange");
    await showTheme(page, "diorama");

    await expect(canvas(page, "diorama")).toBeVisible();
    await expect(
      root(page, "diorama").locator(THEME_HOOKS.staticHero),
    ).toBeHidden();
    await expectDrawing(page, "diorama");
    await expectOneLoop(page);
  });

  test("the first theme failing leaves the others selectable", async ({
    page,
    problems,
  }) => {
    await failSceneChunks(page);
    await openScenePage(page, { waitForRunning: false });
    await expectState(page, "interchange", "failed");
    await expectStaticHero(page, "interchange");
    expectLoggedFailure(problems);

    await restoreSceneChunks(page);
    await showTheme(page, "pixel-depot");
    await expectDrawing(page, "pixel-depot");
    await showTheme(page, "interchange");
    await expectDrawing(page, "interchange");
  });

  test("a stale import failing marks its own theme and leaves the shown one alone", async ({
    page,
    problems,
  }) => {
    const chunks = await holdSceneChunks(page);
    await openScenePage(page, { waitForRunning: false });
    await chunks.waitForCount(1);
    await chunks.release(0);
    await expectState(page, "interchange", "running");

    await selectTheme(page, "diorama");
    await chunks.waitForCount(2);
    await showTheme(page, "interchange");
    await chunks.abort(1);

    await expect.poll(() => stateOf(page, "diorama")).toBe("failed");
    expect(await stateOf(page, "interchange")).toBe("running");
    await expectDrawing(page, "interchange");
    await expectOneLoop(page);
    expectLoggedFailure(problems);
  });
});

test.describe("a missing contract hook", () => {
  test("a theme with no canvas fails its load and no other, with no page error", async ({
    page,
    problems,
  }) => {
    await rewriteThemeHtml(page, "interchange", (html) =>
      html.replace("data-rail-canvas", ""),
    );
    await openScenePage(page, { waitForRunning: false });

    await expectState(page, "interchange", "failed");
    await expect(
      root(page, "interchange").locator(THEME_HOOKS.staticHero),
    ).toBeVisible();
    expectLoggedFailure(problems);

    await showTheme(page, "diorama");
    await expectDrawing(page, "diorama");
  });

  test("a theme with no root at all logs its failure and throws nothing uncaught", async ({
    page,
    problems,
  }) => {
    await rewriteThemeHtml(page, "diorama", (html) =>
      html.replace('data-rail-theme-root="diorama"', ""),
    );
    await openScenePage(page);

    await selectTheme(page, "diorama");
    await expect.poll(() => problems.sceneErrors.length).toBeGreaterThan(0);
    expectLoggedFailure(problems);

    await showTheme(page, "interchange");
    await expectDrawing(page, "interchange");
  });
});

test.describe("a scene that throws", () => {
  const expectFailedThenRecovers = async (
    page: Page,
    problems: PageProblems,
    theme: ThemeName,
  ) => {
    await expectState(page, theme, "failed");
    await expectStaticHero(page, theme);
    expectLoggedFailure(problems);

    const other = theme === "interchange" ? "diorama" : "interchange";
    await showTheme(page, other);
    await showTheme(page, theme);
    await expectDrawing(page, theme);
    await expectOneLoop(page);
  };

  test("a throw from drawing fails the load, stops drawing, and a return draws again", async ({
    page,
    problems,
  }) => {
    await openScenePage(page);
    await expectDrawing(page, "interchange");

    await page.evaluate(() => {
      window.__sceneSpy.throwOnCanvasCalls = "interchange";
    });
    await expectState(page, "interchange", "failed");
    await expectNoDraws(page, "interchange");

    await page.evaluate(() => {
      window.__sceneSpy.throwOnCanvasCalls = null;
    });
    await expectFailedThenRecovers(page, problems, "interchange");
  });

  test("a throw from resizing on first show fails the load, and a return retries", async ({
    page,
    problems,
  }) => {
    await openScenePage(page);

    await page.evaluate(() => {
      window.__sceneSpy.throwOnWidthWrites = "diorama";
    });
    await selectTheme(page, "diorama");
    await expectState(page, "diorama", "failed");

    await page.evaluate(() => {
      window.__sceneSpy.throwOnWidthWrites = null;
    });
    await expectFailedThenRecovers(page, problems, "diorama");
  });

  test("a throw from resizing on a width change fails the load", async ({
    page,
    problems,
  }) => {
    await openScenePage(page);

    await page.evaluate(() => {
      window.__sceneSpy.throwOnWidthWrites = "interchange";
    });
    await page.setViewportSize({ width: 1000, height: 720 });
    await expectState(page, "interchange", "failed");

    await page.evaluate(() => {
      window.__sceneSpy.throwOnWidthWrites = null;
    });
    await expectFailedThenRecovers(page, problems, "interchange");
  });

  const TRIGGERS: readonly (readonly [
    method: SceneCallName,
    trigger: (page: Page) => Promise<unknown>,
  ])[] = [
    ["hitTrain", (page) => sweepForTrain(page, "interchange")],
    ["applyColorScheme", (page) => setColorScheme(page, "dark")],
    ["onFontsReady", (page) => loadFontFace(page, "Failing Face")],
  ];

  for (const [method, trigger] of TRIGGERS) {
    test(`a throw from ${method} fails the load, and a return retries`, async ({
      page,
      problems,
    }) => {
      await instrumentScenes(page);
      await openScenePage(page);
      await waitFrames(page, 3);

      await injectSceneFault(page, "interchange", method);
      await trigger(page);
      await expectState(page, "interchange", "failed");

      await clearSceneFault(page);
      await expectFailedThenRecovers(page, problems, "interchange");
      // Forgotten rather than reshown: the retry builds a new scene.
      expect(await countSceneCalls(page, "interchange", "createScene")).toBe(2);
    });
  }

  test("a throw from createScene fails the load, and a return retries", async ({
    page,
    problems,
  }) => {
    await instrumentScenes(page);
    await openScenePage(page);

    await injectSceneFault(page, "diorama", "createScene");
    await selectTheme(page, "diorama");
    await expectState(page, "diorama", "failed");

    await clearSceneFault(page);
    await expectFailedThenRecovers(page, problems, "diorama");
  });

  test("a failed theme takes no keys, and Space goes back to scrolling the page", async ({
    page,
    problems,
  }) => {
    await openScenePage(page);
    await page.addStyleTag({ content: "body { padding-bottom: 5000px; }" });

    await page.evaluate(() => {
      window.__sceneSpy.throwOnCanvasCalls = "interchange";
    });
    await expectState(page, "interchange", "failed");
    expectLoggedFailure(problems);

    await focusHero(page, "interchange");
    await pressKey(page, " ");

    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    await expectToggle(page, "interchange", RUNNING_TOGGLE);
  });
});

test.describe("an engine bug", () => {
  test("a throw from the step is not the theme's failed load, reaches the page, and the next wake carries on", async ({
    page,
    problems,
  }) => {
    await openWithCheckedStep(page);
    await expectDrawing(page, "interchange");

    await page.evaluate(() => {
      window.__sceneSpy.stepFault = true;
    });
    await expect
      .poll(() => problems.pageErrors.join())
      .toContain("Injected engine fault");
    expect(await stateOf(page, "interchange")).toBe("running");
    expect(problems.sceneErrors).toEqual([]);
    problems.pageErrors.length = 0;

    await page.evaluate(() => {
      window.__sceneSpy.stepFault = false;
    });
    const before = await drawCount(page, "interchange");
    await hideTab(page, false);
    await expect
      .poll(() => drawCount(page, "interchange"))
      .toBeGreaterThan(before);
    expect(await stateOf(page, "interchange")).toBe("running");
  });
});
