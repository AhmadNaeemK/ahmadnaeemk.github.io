import { expect, type Page } from "@playwright/test";
import {
  sectionId,
  STORAGE_KEYS,
  THEME_ROOT_ATTRIBUTE,
  type ThemeName,
} from "../../../src/scene/contract";
import {
  currentHash,
  expectSceneNotStarted,
  expectSectionAtTop,
  expectShowing,
  frames,
  holdPageScripts,
  pickTheme,
  readSavedTheme,
  sceneSettled,
  seedStorage,
  serveWithCss,
  tallSectionsCss,
  test,
  goToHash,
  pastPinSettling,
  scrollAtRest,
} from "./support";

/**
 * Only the parser and the head script have run. Not "load" or "domcontentloaded":
 * neither arrives while the page's module scripts are held.
 */
async function openWithScriptsHeld(page: Page, path: string) {
  const release = await holdPageScripts(page);
  await page.goto(path, { waitUntil: "commit" });
  await expect(
    page.locator(`[${THEME_ROOT_ATTRIBUTE}]`).first(),
  ).toBeAttached();
  return release;
}

test.describe.configure({ mode: "parallel" });

test.describe("a theme link clicked before the scripts run", () => {
  test("switches once they run, a reload keeps it, and nothing is saved", async ({
    page,
  }) => {
    const release = await openWithScriptsHeld(page, "/");
    await expectShowing(page, "interchange");

    await pickTheme(page, "diorama");
    await expect.poll(() => currentHash(page)).toBe("#diorama");
    // Nothing is listening yet, which also shows the hold is working.
    await expectShowing(page, "interchange");
    await expectSceneNotStarted(page, "interchange");

    await release();
    await expectShowing(page, "diorama");
    await sceneSettled(page, "diorama");
    expect(await readSavedTheme(page)).toBeNull();

    await page.reload();
    await expectShowing(page, "diorama");
    expect(await readSavedTheme(page)).toBeNull();
  });

  test("leaves an earlier saved choice as it was", async ({ page }) => {
    await seedStorage(page, { [STORAGE_KEYS.theme]: "pixel-depot" });
    const release = await openWithScriptsHeld(page, "/");
    await expectShowing(page, "pixel-depot");

    await pickTheme(page, "diorama");
    await expect.poll(() => currentHash(page)).toBe("#diorama");

    await release();
    await expectShowing(page, "diorama");
    await sceneSettled(page, "diorama");
    expect(await readSavedTheme(page)).toBe("pixel-depot");
  });
});

test.describe("a section hash set before the scripts run", () => {
  test("selects its theme and lands on the section, and nothing is saved", async ({
    page,
  }) => {
    await serveWithCss(page, tallSectionsCss());
    const release = await openWithScriptsHeld(page, "/");
    const hash = `#${sectionId("diorama", "work")}`;

    await goToHash(page, hash);
    await expectShowing(page, "interchange");
    await expectSceneNotStarted(page, "interchange");

    await release();
    await expectShowing(page, "diorama");
    await sceneSettled(page, "diorama");
    await frames(page);
    await expectSectionAtTop(page, "diorama", "work");
    expect(await currentHash(page)).toBe(hash);
    expect(await readSavedTheme(page)).toBeNull();
  });
});

test.describe("a normal load", () => {
  const LOADS: {
    name: string;
    path: string;
    saved?: ThemeName;
    showing: ThemeName;
  }[] = [
    { name: "with no hash", path: "/", showing: "interchange" },
    { name: "on a theme hash", path: "/#diorama", showing: "diorama" },
    {
      name: "on a saved theme",
      path: "/",
      saved: "pixel-depot",
      showing: "pixel-depot",
    },
    {
      name: "on a hash and a saved theme",
      path: "/#diorama",
      saved: "pixel-depot",
      showing: "diorama",
    },
  ];

  const SCROLLED_TO = 700;

  for (const { name, path, saved, showing } of LOADS) {
    test(`leaves a visitor's scroll where it is ${name}`, async ({ page }) => {
      if (saved) await seedStorage(page, { [STORAGE_KEYS.theme]: saved });
      await serveWithCss(page, tallSectionsCss());

      const release = await openWithScriptsHeld(page, path);
      await expectShowing(page, showing);
      await page.evaluate(
        (top) => window.scrollTo({ top, behavior: "instant" }),
        SCROLLED_TO,
      );
      expect(await page.evaluate(() => window.scrollY)).toBe(SCROLLED_TO);

      await release();
      await sceneSettled(page, showing);
      await pastPinSettling(page);
      await scrollAtRest(page);
      expect(await page.evaluate(() => window.scrollY)).toBe(SCROLLED_TO);
    });
  }
});
