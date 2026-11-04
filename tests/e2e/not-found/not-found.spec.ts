import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import {
  COLOR_SCHEME_ATTRIBUTE,
  DEFAULT_THEME,
  STORAGE_KEYS,
  THEME_ATTRIBUTE,
  THEME_ROOT_ATTRIBUTE,
  type ColorScheme,
} from "../../../src/scene/contract";
import {
  DESKTOP,
  expectShowing,
  frames,
  readSavedTheme,
  sceneSettled,
  seedStorage,
  test,
  THEMES,
  themeRoot,
} from "../selection/support";

const MISSING_PATH = "/nope";
const NOT_FOUND_PATHS = [MISSING_PATH, "/blog", "/blog/", "/a/deep/path/gone"];
const SCHEMES: ColorScheme[] = ["light", "dark"];
const AXE_WIDTHS = [320, DESKTOP.width];
const REPORTED_AXE_IMPACTS = new Set(["serious", "critical"]);

/** What the browser logs for the page's own 404, which is the point of the page. */
const OWN_404_LOG =
  /^console: Failed to load resource: the server responded with a status of 404/;

function otherScheme(scheme: ColorScheme): ColorScheme {
  return scheme === "light" ? "dark" : "light";
}

function heading(page: Page) {
  return page.getByRole("heading", { level: 1, name: "Page not found" });
}

function homeLink(page: Page) {
  return page.getByRole("link", { name: "Back to the home page" });
}

/** The theme's tokens as resolved on the root, and what the page paints outside it. */
function readColours(page: Page) {
  return page.evaluate((rootAttribute) => {
    const root = document.querySelector(`[${rootAttribute}]`);
    if (!root) throw new Error("The page has no theme root");
    const rootStyle = getComputedStyle(root);
    return {
      bg: rootStyle.getPropertyValue("--bg").trim(),
      colorScheme: rootStyle.colorScheme,
      pageCanvas:
        document.documentElement.style.getPropertyValue("--rail-page-canvas"),
    };
  }, THEME_ROOT_ATTRIBUTE);
}

async function expectCanvasMatchesBg(page: Page): Promise<void> {
  const { bg, pageCanvas } = await readColours(page);
  expect(bg).not.toBe("");
  expect(pageCanvas).toBe(bg);
}

test.describe("an address with no page (E26)", () => {
  for (const path of NOT_FOUND_PATHS) {
    test(`${path} answers 404 with the whole page, assets included`, async ({
      page,
    }) => {
      const failedAssets: string[] = [];
      page.on("response", (response) => {
        if (
          response.status() >= 400 &&
          response.request().resourceType() !== "document"
        ) {
          failedAssets.push(response.url());
        }
      });

      const response = await page.goto(path);

      expect(response?.status()).toBe(404);
      await expect(page).toHaveTitle(/^Page not found/);
      await expect(heading(page)).toBeVisible();
      await expect(homeLink(page)).toBeVisible();
      await expectCanvasMatchesBg(page);
      expect(failedAssets).toEqual([]);
    });
  }
});

test.describe("the visitor's saved theme and colour scheme", () => {
  for (const theme of THEMES) {
    for (const scheme of SCHEMES) {
      const cases: {
        source: string;
        seed: Record<string, string>;
        system: ColorScheme;
      }[] = [
        {
          source: "a saved scheme, against the system",
          seed: { [STORAGE_KEYS.colorScheme]: scheme },
          system: otherScheme(scheme),
        },
        { source: "the system", seed: {}, system: scheme },
      ];

      for (const { source, seed, system } of cases) {
        test(`${theme} shows in ${scheme} by ${source}`, async ({ page }) => {
          await seedStorage(page, { [STORAGE_KEYS.theme]: theme, ...seed });
          await page.emulateMedia({ colorScheme: system });

          await page.goto(MISSING_PATH);

          await expect(page.locator("html")).toHaveAttribute(
            THEME_ATTRIBUTE,
            theme,
          );
          await expectShowing(page, theme);
          await expect(heading(page)).toBeVisible();
          const { colorScheme } = await readColours(page);
          expect(colorScheme).toBe(scheme);
          await expectCanvasMatchesBg(page);
        });
      }
    }
  }
});

test.describe("a saved value the page cannot use", () => {
  const unusableThemes = [
    "",
    "constructor",
    "__proto__",
    "INTERCHANGE",
    "diorama ",
    "<img src=x onerror=alert(1)>",
    '"]{}',
  ];
  const unusableSchemes = [
    "",
    "constructor",
    "__proto__",
    "DARK",
    "dark ",
    "<script>",
  ];

  for (const savedTheme of unusableThemes) {
    test(`theme ${JSON.stringify(savedTheme)} falls back to the default`, async ({
      page,
      pageProblems,
    }) => {
      await seedStorage(page, { [STORAGE_KEYS.theme]: savedTheme });

      await page.goto(MISSING_PATH);

      await expectShowing(page, DEFAULT_THEME);
      await expect(heading(page)).toBeVisible();
      expect(pageProblems.filter((p) => !OWN_404_LOG.test(p))).toEqual([]);
    });
  }

  for (const savedScheme of unusableSchemes) {
    test(`scheme ${JSON.stringify(savedScheme)} falls back to the system`, async ({
      page,
      pageProblems,
    }) => {
      await seedStorage(page, { [STORAGE_KEYS.colorScheme]: savedScheme });
      await page.emulateMedia({ colorScheme: "dark" });

      await page.goto(MISSING_PATH);

      await expect(page.locator("html")).not.toHaveAttribute(
        COLOR_SCHEME_ATTRIBUTE,
        /.*/,
      );
      await expect(heading(page)).toBeVisible();
      const { colorScheme } = await readColours(page);
      expect(colorScheme).toBe("dark");
      expect(pageProblems.filter((p) => !OWN_404_LOG.test(p))).toEqual([]);
    });
  }
});

