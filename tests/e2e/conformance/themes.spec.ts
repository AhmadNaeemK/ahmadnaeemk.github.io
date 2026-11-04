/**
 * The same checks for every theme, in the shape a visitor meets them. A theme task
 * runs this but cannot edit it (contract, section 12). It reads only the contract's
 * attributes and hooks, so real themes, which share no markup with the stubs, get a
 * fair test.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import {
  SECTION_KEYS,
  sectionId,
  STORAGE_KEYS,
  THEME_ROOT_ATTRIBUTE,
  themeHash,
  type ThemeName,
} from "../../../src/scene/contract";
import {
  expectShowing,
  sceneSettled,
  seedStorage,
  test,
  THEMES,
  themeRoot,
  hasSidewaysScroll,
  shownRightNows,
} from "../selection/support";

const WIDTHS = [320, 390, 768, 1280, 1920];
const SCHEMES = ["light", "dark"] as const;
const VIEWPORT_HEIGHT = 800;

const REPORTED_IMPACTS = new Set(["serious", "critical"]);

async function seriousAxeViolations(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter(({ impact }) => impact && REPORTED_IMPACTS.has(impact))
    .map(
      ({ id, nodes }) =>
        `${id}: ${nodes.map(({ target }) => target.join(" ")).join(", ")}`,
    );
}

/** Reaches the section the way a section link does, and reports if it is on screen. */
function reachSection(page: Page, id: string): Promise<boolean> {
  return page.evaluate((sectionElementId) => {
    location.hash = sectionElementId;
    const section = document.getElementById(sectionElementId);
    if (!section) return false;
    const { top, bottom, width, height } = section.getBoundingClientRect();
    return (
      width > 0 &&
      height > 0 &&
      bottom > 0 &&
      top < document.documentElement.clientHeight
    );
  }, id);
}

test.describe.configure({ mode: "parallel" });

test("the page renders exactly the themes in the registry", async ({
  page,
}) => {
  await page.goto("/");
  const roots = await page
    .locator(`[${THEME_ROOT_ATTRIBUTE}]`)
    .evaluateAll(
      (elements, attribute) =>
        elements.map((element) => element.getAttribute(attribute)),
      THEME_ROOT_ATTRIBUTE,
    );
  expect([...roots].sort()).toEqual([...THEMES].sort());
});

async function openTheme(
  page: Page,
  theme: ThemeName,
  scheme: (typeof SCHEMES)[number],
  width: number,
): Promise<void> {
  // Reduced motion makes each section's scroll land at once. The scheme is the
  // system's, the path every first visit takes.
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.goto(`/${themeHash(theme)}`);
  await expectShowing(page, theme);
  await sceneSettled(page, theme);
}

for (const theme of THEMES) {
  test.describe(theme, () => {
    test.describe.configure({ timeout: 60_000 });

    for (const scheme of SCHEMES) {
      for (const width of WIDTHS) {
        test(`conforms in ${scheme} at ${width} px`, async ({
          page,
          pageProblems,
        }) => {
          await openTheme(page, theme, scheme, width);

          await test.step("exactly one Right now shows", async () => {
            await expect
              .poll(async () => (await shownRightNows(page, theme)).length)
              .toBe(1);
          });

          await test.step("no sideways scrolling", async () => {
            await expect.poll(() => hasSidewaysScroll(page)).toBe(false);
          });

          await test.step("the html color-scheme matches", async () => {
            expect(
              await page.evaluate(
                () => getComputedStyle(document.documentElement).colorScheme,
              ),
            ).toBe(scheme);
            expect(
              await themeRoot(page, theme).evaluate(
                (root) => getComputedStyle(root).colorScheme,
              ),
            ).toBe(scheme);
          });

          await test.step("no serious axe violations", async () => {
            expect(await seriousAxeViolations(page)).toEqual([]);
          });

          await test.step("all six sections are reachable", async () => {
            for (const key of SECTION_KEYS) {
              const id = sectionId(theme, key);
              await expect
                .poll(() => reachSection(page, id), { message: id })
                .toBe(true);
            }
            await expect(
              page.locator(`main[id="${sectionId(theme, "top")}"]:visible`),
            ).toHaveCount(1);
          });

          expect(pageProblems).toEqual([]);
        });
      }
    }

    for (const { picked, system } of [
      { picked: "dark", system: "light" },
      { picked: "light", system: "dark" },
    ] as const) {
      test(`a saved ${picked} scheme wins over a ${system} system`, async ({
        page,
      }) => {
        await seedStorage(page, { [STORAGE_KEYS.colorScheme]: picked });
        await openTheme(page, theme, system, 1280);
        expect(
          await page.evaluate(
            () => getComputedStyle(document.documentElement).colorScheme,
          ),
        ).toBe(picked);
        expect(
          await themeRoot(page, theme).evaluate(
            (root) => getComputedStyle(root).colorScheme,
          ),
        ).toBe(picked);
      });
    }

    test("still shows exactly one Right now after resizing across widths", async ({
      page,
    }) => {
      await openTheme(page, theme, "light", 1280);
      for (const width of [320, 1280, 390, 1920, 320]) {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await expect
          .poll(async () => (await shownRightNows(page, theme)).length, {
            message: `at ${width} px`,
          })
          .toBe(1);
      }
    });
  });
}

