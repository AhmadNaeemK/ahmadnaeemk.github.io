import { expect, type Page } from "@playwright/test";
import {
  STORAGE_KEYS,
  THEME_HOOKS,
  THEME_ROOT_ATTRIBUTE,
} from "../../../src/scene/contract";
import {
  currentHash,
  expectSectionAtTop,
  expectShowing,
  frames,
  pickTheme,
  pickThemeInPlace,
  readSavedTheme,
  sceneSettled,
  scrollToSection,
  seedStorage,
  serveWithCss,
  tallSectionsCss,
  test,
  themeRoot,
  goToHash,
  pastPinSettling,
} from "./support";

test.describe.configure({ mode: "parallel" });

test.describe("a link is not a pick", () => {
  test("opening a theme link shows it and leaves the saved choice", async ({
    page,
  }) => {
    await seedStorage(page, { [STORAGE_KEYS.theme]: "diorama" });
    await page.goto("/#pixel-depot");
    await expectShowing(page, "pixel-depot");
    expect(await readSavedTheme(page)).toBe("diorama");
  });

  test("opening a theme link saves nothing for a new visitor", async ({
    page,
  }) => {
    await page.goto("/#diorama");
    await expectShowing(page, "diorama");
    expect(await readSavedTheme(page)).toBeNull();
  });

  test("following a theme link in the page saves nothing", async ({ page }) => {
    await seedStorage(page, { [STORAGE_KEYS.theme]: "diorama" });
    await page.goto("/");
    await goToHash(page, "#pixel-depot");
    await expectShowing(page, "pixel-depot");
    expect(await readSavedTheme(page)).toBe("diorama");
  });

  test("a switcher click saves, and the next visit opens on it", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await pickTheme(page, "pixel-depot");
    await expectShowing(page, "pixel-depot");
    expect(await readSavedTheme(page)).toBe("pixel-depot");

    const nextVisit = await context.newPage();
    await nextVisit.goto("/");
    await expectShowing(nextVisit, "pixel-depot");
  });

  test("picking the theme a link is already showing saves it", async ({
    page,
  }) => {
    await seedStorage(page, { [STORAGE_KEYS.theme]: "diorama" });
    await page.goto("/#pixel-depot");
    await pickTheme(page, "pixel-depot");
    expect(await readSavedTheme(page)).toBe("pixel-depot");
    await expectShowing(page, "pixel-depot");
  });
});

test.describe("section links", () => {
  test.beforeEach(async ({ page }) => {
    await serveWithCss(page, tallSectionsCss());
  });

  test("a clicked section link replaces the theme hash, and a reload keeps the theme", async ({
    page,
  }) => {
    await page.goto("/#diorama");
    await themeRoot(page, "diorama")
      .locator('a[href="#b-about"]:visible')
      .first()
      .click();
    await expect.poll(() => currentHash(page)).toBe("#b-about");
    await expectSectionAtTop(page, "diorama", "about");

    await page.reload();
    await expectShowing(page, "diorama");
    expect(await readSavedTheme(page)).toBeNull();
  });

  test("a shared section link selects its theme over the saved one, then scrolls", async ({
    page,
  }) => {
    await seedStorage(page, { [STORAGE_KEYS.theme]: "pixel-depot" });
    await page.goto("/#b-work");
    await expectShowing(page, "diorama");
    await sceneSettled(page, "diorama");
    await expectSectionAtTop(page, "diorama", "work");
    expect(await readSavedTheme(page)).toBe("pixel-depot");
  });

  test("a section hash arriving by hashchange selects its theme and reaches the section", async ({
    page,
  }) => {
    await page.goto("/");
    await goToHash(page, "#c-projects");
    await expectShowing(page, "pixel-depot");
    await sceneSettled(page, "pixel-depot");
    await expectSectionAtTop(page, "pixel-depot", "projects");
    expect(await currentHash(page)).toBe("#c-projects");
  });

  test("a theme hash arriving by hashchange keeps the section in view", async ({
    page,
  }) => {
    await page.goto("/");
    await sceneSettled(page, "interchange");
    await scrollToSection(page, "interchange", "skills");
    await goToHash(page, "#diorama");
    await expectShowing(page, "diorama");
    await sceneSettled(page, "diorama");
    await expectSectionAtTop(page, "diorama", "skills");
    expect(await currentHash(page)).toBe("#diorama");
  });
});

