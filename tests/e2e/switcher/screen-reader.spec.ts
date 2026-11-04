import { expect, type Page } from "@playwright/test";
import {
  expectShowing,
  pickTheme,
  showingSwitcher,
  switcherChoice,
  switcherToggle,
  test,
  themeRoot,
  THEME_PAIRS,
  THEMES,
} from "../selection/support";
import { THEME_META } from "../../../src/themes/registry";
import { openListByMouse, openOnTheme } from "./support";

test.describe.configure({ mode: "parallel" });

function idsUsedTwice(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map(({ id }) => id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
}

async function expectOneOfEach(page: Page): Promise<void> {
  await expect(
    page.getByRole("navigation", { name: "Design theme" }),
  ).toHaveCount(1);
  await expect(switcherToggle(page)).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  expect(await idsUsedTwice(page)).toEqual([]);
}

test.describe("what a screen reader finds", () => {
  for (const { from, to } of THEME_PAIRS) {
    test(`${from} to ${to}: announces the new theme from the focused toggle, with one of everything exposed`, async ({
      page,
    }) => {
      await openOnTheme(page, from);
      await expectOneOfEach(page);

      await pickTheme(page, to);
      await expectShowing(page, to);

      await expect(switcherToggle(page)).toBeFocused();
      await expect(switcherToggle(page)).toHaveAccessibleName(
        `Design theme: ${THEME_META[to].label}`,
      );
      await expectOneOfEach(page);
    });
  }

  for (const theme of THEMES) {
    test(`${theme}: the closed list exposes no links, and the open one exposes each theme and marks the current one`, async ({
      page,
    }) => {
      await openOnTheme(page, theme);
      await expect(showingSwitcher(page).getByRole("link")).toHaveCount(0);

      await openListByMouse(page);

      await expect(showingSwitcher(page).getByRole("link")).toHaveCount(
        THEMES.length,
      );
      for (const name of THEMES) {
        const choice = switcherChoice(page, name);
        if (name === theme) {
          await expect(choice).toHaveAttribute("aria-current", "true");
        } else {
          await expect(choice).not.toHaveAttribute("aria-current", /.*/);
        }
      }
    });

    test(`${theme}: the toggle controls a list in the showing theme`, async ({
      page,
    }) => {
      await openOnTheme(page, theme);

      const listId = await switcherToggle(page).getAttribute("aria-controls");

      await expect(
        themeRoot(page, theme).locator(`[id="${listId}"]`),
      ).toHaveCount(1);
    });
  }
});
