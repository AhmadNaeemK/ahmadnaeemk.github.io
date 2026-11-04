/** What the switcher specs share. Built on the selection specs' own helpers. */
import { expect, type Locator, type Page } from "@playwright/test";
import {
  DEFAULT_THEME,
  themeHash,
  type ThemeName,
} from "../../../src/scene/contract";
import {
  expectShowing,
  sceneSettled,
  showingSwitcher,
  switcherChoice,
  switcherToggle,
  THEMES,
} from "../selection/support";

export interface Rect {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly width: number;
  readonly height: number;
}

/** Layout can land on a fraction of a pixel. */
export const LAYOUT_TOLERANCE = 1;

/** The scripts write `aria-expanded`, and nothing else does. */
export async function expectSwitcherScripted(page: Page): Promise<void> {
  await expect(switcherToggle(page)).toHaveAttribute("aria-expanded", /.+/);
}

/** With the scene settled, so nothing is still moving the toggle. */
export async function openOnTheme(
  page: Page,
  theme: ThemeName = DEFAULT_THEME,
): Promise<void> {
  await page.goto(theme === DEFAULT_THEME ? "/" : `/${themeHash(theme)}`);
  await expectShowing(page, theme);
  await sceneSettled(page, theme);
  await expectSwitcherScripted(page);
}

/** WebKit drops a zero-duration arrow press while a scene's rAF loop runs. */
export function pressKey(page: Page, key: string): Promise<void> {
  return page.keyboard.press(key, { delay: 120 });
}

/** `focus()` would scroll the page, which some specs are measuring. */
export function focusInPlace(target: Locator): Promise<void> {
  return target.evaluate((element: HTMLElement) =>
    element.focus({ preventScroll: true }),
  );
}

export async function expectListOpen(page: Page): Promise<void> {
  await expect(switcherToggle(page)).toHaveAttribute("aria-expanded", "true");
  for (const theme of THEMES) {
    await expect(switcherChoice(page, theme)).toBeVisible();
  }
}

export async function expectListClosed(page: Page): Promise<void> {
  await expect(switcherToggle(page)).toHaveAttribute("aria-expanded", "false");
  for (const theme of THEMES) {
    await expect(switcherChoice(page, theme)).toBeHidden();
  }
}

/** Open anywhere on the page, including inside a hidden theme. */
export function openListCount(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll(":popover-open").length);
}

export async function openListByMouse(page: Page): Promise<void> {
  await switcherToggle(page).click();
  await expectListOpen(page);
}

export async function openListByKeyboard(page: Page): Promise<void> {
  await focusInPlace(switcherToggle(page));
  await pressKey(page, "ArrowDown");
  await expectListOpen(page);
}

export function rectOf(target: Locator): Promise<Rect> {
  return target.evaluate((element) => {
    const { top, bottom, left, right, width, height } =
      element.getBoundingClientRect();
    return { top, bottom, left, right, width, height };
  });
}

/** Whether a press at the element's centre would reach it. */
export function isOnTopAtCentre(target: Locator): Promise<boolean> {
  return target.evaluate((element) => {
    const { top, left, width, height } = element.getBoundingClientRect();
    const hit = document.elementFromPoint(left + width / 2, top + height / 2);
    return hit !== null && element.contains(hit);
  });
}

export function showingList(page: Page): Locator {
  return showingSwitcher(page).getByRole("list", { includeHidden: true });
}

/** Directly above or below the toggle, and overlapping it sideways. */
export async function isListBesideToggle(page: Page): Promise<boolean> {
  const [toggle, list] = await Promise.all([
    rectOf(switcherToggle(page)),
    rectOf(showingList(page)),
  ]);
  const NEAR_TOGGLE = 16;
  const below = list.top - toggle.bottom;
  const above = toggle.top - list.bottom;
  const isAdjacent =
    (below >= 0 && below <= NEAR_TOGGLE) ||
    (above >= 0 && above <= NEAR_TOGGLE);
  return isAdjacent && list.left < toggle.right && list.right > toggle.left;
}
