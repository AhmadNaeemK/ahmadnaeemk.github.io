import { expect } from "@playwright/test";
import {
  currentHash,
  expectShowing,
  goToHash,
  switcherToggle,
  test,
} from "../selection/support";
import {
  expectListClosed,
  openListByMouse,
  openListCount,
  openOnTheme,
} from "./support";

test.describe.configure({ mode: "parallel" });

test.describe("a history step with the list open", () => {
  test("closes it, in the theme left and the theme reached", async ({
    page,
  }) => {
    await openOnTheme(page);
    await goToHash(page, "#diorama");
    await expectShowing(page, "diorama");
    await openListByMouse(page);

    await page.goBack();

    await expectShowing(page, "interchange");
    await expectListClosed(page);
    await expect(switcherToggle(page)).toBeFocused();
    expect(await openListCount(page)).toBe(0);

    await page.goForward();

    await expectShowing(page, "diorama");
    await expectListClosed(page);
  });

  test("closes it when the step stays on the same theme", async ({ page }) => {
    await openOnTheme(page);
    await goToHash(page, "#a-about");
    await goToHash(page, "#a-work");
    await openListByMouse(page);

    await page.goBack();

    await expect.poll(() => currentHash(page)).toBe("#a-about");
    await expectListClosed(page);
  });
});
