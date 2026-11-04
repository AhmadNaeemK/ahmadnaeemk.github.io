import { expect, type Page } from "@playwright/test";
import { THEME_ROOT_ATTRIBUTE } from "../../../src/scene/contract";
import {
  currentHash,
  expectSceneNotStarted,
  expectShowing,
  holdPageScripts,
  pickTheme,
  readSavedTheme,
  switcherChoice,
  switcherToggle,
  test,
} from "../selection/support";
import {
  expectListClosed,
  expectListOpen,
  expectSwitcherScripted,
  isListBesideToggle,
  openListCount,
} from "./support";

test.describe.configure({ mode: "parallel" });

/**
 * Only the parser and the head script have run. Showing first, or the stylesheet that
 * shows the theme may not have applied and the toggle is not yet there to click.
 */
async function openWithScriptsHeld(page: Page) {
  const release = await holdPageScripts(page);
  await page.goto("/", { waitUntil: "commit" });
  await expect(
    page.locator(`[${THEME_ROOT_ATTRIBUTE}]`).first(),
  ).toBeAttached();
  await expectShowing(page, "interchange");
  return release;
}

test.describe("before the scripts run", () => {
  test("the list opens natively, and a link followed switches once they run, saving nothing", async ({
    page,
  }) => {
    const release = await openWithScriptsHeld(page);

    await switcherToggle(page).click();
    await expect(switcherChoice(page, "diorama")).toBeVisible();
    await expectSceneNotStarted(page, "interchange");

    await switcherChoice(page, "diorama").click();
    await expect.poll(() => currentHash(page)).toBe("#diorama");
    await expectShowing(page, "interchange");

    await release();

    await expectShowing(page, "diorama");
    await expectSwitcherScripted(page);
    await expectListClosed(page);
    await expect.poll(() => openListCount(page)).toBe(0);
    expect(await readSavedTheme(page)).toBeNull();

    // The theme it was followed from must not show its list open on return.
    await pickTheme(page, "interchange");
    await expectShowing(page, "interchange");
    await expectListClosed(page);
  });

  test("a list still open when they run moves beside the toggle, and keeps working", async ({
    page,
  }) => {
    const release = await openWithScriptsHeld(page);

    await switcherToggle(page).click();
    await expect(switcherChoice(page, "diorama")).toBeVisible();
    // The browser's own place for it, or moving it would prove nothing.
    expect(await isListBesideToggle(page)).toBe(false);

    await release();

    await expectSwitcherScripted(page);
    await expectListOpen(page);
    await expect.poll(() => isListBesideToggle(page)).toBe(true);

    await switcherChoice(page, "diorama").click();
    await expectShowing(page, "diorama");
    expect(await readSavedTheme(page)).toBe("diorama");
    await expectListClosed(page);
  });
});
