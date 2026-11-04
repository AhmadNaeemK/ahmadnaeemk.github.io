import { sectionId, themeHash, THEME_HOOKS } from "../../../src/scene/contract";
import { COMPACT_VIEW, VIEW_WIDTH } from "../../../src/themes/diorama/view";
import {
  addSceneSpy,
  canvas,
  expect,
  failSceneChunks,
  isNowLineShowing,
  root,
  test,
} from "../scene/helpers";
import { DIORAMA, expectSceneState } from "./support";

const NARROWEST = { width: 320, height: 640 };
const SUB_PIXEL = 1;

test.use({ viewport: NARROWEST });

test.describe("a failed load at the narrowest width", () => {
  test.beforeEach(async ({ page }) => {
    await addSceneSpy(page);
    await failSceneChunks(page);
    await page.goto(`/${themeHash(DIORAMA)}`);
    await expectSceneState(page, DIORAMA, "failed");
  });

  test.afterEach(({ problems }) => {
    // The failure is the point of these tests, and the runtime logs it.
    expect(problems.sceneErrors.length).toBeGreaterThan(0);
    problems.sceneErrors.length = 0;
  });

  test("shows the static hero and the page's own line, with no canvas or controls", async ({
    page,
  }) => {
    const staticHero = root(page, DIORAMA).locator(THEME_HOOKS.staticHero);
    await expect(staticHero).toBeVisible();
    await expect(staticHero).toContainText(/\S/);
    await expect(canvas(page, DIORAMA)).toBeHidden();
    await expect(
      root(page, DIORAMA).locator(THEME_HOOKS.controls),
    ).toBeHidden();
    expect(await isNowLineShowing(page, DIORAMA)).toBe(true);
  });

  test("fits the name plate inside the board, clipping nothing and growing nothing", async ({
    page,
  }) => {
    const staticHero = root(page, DIORAMA).locator(THEME_HOOKS.staticHero);
    const fit = await staticHero.evaluate((element: HTMLElement) => {
      const parent = element.parentElement as HTMLElement;
      const box = element.getBoundingClientRect();
      const parentBox = parent.getBoundingClientRect();
      const words = document.createRange();
      words.selectNodeContents(element);
      const wordsBox = words.getBoundingClientRect();
      return {
        wordsTop: wordsBox.top - box.top,
        wordsBottom: box.bottom - wordsBox.bottom,
        wordsLeft: wordsBox.left - box.left,
        wordsRight: box.right - wordsBox.right,
        overflow: element.scrollHeight - element.clientHeight,
        overflowSideways: element.scrollWidth - element.clientWidth,
        staticOverParent: box.height - parentBox.height,
        parentWidth: parentBox.width,
        parentHeight: parentBox.height,
      };
    });

    expect(fit.wordsTop).toBeGreaterThanOrEqual(0);
    expect(fit.wordsBottom).toBeGreaterThanOrEqual(0);
    expect(fit.wordsLeft).toBeGreaterThanOrEqual(0);
    expect(fit.wordsRight).toBeGreaterThanOrEqual(0);
    expect(fit.overflow).toBeLessThanOrEqual(SUB_PIXEL);
    expect(fit.overflowSideways).toBeLessThanOrEqual(SUB_PIXEL);
    expect(fit.staticOverParent).toBeLessThanOrEqual(SUB_PIXEL);
    // Still the height the running scene will draw at: the compact view's own.
    const reserved = fit.parentWidth * (COMPACT_VIEW.height / VIEW_WIDTH);
    expect(Math.abs(fit.parentHeight - reserved)).toBeLessThanOrEqual(
      SUB_PIXEL,
    );
  });

  test("leaves the page readable: no sideways scrolling, and every section still there", async ({
    page,
  }) => {
    const scrollsSideways = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(scrollsSideways).toBe(false);
    await expect(
      page.locator(`#${sectionId(DIORAMA, "contact")}`),
    ).toBeVisible();
  });
});
