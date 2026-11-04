import { expect, type Page } from "@playwright/test";
import type { ThemeName } from "../../../src/scene/contract";
import {
  expectShowing,
  frames,
  readSavedTheme,
  serveWithCss,
  switcherChoice,
  switcherToggle,
  tallSectionsCss,
  test,
  THEMES,
} from "../selection/support";
import {
  isListBesideToggle,
  isOnTopAtCentre,
  LAYOUT_TOLERANCE,
  openListByKeyboard,
  openListByMouse,
  openOnTheme,
  pressKey,
  rectOf,
  showingList,
} from "./support";

test.describe.configure({ mode: "parallel" });

/**
 * What a theme's header can do to whatever it contains. Static so that scrolling moves
 * the toggle, whichever way a theme positions its header.
 */
const CLIPPING_HEADER_CSS = `
  header {
    position: static !important;
    overflow: hidden !important;
    transform: translateX(0) !important;
    backdrop-filter: blur(2px) !important;
  }
`;

/** Whatever a theme's header does with spare width, the toggle now moves with it. */
const TOGGLE_AT_HEADER_END_CSS = `
  header [data-theme-switcher] { margin-inline-start: auto !important; }
`;

const SHORT_VIEWPORT = { width: 320, height: 180 };

test.describe("a header that clips and traps what it holds", () => {
  for (const theme of THEMES) {
    test(`${theme}: every link stays reachable and picks`, async ({ page }) => {
      const to = theme === "diorama" ? "pixel-depot" : "diorama";
      await serveWithCss(page, CLIPPING_HEADER_CSS);
      await openOnTheme(page, theme);

      await openListByMouse(page);

      expect(await isListBesideToggle(page)).toBe(true);
      for (const name of THEMES) {
        expect(await isOnTopAtCentre(switcherChoice(page, name))).toBe(true);
      }

      await switcherChoice(page, to).click();
      await expectShowing(page, to);
      expect(await readSavedTheme(page)).toBe(to);
    });

    test(`${theme}: the list follows the toggle when the page scrolls`, async ({
      page,
    }) => {
      await serveWithCss(page, CLIPPING_HEADER_CSS + tallSectionsCss());
      await openOnTheme(page, theme);
      await openListByMouse(page);
      const toggleBefore = await rectOf(switcherToggle(page));
      const listBefore = await rectOf(showingList(page));

      await page.evaluate(() =>
        window.scrollBy({ top: 30, behavior: "instant" }),
      );

      const toggleAfter = await rectOf(switcherToggle(page));
      expect(toggleAfter.top).toBeLessThan(toggleBefore.top);
      await expect
        .poll(async () => (await rectOf(showingList(page))).top)
        .toBeCloseTo(listBefore.top - (toggleBefore.top - toggleAfter.top), 0);
    });

    test(`${theme}: the list follows the toggle when the viewport resizes`, async ({
      page,
    }) => {
      await serveWithCss(page, CLIPPING_HEADER_CSS + TOGGLE_AT_HEADER_END_CSS);
      await openOnTheme(page, theme);
      await openListByMouse(page);
      const { width, height } = page.viewportSize() ?? {
        width: 0,
        height: 0,
      };
      const toggleBefore = await rectOf(switcherToggle(page));
      const listPastToggle = async () =>
        (await rectOf(showingList(page))).right -
        (await rectOf(switcherToggle(page))).right;
      const listPastToggleBefore = await listPastToggle();

      await page.setViewportSize({ width: width - 150, height });

      await expect
        .poll(async () => (await rectOf(switcherToggle(page))).right)
        .not.toBeCloseTo(toggleBefore.right, 0);
      await expect
        .poll(async () =>
          Math.abs((await listPastToggle()) - listPastToggleBefore),
        )
        .toBeLessThanOrEqual(LAYOUT_TOLERANCE);
    });
  }
});

test.describe("a viewport too short for the list", () => {
  test("scrolling the page keeps the place the list was scrolled to", async ({
    page,
  }) => {
    const LIST_SCROLL = 40;
    await page.setViewportSize(SHORT_VIEWPORT);
    await serveWithCss(page, tallSectionsCss());
    await openOnTheme(page);
    await openListByMouse(page);
    const list = showingList(page);
    const listScroll = () => list.evaluate((element) => element.scrollTop);
    await list.evaluate((element, top) => {
      element.scrollTop = top;
    }, LIST_SCROLL);
    expect(await listScroll()).toBe(LIST_SCROLL);
    const listBefore = await rectOf(list);

    await page.evaluate(() =>
      window.scrollBy({ top: 30, behavior: "instant" }),
    );

    // Moved, so the list has been placed again since it was scrolled.
    await expect
      .poll(async () => (await rectOf(list)).top)
      .not.toBeCloseTo(listBefore.top, 0);
    await frames(page);
    expect(await listScroll()).toBe(LIST_SCROLL);
  });

  test("the list grows back when the viewport does", async ({ page }) => {
    await page.setViewportSize(SHORT_VIEWPORT);
    await openOnTheme(page);
    await openListByMouse(page);
    const list = showingList(page);
    const isCutShort = () =>
      list.evaluate((element) => element.scrollHeight > element.clientHeight);
    expect(await isCutShort()).toBe(true);

    await page.setViewportSize({ width: 1280, height: 720 });

    await expect.poll(isCutShort).toBe(false);
  });

  async function expectFocusedLinkInsideList(page: Page, name: ThemeName) {
    const choice = switcherChoice(page, name);
    await expect(choice).toBeFocused();
    await frames(page);
    const link = await rectOf(choice);
    const list = await rectOf(showingList(page));
    expect(link.top).toBeGreaterThanOrEqual(list.top - LAYOUT_TOLERANCE);
    expect(link.bottom).toBeLessThanOrEqual(list.bottom + LAYOUT_TOLERANCE);
    expect(list.bottom).toBeLessThanOrEqual(
      SHORT_VIEWPORT.height + LAYOUT_TOLERANCE,
    );
  }

  for (const theme of THEMES) {
    test(`${theme}: the focused link stays inside the list and the page does not move`, async ({
      page,
    }) => {
      await page.setViewportSize(SHORT_VIEWPORT);
      await serveWithCss(page, tallSectionsCss());
      await openOnTheme(page, theme);
      const scrollBefore = await page.evaluate(() => window.scrollY);

      await openListByKeyboard(page);
      await expectFocusedLinkInsideList(page, theme);

      const steps = [
        ["End", "pixel-depot"],
        ["Home", "interchange"],
        ["ArrowUp", "pixel-depot"],
        ["ArrowDown", "interchange"],
        ["ArrowDown", "diorama"],
      ] as const;
      for (const [key, name] of steps) {
        await pressKey(page, key);
        await expectFocusedLinkInsideList(page, name);
      }

      expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    });
  }
});
