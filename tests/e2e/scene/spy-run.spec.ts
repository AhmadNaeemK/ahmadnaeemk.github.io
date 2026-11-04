/**
 * Runs each theme through every path the contract gives it, on the real scene
 * module. `createWorldView` makes a theme that casts `WorldView` to `World` throw,
 * so a cast anywhere in a scene shows up here as a failed load.
 */
import { LIVERY_ORDER, SPEEDS } from "../../../src/rail";
import { THEME_NAMES } from "../../../src/scene/contract";
import {
  expect,
  expectToggle,
  findTrain,
  instrumentScenes,
  liveryButton,
  loadFontFace,
  openScenePage,
  pressTrain,
  RUNNING_TOGGLE,
  sceneCalls,
  setColorScheme,
  showTheme,
  speedButton,
  statesSeen,
  STOPPED_TOGGLE,
  test,
  toggle,
  waitFrames,
} from "./helpers";

const COMPACT_VIEWPORT = { width: 375, height: 720 };
const WIDE_VIEWPORT = { width: 1280, height: 720 };
const WORLD_ONLY_KEYS = [
  "speedIndex",
  "userStopped",
  "textPaused",
  "update",
  "toggleStop",
  "setSpeed",
  "setLivery",
];

for (const theme of THEME_NAMES) {
  test(`${theme} takes every path in the contract without failing`, async ({
    page,
  }) => {
    await instrumentScenes(page);
    await openScenePage(page);
    await page.evaluate(() => {
      window.__sceneSpy.watchWorld = true;
    });
    await showTheme(page, theme);
    await waitFrames(page, 5);

    await pressTrain(page, theme);
    await expectToggle(page, theme, STOPPED_TOGGLE);
    await pressTrain(page, theme);
    await expectToggle(page, theme, RUNNING_TOGGLE);

    const train = await findTrain(page, theme);
    await page.mouse.move(train.x, train.y);
    await page.mouse.click(train.x, train.y);
    await page.mouse.move(0, 0);

    for (let index = 0; index < SPEEDS.length; index += 1) {
      await speedButton(page, theme, index).click();
      await waitFrames(page, 2);
    }
    for (const livery of LIVERY_ORDER) {
      await liveryButton(page, theme, livery).click();
      await waitFrames(page, 2);
    }
    await toggle(page, theme).click();
    await waitFrames(page, 2);
    await toggle(page, theme).click();

    await page.setViewportSize(COMPACT_VIEWPORT);
    await waitFrames(page, 5);
    await findTrain(page, theme);
    await page.setViewportSize(WIDE_VIEWPORT);
    await waitFrames(page, 5);

    await setColorScheme(page, "dark");
    await waitFrames(page, 3);
    await setColorScheme(page, "light");
    await loadFontFace(page, "Spy Run");
    await waitFrames(page, 5);

    expect(await statesSeen(page, theme)).not.toContain("failed");
    const called = new Set(await sceneCalls(page, theme));
    expect([...called].sort()).toEqual([
      "applyColorScheme",
      "createScene",
      "draw",
      "hitTrain",
      "onFontsReady",
      "resize",
    ]);

    const { worldChecks, worldChanges } = await page.evaluate(() => ({
      worldChecks: window.__sceneSpy.worldChecks,
      worldChanges: window.__sceneSpy.worldChanges,
    }));
    expect(worldChecks).toBeGreaterThan(0);
    expect(worldChanges).toEqual([]);
  });
}

test("a scene is handed a world with no controls to reach", async ({
  page,
}) => {
  await instrumentScenes(page);
  await openScenePage(page);
  const reachable = await page.evaluate(
    ({ name, keys }) => {
      const world = window.__sceneSpy.contexts[name].world as unknown as Record<
        string,
        unknown
      >;
      return keys.filter((key) => {
        try {
          void world[key];
          return true;
        } catch {
          return false;
        }
      });
    },
    { name: "interchange", keys: WORLD_ONLY_KEYS },
  );

  expect(reachable).toEqual([]);
});
