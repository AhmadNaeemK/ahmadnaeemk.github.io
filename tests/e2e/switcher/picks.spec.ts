import { expect, type Page } from "@playwright/test";
import {
  currentHash,
  expectShowing,
  readSavedTheme,
  switcherChoice,
  switcherToggle,
  test,
} from "../selection/support";
import { expectListClosed, openListByMouse, openOnTheme } from "./support";

test.describe.configure({ mode: "parallel" });

test.describe("picking the theme already showing", () => {
  test("saves it, closes the list and returns to the toggle", async ({
    page,
  }) => {
    await openOnTheme(page, "diorama");
    expect(await readSavedTheme(page)).toBeNull();
    await openListByMouse(page);

    await switcherChoice(page, "diorama").click();

    expect(await readSavedTheme(page)).toBe("diorama");
    await expectListClosed(page);
    await expect(switcherToggle(page)).toBeFocused();
    await expectShowing(page, "diorama");
  });
});

test.describe("a modified click", () => {
  async function expectOpensTabWithoutPicking(
    page: Page,
    modifier: "ControlOrMeta" | "Shift",
  ) {
    await openOnTheme(page);
    await openListByMouse(page);

    const [newTab] = await Promise.all([
      page.context().waitForEvent("page"),
      switcherChoice(page, "diorama").click({ modifiers: [modifier] }),
    ]);
    await expect(newTab).toHaveURL(/#diorama$/);

    await expectShowing(page, "interchange");
    expect(await currentHash(page)).toBe("");
    expect(await readSavedTheme(page)).toBeNull();
  }

  test("with the command key opens a new tab and saves nothing", async ({
    page,
  }) => {
    await expectOpensTabWithoutPicking(page, "ControlOrMeta");
  });

  test("with Shift opens a new window and saves nothing", async ({ page }) => {
    await expectOpensTabWithoutPicking(page, "Shift");
  });
});
