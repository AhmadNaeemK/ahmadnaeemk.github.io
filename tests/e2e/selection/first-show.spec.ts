import { expect, type Page } from "@playwright/test";
import {
  COLOR_SCHEME_ATTRIBUTE,
  sectionId,
  STORAGE_KEYS,
  THEME_ATTRIBUTE,
  THEME_ROOT_ATTRIBUTE,
  themeHash,
  type ThemeName,
} from "../../../src/scene/contract";
import {
  expectShowing,
  fontStylesheetUrl,
  sceneSettled,
  seedStorage,
  test,
  THEMES,
  goToHash,
} from "./support";

declare global {
  interface Window {
    attributesAtFirstRoot?: { theme: string | null; scheme: string | null };
  }
}

/** Records <html>'s attributes the moment the parser has produced a theme root. */
async function watchFirstRoot(page: Page): Promise<void> {
  await page.addInitScript(
    ({ root, theme, scheme }) => {
      const observer = new MutationObserver(() => {
        if (!document.querySelector(`[${root}]`)) return;
        observer.disconnect();
        const html = document.documentElement;
        window.attributesAtFirstRoot = {
          theme: html.getAttribute(theme),
          scheme: html.getAttribute(scheme),
        };
      });
      observer.observe(document, { childList: true, subtree: true });
    },
    {
      root: THEME_ROOT_ATTRIBUTE,
      theme: THEME_ATTRIBUTE,
      scheme: COLOR_SCHEME_ATTRIBUTE,
    },
  );
}

function attributesAtFirstRoot(page: Page) {
  return page.evaluate(() => window.attributesAtFirstRoot);
}

const HASH_CASES: { hash: string; named: ThemeName | null }[] = [
  { hash: "", named: null },
  { hash: "#nothing", named: null },
  ...THEMES.flatMap((theme) => [
    { hash: themeHash(theme), named: theme },
    { hash: `#${sectionId(theme, "about")}`, named: theme },
  ]),
];

const SAVED_CASES: (ThemeName | null)[] = [null, ...THEMES];

test.describe.configure({ mode: "parallel" });

test.describe("no flash of the wrong theme", () => {
  for (const { hash, named } of HASH_CASES) {
    for (const saved of SAVED_CASES) {
      // The hash beats the saved theme, and the saved theme beats the default.
      const expected = named ?? saved ?? "interchange";

      test(`hash "${hash}" with saved ${saved} shows ${expected} from the first parse`, async ({
        page,
      }) => {
        await watchFirstRoot(page);
        if (saved) await seedStorage(page, { [STORAGE_KEYS.theme]: saved });

        await page.goto(`/${hash}`);
        expect((await attributesAtFirstRoot(page))?.theme).toBe(expected);
        await expectShowing(page, expected);

        await page.reload();
        expect((await attributesAtFirstRoot(page))?.theme).toBe(expected);
        await expectShowing(page, expected);
      });
    }
  }

  for (const scheme of ["light", "dark"]) {
    test(`a saved ${scheme} scheme is set from the first parse`, async ({
      page,
    }) => {
      await watchFirstRoot(page);
      await seedStorage(page, { [STORAGE_KEYS.colorScheme]: scheme });
      await page.goto("/");
      expect((await attributesAtFirstRoot(page))?.scheme).toBe(scheme);
    });
  }

  test("with nothing saved the scheme attribute stays absent", async ({
    page,
  }) => {
    await watchFirstRoot(page);
    await page.goto("/");
    expect((await attributesAtFirstRoot(page))?.scheme).toBeNull();
  });
});

test.describe("corrupt or hostile values fall back to Interchange (E2)", () => {
  const HOSTILE_NAMES = [
    "constructor",
    "__proto__",
    "toString",
    "hasOwnProperty",
    "a-about",
    "#diorama",
    "removed-theme",
    "",
  ];

  for (const value of HOSTILE_NAMES) {
    test(`saved theme ${JSON.stringify(value)}`, async ({
      page,
      pageProblems,
    }) => {
      await seedStorage(page, { [STORAGE_KEYS.theme]: value });
      await page.goto("/");
      await expectShowing(page, "interchange");
      await sceneSettled(page, "interchange");
      expect(pageProblems).toEqual([]);
    });

    test(`attribute written as ${JSON.stringify(value)}`, async ({
      page,
      pageProblems,
      fontRequests,
    }) => {
      const requested: string[] = [];
      page.on("request", (request) => requested.push(request.url()));
      await page.goto("/#diorama");
      await expectShowing(page, "diorama");
      await page.evaluate(
        ([attribute, name]) =>
          document.documentElement.setAttribute(attribute, name),
        [THEME_ATTRIBUTE, value],
      );
      await expectShowing(page, "interchange");
      await sceneSettled(page, "interchange");
      await expect
        .poll(() => fontRequests)
        .toContain(fontStylesheetUrl("interchange"));
      expect(pageProblems).toEqual([]);
      // A lookup that found a function on the prototype would ask for "undefined".
      expect(requested.filter((url) => url.endsWith("/undefined"))).toEqual([]);
    });
  }

  const HOSTILE_HASHES = [
    "#constructor",
    "#__proto__",
    "#toString",
    "#hasOwnProperty",
    "#a-constructor",
    "#z-about",
    "#%3Cscript%3E",
  ];

  for (const hash of HOSTILE_HASHES) {
    test(`hash ${hash} on load`, async ({ page, pageProblems }) => {
      await page.goto(`/${hash}`);
      await expectShowing(page, "interchange");
      await sceneSettled(page, "interchange");
      expect(pageProblems).toEqual([]);
    });

    test(`hash ${hash} on hashchange`, async ({ page, pageProblems }) => {
      await page.goto("/#diorama");
      await expectShowing(page, "diorama");
      await goToHash(page, hash);
      await expectShowing(page, "interchange");
      await sceneSettled(page, "interchange");
      expect(pageProblems).toEqual([]);
    });
  }

  test("a hostile saved theme is ignored when the hash stops naming a theme", async ({
    page,
    pageProblems,
  }) => {
    await seedStorage(page, { [STORAGE_KEYS.theme]: "__proto__" });
    await page.goto("/#diorama");
    await goToHash(page, "");
    await expectShowing(page, "interchange");
    await sceneSettled(page, "interchange");
    // CSS alone would show Interchange for any name, so the attribute and hash say
    // whether the saved value was really refused.
    await expect(page.locator("html")).toHaveAttribute(
      THEME_ATTRIBUTE,
      "interchange",
    );
    await expect
      .poll(() => page.evaluate(() => location.hash))
      .toBe("#interchange");
    expect(pageProblems).toEqual([]);
  });

  test("a hostile saved scheme sets no scheme", async ({
    page,
    pageProblems,
  }) => {
    await seedStorage(page, { [STORAGE_KEYS.colorScheme]: "constructor" });
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveAttribute(
      COLOR_SCHEME_ATTRIBUTE,
      /.*/,
    );
    expect(pageProblems).toEqual([]);
  });
});