test.describe("storage that throws", () => {
  const failures: {
    name: string;
    install: (page: Page) => Promise<unknown>;
  }[] = [
    {
      name: "the localStorage getter",
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
      name: "the storage methods",
      install: (page) =>
        page.addInitScript(() => {
          for (const method of ["getItem", "setItem"] as const) {
            Storage.prototype[method] = () => {
              throw new DOMException("Denied", "SecurityError");
            };
          }
        }),
    },
  ];

  for (const { name, install } of failures) {
    test(`from ${name}, the default theme shows with no errors`, async ({
      page,
      pageProblems,
    }) => {
      await install(page);

      await page.goto(MISSING_PATH);

      await expectShowing(page, DEFAULT_THEME);
      await expect(heading(page)).toBeVisible();
      await expectCanvasMatchesBg(page);
      expect(pageProblems.filter((p) => !OWN_404_LOG.test(p))).toEqual([]);
    });
  }
});

test.describe("with JavaScript off", () => {
  test.use({ javaScriptEnabled: false });

  for (const path of [MISSING_PATH, "/blog/"]) {
    test(`${path} still shows the heading and a working home link`, async ({
      page,
    }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(404);
      await expect(themeRoot(page, DEFAULT_THEME)).toBeVisible();
      await expect(heading(page)).toBeVisible();

      await homeLink(page).click();
      await expect(page).toHaveURL("/");
    });
  }
});

test.describe("the page's weight", () => {
  for (const theme of THEMES) {
    test(`in ${theme} it loads no JavaScript from /_astro/`, async ({
      page,
    }) => {
      const astroScripts: string[] = [];
      page.on("request", (request) => {
        const { pathname } = new URL(request.url());
        if (pathname.startsWith("/_astro/") && pathname.endsWith(".js")) {
          astroScripts.push(pathname);
        }
      });
      await seedStorage(page, { [STORAGE_KEYS.theme]: theme });

      await page.goto(MISSING_PATH, { waitUntil: "networkidle" });

      expect(astroScripts).toEqual([]);
      await expect(
        page.locator(
          'script[src], script[type="module"], link[rel="modulepreload"]',
        ),
      ).toHaveCount(0);
    });
  }
});

test.describe("the page canvas", () => {
  for (const theme of THEMES) {
    test(`follows ${theme}'s --bg when the system scheme changes`, async ({
      page,
    }) => {
      await seedStorage(page, { [STORAGE_KEYS.theme]: theme });
      await page.emulateMedia({ colorScheme: "light" });
      await page.goto(MISSING_PATH);
      await expectCanvasMatchesBg(page);
      const light = await readColours(page);

      await page.emulateMedia({ colorScheme: "dark" });
      await expect
        .poll(async () => (await readColours(page)).pageCanvas)
        .not.toBe(light.pageCanvas);
      await expectCanvasMatchesBg(page);

      await page.emulateMedia({ colorScheme: "light" });
      await expect
        .poll(async () => (await readColours(page)).pageCanvas)
        .toBe(light.pageCanvas);
    });
  }

  test("keeps the saved scheme's --bg when the system scheme changes", async ({
    page,
  }) => {
    await seedStorage(page, { [STORAGE_KEYS.colorScheme]: "dark" });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(MISSING_PATH);
    const before = await readColours(page);

    await page.emulateMedia({ colorScheme: "dark" });
    await frames(page);
    await page.emulateMedia({ colorScheme: "light" });
    await frames(page);

    expect(await readColours(page)).toEqual(before);
    expect(before.pageCanvas).toBe(before.bg);
  });
});

test.describe("the home link", () => {
  for (const theme of THEMES) {
    test(`reaches / and keeps ${theme} and the saved scheme`, async ({
      page,
    }) => {
      await seedStorage(page, {
        [STORAGE_KEYS.theme]: theme,
        [STORAGE_KEYS.colorScheme]: "dark",
      });
      await page.goto(MISSING_PATH);

      await homeLink(page).click();

      await expect(page).toHaveURL("/");
      await expectShowing(page, theme);
      await expect(page.locator("html")).toHaveAttribute(
        COLOR_SCHEME_ATTRIBUTE,
        "dark",
      );
      await sceneSettled(page, theme);
      expect(await readSavedTheme(page)).toBe(theme);
    });
  }
});

test.describe("accessibility", () => {
  for (const theme of THEMES) {
    for (const scheme of SCHEMES) {
      for (const width of AXE_WIDTHS) {
        test(`${theme} in ${scheme} at ${width} px has no serious axe violations or sideways scrolling`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height: DESKTOP.height });
          await seedStorage(page, {
            [STORAGE_KEYS.theme]: theme,
            [STORAGE_KEYS.colorScheme]: scheme,
          });
          await page.goto(MISSING_PATH);
          await expectShowing(page, theme);

          const { violations } = await new AxeBuilder({ page }).analyze();
          const reported = violations
            .filter(({ impact }) => impact && REPORTED_AXE_IMPACTS.has(impact))
            .map(
              ({ id, nodes }) =>
                `${id}: ${nodes.map(({ target }) => target.join(" ")).join(", ")}`,
            );
          expect(reported).toEqual([]);

          const scrollsSideways = await page.evaluate(() => {
            const { scrollWidth, clientWidth } = document.documentElement;
            return scrollWidth > clientWidth;
          });
          expect(scrollsSideways).toBe(false);
        });
      }
    }
  }
});
