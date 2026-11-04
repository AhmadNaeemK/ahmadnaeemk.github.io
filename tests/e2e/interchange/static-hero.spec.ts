import { type Page } from "@playwright/test";
import { THEME_HOOKS } from "../../../src/scene/contract";
import {
  canvas,
  expect,
  expectState,
  failSceneChunks,
  openScenePage,
  root,
  test as sceneTest,
  toggle,
} from "../scene/helpers";
import { test as noScriptTest, themeRoot } from "../selection/support";
import { coloursBySize, decodeScreenshot, DESKTOP, THEME } from "./support";

/**
 * Five line colours and the track, each drawn over at least this share of the box.
 * Enough to tell the map from a blank box or from one colour of line.
 */
const FEWEST_TRACK_COLOURS = 5;
const SMALLEST_TRACK_SHARE = 0.002;
const SMALLEST_DRAWN_SHARE = 0.05;

const NARROW = { width: 320, height: 640 };

async function expectTracksDrawn(
  page: Page,
  staticHero: ReturnType<Page["locator"]>,
): Promise<void> {
  await expect(staticHero).toBeVisible();
  const box = await staticHero.boundingBox();
  if (!box) throw new Error("The static hero is not showing.");
  const pixels = decodeScreenshot(
    await page.screenshot({
      clip: box,
      scale: "css",
    }),
  );
  const total = pixels.width * pixels.height;
  const [[, backgroundSize], ...drawn] = coloursBySize(pixels);
  expect(1 - backgroundSize / total).toBeGreaterThan(SMALLEST_DRAWN_SHARE);
  expect(
    drawn.filter(([, size]) => size / total >= SMALLEST_TRACK_SHARE).length,
  ).toBeGreaterThanOrEqual(FEWEST_TRACK_COLOURS);
}

for (const colorScheme of ["light", "dark"] as const) {
  for (const viewport of [DESKTOP, NARROW]) {
    const where = `${colorScheme}, ${viewport.width} px`;

    noScriptTest.describe(`with JavaScript off (${where})`, () => {
      // Really off: `@media (scripting: none)` responds to nothing else.
      noScriptTest.use({ javaScriptEnabled: false, viewport, colorScheme });

      noScriptTest("the tracks show", async ({ page }) => {
        await page.goto("/");
        const interchange = themeRoot(page, THEME);
        await expectTracksDrawn(
          page,
          interchange.locator(THEME_HOOKS.staticHero),
        );
      });
    });

    sceneTest.describe(`after a scene chunk fails (${where})`, () => {
      sceneTest.use({ viewport, colorScheme });

      sceneTest(
        "the tracks show, and the controls for a train do not",
        async ({ page, problems }) => {
          await failSceneChunks(page);
          await openScenePage(page, { waitForRunning: false });
          await expectState(page, THEME, "failed");
          problems.sceneErrors.length = 0;

          await expectTracksDrawn(
            page,
            root(page, THEME).locator(THEME_HOOKS.staticHero),
          );
          await expect(canvas(page, THEME)).toBeHidden();
          await expect(toggle(page, THEME)).toBeHidden();
        },
      );
    });
  }
}

sceneTest("with a scene running, the tracks give way", async ({ page }) => {
  await openScenePage(page);
  await expect(root(page, THEME).locator(THEME_HOOKS.staticHero)).toBeHidden();
});
