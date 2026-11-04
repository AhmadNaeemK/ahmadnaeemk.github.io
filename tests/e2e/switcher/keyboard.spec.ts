import { expect } from "@playwright/test";
import {
  currentHash,
  expectShowing,
  frames,
  readSavedTheme,
  serveWithCss,
  showingSwitcher,
  switcherChoice,
  switcherToggle,
  tallSectionsCss,
  test,
} from "../selection/support";
import {
  expectListClosed,
  expectListOpen,
  focusInPlace,
  openListByKeyboard,
  openListByMouse,
  openOnTheme,
  pressKey,
} from "./support";

test.describe.configure({ mode: "parallel" });

/** Enough for a smooth scroll from a Space press to have visibly started. */
const FRAMES_FOR_A_SCROLL_TO_SHOW = 15;

test.describe("opening from the toggle", () => {
  for (const key of ["ArrowDown", "ArrowUp", "Enter", " "]) {
    test(`"${key}" opens the list on the current theme`, async ({ page }) => {
      await openOnTheme(page, "diorama");
      await focusInPlace(switcherToggle(page));

      await pressKey(page, key);

      await expectListOpen(page);
      await expect(switcherChoice(page, "diorama")).toBeFocused();
    });
  }
});

test.describe("holding a key on the toggle", () => {
  test("holding Enter opens the list and picks nothing", async ({ page }) => {
    const REPEATS = 3;
    await openOnTheme(page, "diorama");
    await focusInPlace(switcherToggle(page));

    await page.keyboard.down("Enter");
    await expectListOpen(page);
    // Focus is on a link by now, and each of these is a repeat of the same press.
    for (let repeat = 0; repeat < REPEATS; repeat += 1) {
      await page.keyboard.down("Enter");
    }
    await page.keyboard.up("Enter");
    await frames(page);

    await expectShowing(page, "diorama");
    expect(await readSavedTheme(page)).toBeNull();
  });
});

test.describe("moving through the list", () => {
  test("the arrows move one link at a time and wrap at both ends", async ({
    page,
  }) => {
    await openOnTheme(page);
    await openListByKeyboard(page);
    await expect(switcherChoice(page, "interchange")).toBeFocused();

    await pressKey(page, "ArrowDown");
    await expect(switcherChoice(page, "diorama")).toBeFocused();
    await pressKey(page, "ArrowDown");
    await expect(switcherChoice(page, "pixel-depot")).toBeFocused();
    await pressKey(page, "ArrowDown");
    await expect(switcherChoice(page, "interchange")).toBeFocused();

    await pressKey(page, "ArrowUp");
    await expect(switcherChoice(page, "pixel-depot")).toBeFocused();
    await pressKey(page, "ArrowUp");
    await expect(switcherChoice(page, "diorama")).toBeFocused();
  });

  test("Home and End go to the first and last links", async ({ page }) => {
    await openOnTheme(page, "diorama");
    await openListByKeyboard(page);

    await pressKey(page, "End");
    await expect(switcherChoice(page, "pixel-depot")).toBeFocused();
    await pressKey(page, "Home");
    await expect(switcherChoice(page, "interchange")).toBeFocused();
  });
});

test.describe("picking", () => {
  for (const key of ["Enter", " "]) {
    test(`"${key}" picks the focused theme and leaves the new list closed`, async ({
      page,
    }) => {
      await openOnTheme(page);
      await openListByKeyboard(page);
      await pressKey(page, "ArrowDown");

      await pressKey(page, key);

      await expectShowing(page, "diorama");
      expect(await readSavedTheme(page)).toBe("diorama");
      expect(await currentHash(page)).toBe("#diorama");
      await expect(switcherToggle(page)).toBeFocused();
      // Focus moves to a button mid-press, and its release must not reopen the list.
      await frames(page);
      await expectListClosed(page);
    });
  }

  test("Space on a link does not scroll the page", async ({ page }) => {
    await serveWithCss(page, tallSectionsCss());
    await openOnTheme(page);
    await openListByKeyboard(page);

    // The current theme, because a switch would scroll to the kept section anyway.
    await pressKey(page, " ");
    await expectListClosed(page);
    await frames(page, FRAMES_FOR_A_SCROLL_TO_SHOW);

    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe("leaving without picking", () => {
  test("Escape closes the list and returns to the toggle", async ({ page }) => {
    await openOnTheme(page);
    await openListByKeyboard(page);
    await pressKey(page, "ArrowDown");

    await pressKey(page, "Escape");

    await expectListClosed(page);
    await expect(switcherToggle(page)).toBeFocused();
    await expectShowing(page, "interchange");
    expect(await readSavedTheme(page)).toBeNull();
    expect(await currentHash(page)).toBe("");
  });

  test("Escape returns to the toggle when the mouse opened the list", async ({
    page,
  }) => {
    await openOnTheme(page);
    await openListByMouse(page);

    await pressKey(page, "Escape");

    await expectListClosed(page);
    await expect(switcherToggle(page)).toBeFocused();
  });

  for (const key of ["Tab", "Shift+Tab"]) {
    test(`${key} closes the list and picks nothing`, async ({
      page,
      browserName,
    }) => {
      await openOnTheme(page);
      await openListByKeyboard(page);

      await pressKey(page, key);

      await expectListClosed(page);
      await expectShowing(page, "interchange");
      expect(await readSavedTheme(page)).toBeNull();

      // Playwright's WebKit sends Tab to the body, whatever comes next on the page.
      if (browserName === "chromium") {
        await expect(page.locator("body")).not.toBeFocused();
        await expect(
          showingSwitcher(page).locator("*:focus"),
          "focus should have left the switcher",
        ).toHaveCount(0);
      }
    });
  }
});