test.describe("theme CSS stays under its root (C9)", () => {
  const PROPERTIES = [
    "fontFamily",
    "fontSize",
    "lineHeight",
    "color",
    "backgroundColor",
    "boxSizing",
    "marginTop",
    "marginLeft",
    "paddingLeft",
    "textTransform",
  ] as const;
  const TAGS = [
    "div",
    "h1",
    "h2",
    "p",
    "a",
    "button",
    "ul",
    "li",
    "section",
    "header",
    "nav",
    "main",
    "footer",
    "img",
    "canvas",
  ];
  const THEME_TOKENS = [
    "--bg",
    "--ink",
    "--muted",
    "--dd-bg",
    "--dd-fg",
    "--dd-muted",
    "--dd-line",
  ];
  // The prototypes write their dark rules both ways (contract, section 9), so a leak
  // can hide behind the attribute alone or behind the system preference alone.
  const SCHEME_ROUTES: {
    name: string;
    system: "light" | "dark";
    picked?: "light" | "dark";
  }[] = [
    { name: "light", system: "light" },
    { name: "dark by the system", system: "dark" },
    { name: "dark by a pick", system: "light", picked: "dark" },
    {
      name: "light by a pick on a dark system",
      system: "dark",
      picked: "light",
    },
  ];

  for (const theme of THEMES) {
    for (const { name, system, picked } of SCHEME_ROUTES) {
      test.describe(`showing ${theme}, ${name}`, () => {
        test.beforeEach(async ({ page }) => {
          await page.emulateMedia({ colorScheme: system });
          if (picked) {
            await seedStorage(page, { [STORAGE_KEYS.colorScheme]: picked });
          }
          await page.goto(`/${themeHash(theme)}`);
          await expectShowing(page, theme);
        });

        test("an element outside every root looks as it would on a blank page", async ({
          page,
        }) => {
          const differences = await page.evaluate(
            async ({ tags, properties }) => {
              // The same scheme, so only what the page's rules did can differ.
              const { colorScheme } = getComputedStyle(
                document.documentElement,
              );
              const blank = document.createElement("iframe");
              blank.srcdoc = `<!doctype html><html style="color-scheme: ${colorScheme}"><body></body></html>`;
              const loaded = new Promise((resolve) =>
                blank.addEventListener("load", resolve, { once: true }),
              );
              document.body.append(blank);
              await loaded;
              const blankDocument = blank.contentDocument;
              const blankWindow = blank.contentWindow;
              if (!blankDocument || !blankWindow) return ["no blank page"];

              const found: string[] = [];
              for (const tag of tags) {
                const onPage = document.createElement(tag);
                const onBlank = blankDocument.createElement(tag);
                if (tag === "a") {
                  onPage.setAttribute("href", "#");
                  onBlank.setAttribute("href", "#");
                }
                document.body.append(onPage);
                blankDocument.body.append(onBlank);
                const pageStyle = getComputedStyle(onPage);
                const blankStyle = blankWindow.getComputedStyle(onBlank);
                for (const property of properties) {
                  if (pageStyle[property] !== blankStyle[property]) {
                    found.push(
                      `${tag} ${property}: ${pageStyle[property]} vs ${blankStyle[property]}`,
                    );
                  }
                }
                onPage.remove();
              }
              blank.remove();
              return found;
            },
            { tags: TAGS, properties: PROPERTIES },
          );
          expect(differences).toEqual([]);
        });

        test("no theme token is set on html", async ({ page }) => {
          const tokens = await page.evaluate((names) => {
            const style = getComputedStyle(document.documentElement);
            return names.filter((name) => style.getPropertyValue(name));
          }, THEME_TOKENS);
          expect(tokens).toEqual([]);
        });
      });
    }
  }
});
