import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator } from "@playwright/test";
import { THEME_HOOKS, THEME_ROOT_ATTRIBUTE } from "../../../src/scene/contract";
import {
  expectShowing,
  hasSidewaysScroll,
  readSavedTheme,
  switcherChoice,
  switcherToggle,
  test,
  THEMES,
} from "../selection/support";
import {
  expectListClosed,
  expectListOpen,
  isOnTopAtCentre,
  LAYOUT_TOLERANCE,
  openListByMouse,
  openOnTheme,
  rectOf,
  showingList,
} from "./support";

test.describe.configure({ mode: "parallel" });

const PHONE_WIDTHS = [320, 390];
const PHONE_HEIGHT = 700;
const COLOR_SCHEMES = ["light", "dark"] as const;

/** The least a finger should have to hit (WCAG 2.5.5). */
const TOUCH_TARGET = 44;

/** The toggle draws shorter than a finger, so its target is measured by hit-testing. */
function toggleAnswersAcrossTouchTarget(toggle: Locator): Promise<boolean> {
  return toggle.evaluate((element, target) => {
    const { top, left, width, height } = element.getBoundingClientRect();
    const centreX = left + width / 2;
    const centreY = top + height / 2;
    const reach = target / 2 - 1;
    return [centreY - reach, centreY + reach].every((y) => {
      const hit = document.elementFromPoint(centreX, y);
      return hit !== null && element.contains(hit);
    });
  }, TOUCH_TARGET);
}

for (const theme of THEMES) {
  for (const colorScheme of COLOR_SCHEMES) {
    for (const width of PHONE_WIDTHS) {
      test(`${theme}, ${colorScheme}, ${width} px: the open list fits, each link can be pressed, and axe is clean`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: PHONE_HEIGHT });
        await page.emulateMedia({ colorScheme });
        await openOnTheme(page, theme);
        expect(await toggleAnswersAcrossTouchTarget(switcherToggle(page))).toBe(
          true,
        );

        await openListByMouse(page);

        const list = await rectOf(showingList(page));
        expect(list.left).toBeGreaterThanOrEqual(0);
        expect(list.top).toBeGreaterThanOrEqual(0);
        expect(list.right).toBeLessThanOrEqual(width);
        expect(list.bottom).toBeLessThanOrEqual(PHONE_HEIGHT);
        expect(await hasSidewaysScroll(page)).toBe(false);

        for (const name of THEMES) {
          const choice = switcherChoice(page, name);
          const { height } = await rectOf(choice);
          expect(height).toBeGreaterThanOrEqual(
            TOUCH_TARGET - LAYOUT_TOLERANCE,
          );
          expect(await isOnTopAtCentre(choice)).toBe(true);
        }

        const { violations } = await new AxeBuilder({ page })
          .include(
            `[${THEME_ROOT_ATTRIBUTE}="${theme}"] ${THEME_HOOKS.themeSwitcher}`,
          )
          .analyze();
        expect(
          violations.map(
            ({ id, nodes }) =>
              `${id}: ${nodes.map(({ target }) => target.join(" ")).join(", ")}`,
          ),
        ).toEqual([]);
      });
    }
  }
}

test.describe("by touch", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  for (const theme of THEMES) {
    test(`${theme}: a tap opens the list, and a tap on a link picks it`, async ({
      page,
    }) => {
      const to = theme === "diorama" ? "pixel-depot" : "diorama";
      await openOnTheme(page, theme);

      await switcherToggle(page).tap();
      await expectListOpen(page);

      await switcherChoice(page, to).tap();

      await expectShowing(page, to);
      expect(await readSavedTheme(page)).toBe(to);
      await expectListClosed(page);
      await expect(switcherToggle(page)).toBeFocused();
    });
  }

  test("a tap outside closes the list and picks nothing", async ({ page }) => {
    await openOnTheme(page);
    await switcherToggle(page).tap();
    await expectListOpen(page);

    await page.getByRole("heading", { level: 1 }).tap();

    await expectListClosed(page);
    await expectShowing(page, "interchange");
    expect(await readSavedTheme(page)).toBeNull();
  });
});
