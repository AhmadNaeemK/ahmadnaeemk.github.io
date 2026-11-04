import { THEME_NAMES } from "../../../src/scene/contract";
import {
  expect,
  hero,
  instrumentScenes,
  isNowLineShowing,
  openScenePage,
  rewriteThemeHtml,
  showTheme,
  test,
  waitFrames,
} from "./helpers";

const NOW_LIST = /(<ul class="now__list"[^>]*>)[\s\S]*?(<\/ul>)/;
const LONG_VALUE =
  "a very long single item about something that keeps on going and going, and then goes on a good while longer, well past the width of any phone";
const NOW_ITEM_MARKUP = `<li><span class="now__k">Reading</span> <span class="now__v">${LONG_VALUE}</span></li>`;

for (const theme of THEME_NAMES) {
  test.describe(`${theme} with a single long Right now item`, () => {
    test.beforeEach(async ({ page }) => {
      await rewriteThemeHtml(page, theme, (html) =>
        html.replace(NOW_LIST, `$1${NOW_ITEM_MARKUP}$2`),
      );
      await instrumentScenes(page);
    });

    for (const width of [320, 375]) {
      test(`the HTML line fits at ${width} px, with no sideways scrolling`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 720 });
        await openScenePage(page);
        await showTheme(page, theme);
        await waitFrames(page, 3);

        expect(await isNowLineShowing(page, theme)).toBe(true);
        const box = await hero(page, theme).locator(".now").boundingBox();
        expect(box && box.x + box.width).toBeLessThanOrEqual(width);
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(overflow).toBe(0);
      });
    }

    test("the item stays put rather than cycling, and the scene gets exactly that one", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 720 });
      await openScenePage(page);
      await showTheme(page, theme);

      const items = hero(page, theme).locator(".now__list li");
      await expect(items).toHaveCount(1);
      const position = await items.boundingBox();
      await waitFrames(page, 30);
      await expect(items).toHaveCount(1);
      await expect(items).toContainText(LONG_VALUE);
      expect(await items.boundingBox()).toEqual(position);

      const nowItems = await page.evaluate(
        (name) => window.__sceneSpy.contexts[name].nowItems,
        theme,
      );
      expect(nowItems).toEqual([{ label: "Reading", value: LONG_VALUE }]);
    });
  });
}