test.describe("what a switch does to the hash", () => {
  const CASES = [
    { start: "", expected: "#diorama", why: "no hash gets the theme hash" },
    { start: "#nothing", expected: "#diorama", why: "any other hash too" },
    {
      start: "#pixel-depot",
      expected: "#diorama",
      why: "a theme hash is replaced",
    },
  ];

  for (const { start, expected, why } of CASES) {
    test(`${why}: "${start}" becomes "${expected}"`, async ({ page }) => {
      await page.goto(`/${start}`);
      await pickTheme(page, "diorama");
      await expect.poll(() => currentHash(page)).toBe(expected);
    });
  }

  test("a section hash moves to the new theme, so reload cannot bring the old one back", async ({
    page,
  }) => {
    await serveWithCss(page, tallSectionsCss());
    await page.goto("/#a-about");
    await expectShowing(page, "interchange");
    await pastPinSettling(page);

    await pickThemeInPlace(page, "diorama");
    await expect.poll(() => currentHash(page)).toBe("#b-about");

    await page.reload();
    await expectShowing(page, "diorama");
  });

  test("a section hash follows the section in view, not the one it named", async ({
    page,
  }) => {
    await serveWithCss(page, tallSectionsCss());
    await page.goto("/#a-about");
    await sceneSettled(page, "interchange");
    await pastPinSettling(page);
    await scrollToSection(page, "interchange", "work");

    await pickThemeInPlace(page, "pixel-depot");
    await expect.poll(() => currentHash(page)).toBe("#c-work");
  });

  test("a switch adds no history entry and fires no hashchange", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => {
      window.addEventListener("hashchange", () => {
        document.documentElement.dataset.testSawHashchange = "yes";
      });
    });
    const before = await page.evaluate(() => history.length);

    await pickTheme(page, "diorama");
    await expectShowing(page, "diorama");
    await pickTheme(page, "pixel-depot");
    await expectShowing(page, "pixel-depot");
    await frames(page);

    expect(await page.evaluate(() => history.length)).toBe(before);
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-test-saw-hashchange",
      "yes",
    );
  });
});

test.describe("back and forward", () => {
  test("the theme follows the hash both ways", async ({ page }) => {
    await page.goto("/#interchange");
    await goToHash(page, "#diorama");
    await expectShowing(page, "diorama");
    await goToHash(page, "#pixel-depot");
    await expectShowing(page, "pixel-depot");

    await page.goBack();
    await expectShowing(page, "diorama");
    await page.goBack();
    await expectShowing(page, "interchange");
    await page.goForward();
    await expectShowing(page, "diorama");
    await page.goForward();
    await expectShowing(page, "pixel-depot");
  });

  test("back to no hash shows the default when nothing is saved", async ({
    page,
  }) => {
    await page.goto("/");
    await goToHash(page, "#diorama");
    await expectShowing(page, "diorama");

    await page.goBack();
    await expectShowing(page, "interchange");
    // That step was a switch, and a switch names its theme in the hash.
    await expect.poll(() => currentHash(page)).toBe("#interchange");
  });

  test("back to no hash shows what a reload would: the saved theme", async ({
    page,
  }) => {
    await seedStorage(page, { [STORAGE_KEYS.theme]: "pixel-depot" });
    await page.goto("/");
    await expectShowing(page, "pixel-depot");
    await goToHash(page, "#diorama");
    await expectShowing(page, "diorama");

    await page.goBack();
    await expectShowing(page, "pixel-depot");

    await page.reload();
    await expectShowing(page, "pixel-depot");
  });

  test("back to a section hash lands on that section in its theme", async ({
    page,
  }) => {
    await serveWithCss(page, tallSectionsCss());
    await page.goto("/#a-projects");
    await pastPinSettling(page);
    await goToHash(page, "#b-work");
    await expectShowing(page, "diorama");
    await sceneSettled(page, "diorama");

    await page.goBack();
    await expectShowing(page, "interchange");
    await sceneSettled(page, "interchange");
    await expectSectionAtTop(page, "interchange", "projects");
  });

  /** Where focus sits: which theme, and whether in its switcher. */
  function focusPlace(page: Page) {
    return page.evaluate(
      ({ rootAttribute, switcher }) => {
        const active = document.activeElement;
        return {
          theme:
            active
              ?.closest(`[${rootAttribute}]`)
              ?.getAttribute(rootAttribute) ?? null,
          inSwitcher: Boolean(active?.closest(switcher)),
        };
      },
      {
        rootAttribute: THEME_ROOT_ATTRIBUTE,
        switcher: THEME_HOOKS.themeSwitcher,
      },
    );
  }

  test("focus inside the old theme moves to the new theme's switcher", async ({
    page,
  }) => {
    await page.goto("/");
    await themeRoot(page, "interchange").locator("[data-theme-toggle]").focus();
    await goToHash(page, "#diorama");
    await expectShowing(page, "diorama");
    await expect
      .poll(() => focusPlace(page))
      .toEqual({ theme: "diorama", inSwitcher: true });

    await page.goBack();
    await expectShowing(page, "interchange");
    await expect
      .poll(() => focusPlace(page))
      .toEqual({ theme: "interchange", inSwitcher: true });
  });

  test("a pick moves focus to the new theme's switcher", async ({ page }) => {
    await page.goto("/");
    await pickTheme(page, "pixel-depot");
    await expectShowing(page, "pixel-depot");
    await expect
      .poll(() => focusPlace(page))
      .toEqual({ theme: "pixel-depot", inSwitcher: true });
  });
});
