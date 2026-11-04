import { expect, type Page } from "@playwright/test";
import {
  COLOR_SCHEME_ATTRIBUTE,
  sectionId,
  STORAGE_KEYS,
  THEME_ATTRIBUTE,
  THEME_ROOT_ATTRIBUTE,
  type ThemeName,
} from "../../../src/scene/contract";
import {
  expectShowing,
  frames,
  goToHash,
  pickTheme,
  seedStorage,
  test,
  THEMES,
  watchForEvent,
  sceneSettled,
  serveWithCss,
  tallSectionsCss,
} from "./support";

function htmlColorScheme(page: Page): Promise<string> {
  return page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme,
  );
}

/** The colours outside the theme root, and the colour the theme asks for. */
function canvasColors(page: Page, theme: ThemeName) {
  return page.evaluate(
    ({ theme, rootAttribute }) => {
      const root = document.querySelector(`[${rootAttribute}="${theme}"]`);
      const probe = document.createElement("div");
      probe.style.color = root
        ? getComputedStyle(root).getPropertyValue("--bg")
        : "";
      document.body.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return {
        expected,
        html: getComputedStyle(document.documentElement).backgroundColor,
        bodyBefore: getComputedStyle(document.body, "::before").backgroundColor,
      };
    },
    { theme, rootAttribute: THEME_ROOT_ATTRIBUTE },
  );
}

async function expectCanvasMatches(
  page: Page,
  theme: ThemeName,
): Promise<void> {
  await expect
    .poll(async () => {
      const { expected, html, bodyBefore } = await canvasColors(page, theme);
      return html === expected && bodyBefore === expected;
    })
    .toBe(true);
}

test.describe("two tabs (E8)", () => {
  test("each stays as it is, and the last pick applies on the next load", async ({
    page,
    context,
  }) => {
    const other = await context.newPage();
    await page.goto("/");
    await other.goto("/");

    await pickTheme(page, "diorama");
    await expectShowing(page, "diorama");

    // The other tab's pick has reached this tab once its storage event has fired.
    const sawOtherTabSave = await watchForEvent(page, "storage");
    await pickTheme(other, "pixel-depot");
    await expectShowing(other, "pixel-depot");
    await sawOtherTabSave();
    await frames(page);
    await expectShowing(page, "diorama");

    const nextVisit = await context.newPage();
    await nextVisit.goto("/");
    await expectShowing(nextVisit, "pixel-depot");
  });

  test("a step back to a no-hash entry shows the other tab's later pick", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await goToHash(page, "#diorama");
    await expectShowing(page, "diorama");
    await pickTheme(page, "pixel-depot");
    await expectShowing(page, "pixel-depot");

    const other = await context.newPage();
    await other.goto("/");
    await expectShowing(other, "pixel-depot");
    await pickTheme(other, "diorama");
    await expectShowing(other, "diorama");

    await page.goBack();
    await expectShowing(page, "diorama");
  });

  test("a colour pick in one tab does not repaint the other", async ({
    page,
    context,
  }) => {
    const other = await context.newPage();
    await page.goto("/");
    await other.goto("/");

    const sawOtherTabSave = await watchForEvent(page, "storage");
    await other.locator("[data-theme-toggle]:visible").click();
    await sawOtherTabSave();
    await frames(page);
    await expect(page.locator("html")).not.toHaveAttribute(
      COLOR_SCHEME_ATTRIBUTE,
      /.*/,
    );
  });
});

