import { expect } from "@playwright/test";
import {
  currentHash,
  expectShowing,
  pickTheme,
  readSavedTheme,
  switcherChoice,
  switcherToggle,
  test,
  THEME_PAIRS,
} from "../selection/support";
import {
  expectListClosed,
  expectListOpen,
  openListByMouse,
  openOnTheme,
} from "./support";

test.describe.configure({ mode: "parallel" });

test.describe("choosing with the mouse", () => {
  for (const { from, to } of THEME_PAIRS) {
    test(`${from} to ${to}: saves, links, and leaves focus on the new theme's closed switcher`, async ({
      page,
    }) => {
      await openOnTheme(page, from);
      await expectListClosed(page);

      await openListByMouse(page);
      await expect(switcherChoice(page, from)).toBeFocused();

      await switcherChoice(page, to).click();

      await expectShowing(page, to);
      expect(await readSavedTheme(page)).toBe(to);
      expect(await currentHash(page)).toBe(`#${to}`);
      await expect(switcherToggle(page)).toBeFocused();
      await expectListClosed(page);
    });
  }

  test("a pick adds no step to the history", async ({ page }) => {
    await openOnTheme(page);
    const stepsBefore = await page.evaluate(() => history.length);

    await pickTheme(page, "diorama");
    await expectShowing(page, "diorama");

    expect(await page.evaluate(() => history.length)).toBe(stepsBefore);
  });

  test("the theme left behind shows its list closed on coming back, and it still opens", async ({
    page,
  }) => {
    await openOnTheme(page, "interchange");
    await pickTheme(page, "diorama");
    await expectShowing(page, "diorama");

    await pickTheme(page, "interchange");

    await expectShowing(page, "interchange");
    await expectListClosed(page);
    await openListByMouse(page);
  });

  test("clicking the toggle again closes the list, and a third click opens it", async ({
    page,
  }) => {
    await openOnTheme(page);
    await openListByMouse(page);

    await switcherToggle(page).click();
    await expectListClosed(page);
    await expect(switcherToggle(page)).toBeFocused();

    await switcherToggle(page).click();
    await expectListOpen(page);
  });

  test("an outside click closes the list and picks nothing", async ({
    page,
  }) => {
    await openOnTheme(page);
    await openListByMouse(page);

    await page.getByRole("heading", { level: 1 }).click();

    await expectListClosed(page);
    await expectShowing(page, "interchange");
    expect(await readSavedTheme(page)).toBeNull();
    expect(await currentHash(page)).toBe("");
  });
});
