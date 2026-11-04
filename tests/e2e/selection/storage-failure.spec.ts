import { expect, type Page } from "@playwright/test";
import { COLOR_SCHEME_ATTRIBUTE } from "../../../src/scene/contract";
import {
  expectShowing,
  pickTheme,
  sceneSettled,
  test,
  goToHash,
} from "./support";

const STORAGE_FAILURES: {
  name: string;
  install: (page: Page) => Promise<unknown>;
}[] = [
  {
    name: "the localStorage getter throws",
    install: (page) =>
      page.addInitScript(() => {
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new DOMException("Denied", "SecurityError");
          },
        });
      }),
  },
  {
    name: "the storage methods throw",
    install: (page) =>
      page.addInitScript(() => {
        for (const method of ["getItem", "setItem", "removeItem"] as const) {
          Storage.prototype[method] = () => {
            throw new DOMException("Denied", "QuotaExceededError");
          };
        }
      }),
  },
];

for (const { name, install } of STORAGE_FAILURES) {
  test.describe(`when ${name}`, () => {
    test("choosing, toggling and reloading all work for the session", async ({
      page,
      pageProblems,
    }) => {
      await install(page);

      await page.goto("/");
      await expectShowing(page, "interchange");
      await sceneSettled(page, "interchange");

      await pickTheme(page, "diorama");
      await expectShowing(page, "diorama");
      await sceneSettled(page, "diorama");

      const html = page.locator("html");
      const toggle = page.locator("[data-theme-toggle]:visible");
      await toggle.click();
      await expect(html).toHaveAttribute(COLOR_SCHEME_ATTRIBUTE, "dark");
      await toggle.click();
      await expect(html).toHaveAttribute(COLOR_SCHEME_ATTRIBUTE, "light");

      // With no hash to name it, only the tab's own memory of the pick is left.
      await goToHash(page, "");
      await expect.poll(() => page.evaluate(() => location.hash)).toBe("");
      await expectShowing(page, "diorama");

      // Nothing could be saved, so a reload starts over.
      await page.reload();
      await expectShowing(page, "interchange");
      await sceneSettled(page, "interchange");
      await expect(html).not.toHaveAttribute(COLOR_SCHEME_ATTRIBUTE, /.*/);

      await goToHash(page, "#pixel-depot");
      await expectShowing(page, "pixel-depot");
      await sceneSettled(page, "pixel-depot");
      await page.reload();
      await expectShowing(page, "pixel-depot");
      await sceneSettled(page, "pixel-depot");

      expect(pageProblems).toEqual([]);
    });

    test("a hash that stops naming a theme falls back with no pick made", async ({
      page,
      pageProblems,
    }) => {
      await install(page);
      await page.goto("/#diorama");
      await expectShowing(page, "diorama");
      await sceneSettled(page, "diorama");

      await goToHash(page, "");
      await expectShowing(page, "interchange");
      await sceneSettled(page, "interchange");
      expect(pageProblems).toEqual([]);
    });
  });
}