test.describe("the system scheme and the pick (E9)", () => {
  test("follows the system until picked, the pick wins, and a reload keeps it", async ({
    page,
  }) => {
    const html = page.locator("html");
    const toggle = page.locator("[data-theme-toggle]:visible");
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    expect(await htmlColorScheme(page)).toBe("light");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => htmlColorScheme(page)).toBe("dark");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(toggle).toHaveAttribute("aria-label", "Switch to light theme");
    await expect(html).not.toHaveAttribute(COLOR_SCHEME_ATTRIBUTE, /.*/);
    await expectCanvasMatches(page, "interchange");

    // Dark system, so the first press picks light.
    await toggle.click();
    await expect(html).toHaveAttribute(COLOR_SCHEME_ATTRIBUTE, "light");
    await expect.poll(() => htmlColorScheme(page)).toBe("light");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toHaveAttribute("aria-label", "Switch to dark theme");
    await expectCanvasMatches(page, "interchange");

    await page.emulateMedia({ colorScheme: "light" });
    await page.emulateMedia({ colorScheme: "dark" });
    await frames(page);
    expect(await htmlColorScheme(page)).toBe("light");
    await expect(html).toHaveAttribute(COLOR_SCHEME_ATTRIBUTE, "light");

    await page.reload();
    await expect(html).toHaveAttribute(COLOR_SCHEME_ATTRIBUTE, "light");
    expect(await htmlColorScheme(page)).toBe("light");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  test("a dark pick wins over a light system", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await page.locator("[data-theme-toggle]:visible").click();
    await expect(page.locator("html")).toHaveAttribute(
      COLOR_SCHEME_ATTRIBUTE,
      "dark",
    );
    await expect.poll(() => htmlColorScheme(page)).toBe("dark");
    await expectCanvasMatches(page, "interchange");
  });

  test("a saved scheme of the other kind wins from the first load", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await seedStorage(page, { [STORAGE_KEYS.colorScheme]: "light" });
    await page.goto("/");
    expect(await htmlColorScheme(page)).toBe("light");
    await expect(page.locator("[data-theme-toggle]:visible")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("the pick reaches the toggle in the next theme shown", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await page.locator("[data-theme-toggle]:visible").click();
    await pickTheme(page, "diorama");
    await expectShowing(page, "diorama");
    await expect(page.locator("[data-theme-toggle]:visible")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("[data-theme-toggle]:visible")).toHaveAttribute(
      "aria-label",
      "Switch to light theme",
    );
  });
});

test.describe("page canvas", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`html and body::before match the showing theme in ${scheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      await expectCanvasMatches(page, "interchange");
      for (const theme of THEMES) {
        await page.evaluate(
          ([attribute, name]) =>
            document.documentElement.setAttribute(attribute, name),
          [THEME_ATTRIBUTE, theme],
        );
        await expectShowing(page, theme);
        await expectCanvasMatches(page, theme);
      }
    });
  }

  test("themes ask for different canvases, so the checks above can fail", async ({
    page,
  }) => {
    await page.goto("/");
    const colors = await Promise.all(
      THEMES.map(async (theme) => (await canvasColors(page, theme)).expected),
    );
    expect(new Set(colors).size).toBeGreaterThan(1);
  });

  test("it follows a pick made with the switcher", async ({ page }) => {
    await page.goto("/");
    await pickTheme(page, "pixel-depot");
    await expectShowing(page, "pixel-depot");
    await expectCanvasMatches(page, "pixel-depot");
  });

  test("a bfcache restore catches up with a system change it slept through", async ({
    page,
  }) => {
    // Playwright's browsers run with the bfcache off, so this stands in for one: a
    // frozen page gets no change event, and then sees a persisted pageshow.
    await page.addInitScript(() => {
      const addListener = MediaQueryList.prototype.addEventListener;
      MediaQueryList.prototype.addEventListener = function (
        this: MediaQueryList,
        ...args: Parameters<MediaQueryList["addEventListener"]>
      ) {
        if (args[0] !== "change") addListener.apply(this, args);
      };
    });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await expectCanvasMatches(page, "interchange");
    const toggle = page.locator("[data-theme-toggle]:visible");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await page.emulateMedia({ colorScheme: "dark" });
    await frames(page);
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      ),
    );
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expectCanvasMatches(page, "interchange");
  });
});

test.describe("under reduced motion", () => {
  test("a section link is on target by the next frame", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await serveWithCss(page, tallSectionsCss());
    await page.goto("/");
    await sceneSettled(page, "interchange");
    const id = sectionId("interchange", "projects");
    const link = await page
      .locator(`a[href="#${id}"]:visible`)
      .first()
      .elementHandle();

    const offset = await page.evaluate(
      async ({ link, id }) => {
        (link as HTMLElement | null)?.click();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const section = document.getElementById(id);
        if (!section) return Number.NaN;
        return (
          section.getBoundingClientRect().top -
          parseFloat(getComputedStyle(section).scrollMarginTop)
        );
      },
      { link, id },
    );

    expect(Math.abs(offset)).toBeLessThanOrEqual(1.5);
  });
});
