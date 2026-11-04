/**
 * The same checks for every theme, in the shape a visitor meets them. A theme task
 * runs this but cannot edit it (contract, section 12). It reads only the contract's
 * attributes and hooks, so real themes, which share no markup with the stubs, get a
 * fair test.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import {
  COMPACT_SCENE_WIDTH,
  SECTION_KEYS,
  SCENE_STATE_ATTRIBUTE,
  sectionId,
  STORAGE_KEYS,
  THEME_HOOKS,
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
  DESKTOP,
  expectSceneNotStarted,
  frames,
  holdSceneChunks,
  PHONE,
  pastPinSettling,
  pickThemeInPlace,
  scrollToSection,
  serveWithCss,
  tallSectionsCss,
} from "../selection/support";

const WIDTHS = [320, 390, 768, 1280, 1920];
const SCHEMES = ["light", "dark"] as const;
const VIEWPORT_HEIGHT = 800;

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

const SWITCHER_TOKENS = ["--dd-bg", "--dd-fg", "--dd-muted", "--dd-line"];

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

test.describe("the hero when the scene starts", () => {
  test.describe.configure({ timeout: 90_000 });

  const MOTIONS = ["no-preference", "reduce"] as const;
  type Motion = (typeof MOTIONS)[number];

  /** Rounding only. More and a plain first load visibly jumps. */
  const HOLDS_WITHIN = 1;
  /**
   * The canvas may differ from what its parent reserves by up to its pixel size
   * (contract, section 6), which is at most 3 px in Pixel Depot.
   */
  const CANVAS_SNAP = 3;

  /**
   * Tighter than the hero: a label holding its widest string changes nothing at
   * all, and one that does not can differ by under 1 px, as in a narrow font.
   */
  const TOGGLE_HOLDS_WITHIN = 0.5;

  /** Widths the toggle's labels are swept across. */
  const REWRAP_SWEEP = [320, 344, 360, 390, 430, 480, 580];
  /** Where each prototype's controls rewrapped, with its own fonts. */
  const PROTOTYPE_REWRAP_BANDS: Readonly<Record<ThemeName, readonly number[]>> =
    {
      interchange: [490, 491, 492, 493, 494],
      diorama: [346, 347, 348, 817, 818, 819, 820],
      "pixel-depot": [
        355, 356, 357, 358, 359, 360, 361, 362, 363, 364, 365, 587, 588, 589,
        590, 591, 592, 593, 594, 595, 596, 597,
      ],
    };

  /**
   * The narrowest viewport giving this theme a full-size scene, by measuring: a
   * theme's gutters are its own, and can change with width.
   */
  async function fullSceneViewport(
    page: Page,
    theme: ThemeName,
  ): Promise<number> {
    await page.goto(`/${themeHash(theme)}`);
    await expectShowing(page, theme);
    const canvas = themeRoot(page, theme).locator(THEME_HOOKS.canvas);
    let compact = 320;
    let full = 1920;
    while (full - compact > 1) {
      const width = Math.floor((compact + full) / 2);
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      const frame = await canvas.evaluate(
        (element) => element.parentElement?.clientWidth ?? 0,
      );
      if (frame >= COMPACT_SCENE_WIDTH) full = width;
      else compact = width;
    }
    await page.goto("about:blank");
    return full;
  }

  /** Fonts are blocked, so the late swap the contract allows cannot happen here. */
  async function openWithSceneHeld(
    page: Page,
    theme: ThemeName,
    { width, motion }: { width: number; motion: Motion },
  ): Promise<() => Promise<void>> {
    await page.emulateMedia({ reducedMotion: motion });
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    const release = await holdSceneChunks(page);
    // Not "load": WebKit holds that back for a pending dynamic import.
    await page.goto(`/${themeHash(theme)}`, { waitUntil: "domcontentloaded" });
    await expectShowing(page, theme);
    await expectSceneNotStarted(page, theme);
    return release;
  }

  function heroHeights(page: Page, theme: ThemeName) {
    return themeRoot(page, theme)
      .locator(THEME_HOOKS.canvas)
      .evaluate((canvas, heroSelector) => {
        const height = (element: Element | null | undefined) =>
          element?.getBoundingClientRect().height ?? 0;
        return {
          hero: height(canvas.closest(heroSelector)),
          reserved: height(canvas.parentElement),
          drawn: height(canvas),
        };
      }, THEME_HOOKS.hero);
  }

  async function sceneRunning(page: Page, theme: ThemeName): Promise<void> {
    await expect(themeRoot(page, theme)).toHaveAttribute(
      SCENE_STATE_ATTRIBUTE,
      "running",
    );
    await frames(page);
  }

  async function expectHeroHolds(
    page: Page,
    theme: ThemeName,
    options: { width: number; motion: Motion },
  ): Promise<void> {
    const release = await openWithSceneHeld(page, theme, options);
    const before = await heroHeights(page, theme);
    expect(before.hero).toBeGreaterThan(0);

    await release();
    await sceneRunning(page, theme);
    const after = await heroHeights(page, theme);

    expect(Math.abs(after.hero - before.hero)).toBeLessThanOrEqual(
      HOLDS_WITHIN,
    );
    expect(Math.abs(after.drawn - after.reserved)).toBeLessThanOrEqual(
      CANVAS_SNAP,
    );
  }

  /** Held until measured, then failed. Returns the hero's height while loading. */
  async function openWithFailedScene(
    page: Page,
    theme: ThemeName,
    width: number,
  ): Promise<number> {
    await page.route("**/_astro/scene.*.js", (route) => route.abort());
    const release = await openWithSceneHeld(page, theme, {
      width,
      motion: "no-preference",
    });
    const { hero } = await heroHeights(page, theme);
    await release();
    await expect(themeRoot(page, theme)).toHaveAttribute(
      SCENE_STATE_ATTRIBUTE,
      "failed",
    );
    await frames(page);
    return hero;
  }

  async function expectLineBelowStaticHero(
    page: Page,
    theme: ThemeName,
  ): Promise<void> {
    const root = themeRoot(page, theme);
    const hero = await root.locator(THEME_HOOKS.staticHero).boundingBox();
    const line = await root.locator(".now").boundingBox();
    if (!hero || !line) {
      throw new Error("The static hero or line is not showing.");
    }
    expect(line.y).toBeGreaterThanOrEqual(hero.y + hero.height - 1);
  }

  for (const theme of THEMES) {
    for (const motion of MOTIONS) {
      for (const width of WIDTHS) {
        test(`${theme} holds its height at ${width} px, motion ${motion}`, async ({
          page,
        }) => {
          await expectHeroHolds(page, theme, { width, motion });
        });
      }

      test(`${theme} holds its height either side of the compact threshold, motion ${motion}`, async ({
        page,
      }) => {
        const threshold = await fullSceneViewport(page, theme);
        for (const { offset, now } of [
          { offset: -1, now: "html" },
          { offset: 0, now: "board" },
          { offset: 1, now: "board" },
        ]) {
          const width = threshold + offset;
          await test.step(`${width} px`, async () => {
            await expectHeroHolds(page, theme, { width, motion });
            // The runtime agrees which side of the threshold this is.
            await expect(
              themeRoot(page, theme).locator(THEME_HOOKS.hero),
            ).toHaveAttribute("data-now", now);
            await page.goto("about:blank");
          });
        }
      });

      test(`${theme}'s toggle label cannot rewrap the controls, motion ${motion}`, async ({
        page,
      }) => {
        const release = await openWithSceneHeld(page, theme, {
          width: 320,
          motion,
        });
        await release();
        await sceneRunning(page, theme);

        const toggle = themeRoot(page, theme).locator(THEME_HOOKS.toggle);
        const toggleWidth = async () =>
          (await toggle.boundingBox())?.width ?? Number.NaN;
        const labels = new Set<string | null>();
        const widths = [...REWRAP_SWEEP, ...PROTOTYPE_REWRAP_BANDS[theme]];
        for (const width of widths) {
          await test.step(`${width} px`, async () => {
            await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
            await frames(page);
            const { hero: resting } = await heroHeights(page, theme);
            const restingToggle = await toggleWidth();
            for (let press = 0; press < 3; press += 1) {
              labels.add(
                await toggle.locator(THEME_HOOKS.toggleLabel).textContent(),
              );
              await toggle.click();
              await frames(page);
              const { hero } = await heroHeights(page, theme);
              expect(Math.abs(hero - resting)).toBeLessThanOrEqual(
                HOLDS_WITHIN,
              );
              // A wrap needs the right width to show, and which widths those are
              // depends on the fonts. A toggle that holds its width cannot cause one.
              expect(
                Math.abs((await toggleWidth()) - restingToggle),
              ).toBeLessThanOrEqual(TOGGLE_HOLDS_WITHIN);
            }
          });
        }
        // Otherwise no label changed, and this tested nothing.
        expect(labels.size).toBeGreaterThan(1);
      });
    }

    test(`${theme}'s controls stay out of reach until the scene runs`, async ({
      page,
    }) => {
      const release = await openWithSceneHeld(page, theme, {
        width: 1280,
        motion: "no-preference",
      });
      const root = themeRoot(page, theme);
      const controls = root.locator(THEME_HOOKS.controls);
      const hero = root.locator(THEME_HOOKS.hero);

      // They keep their space, so starting the scene moves nothing.
      expect((await controls.boundingBox())?.height).toBeGreaterThan(0);
      // getByRole reads the accessibility tree: nothing there for now.
      await expect(controls.getByRole("button")).toHaveCount(0);
      const focusable = () =>
        controls.locator("button").evaluateAll(
          (buttons) =>
            buttons.filter((button) => {
              button.focus();
              return document.activeElement === button;
            }).length,
        );
      expect(await controls.locator("button").count()).toBeGreaterThan(0);
      expect(await focusable()).toBe(0);

      await hero.focus();
      await page.keyboard.press("Tab", { delay: 120 });
      expect(
        await controls.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(false);

      await release();
      await sceneRunning(page, theme);
      expect(await controls.getByRole("button").count()).toBeGreaterThan(0);
      expect(await focusable()).toBeGreaterThan(0);
    });

    test(`${theme}'s "Right now" is below the static hero after a failure, wrapping or not`, async ({
      page,
    }) => {
      // A 600 px frame is the narrowest that overlays the line before a failure, so
      // it is where the line is most likely to take two rows.
      const threshold = await fullSceneViewport(page, theme);
      const root = themeRoot(page, theme);
      for (const width of [320, threshold, 1280, 1920]) {
        await test.step(`${width} px`, async () => {
          const loading = await openWithFailedScene(page, theme, width);

          await expect(root.locator(THEME_HOOKS.staticHero)).toBeVisible();
          await expect(
            root.locator(`${THEME_HOOKS.controls}:visible`),
          ).toHaveCount(0);
          expect(
            await root.locator(THEME_HOOKS.controls).boundingBox(),
          ).toBeNull();
          await expectLineBelowStaticHero(page, theme);

          // Whatever the content, at least two rows.
          const line = root.locator(".now");
          await line
            .locator(".now__v")
            .first()
            .evaluate((value) => {
              value.textContent = "several long words ".repeat(30);
            });
          await frames(page);
          await expectLineBelowStaticHero(page, theme);
          const label = await line.locator(".now__label").boundingBox();
          const box = await line.boundingBox();
          expect(box?.height).toBeGreaterThan((label?.height ?? 0) * 1.5);

          // The hero changes once, by about the line's height minus the controls' slot.
          const lineOuterHeight = await line.evaluate((element) => {
            const { marginTop, marginBottom } = getComputedStyle(element);
            return (
              element.getBoundingClientRect().height +
              parseFloat(marginTop) +
              parseFloat(marginBottom)
            );
          });
          const failed = await heroHeights(page, theme);
          expect(failed.hero).toBeLessThanOrEqual(
            loading + lineOuterHeight + HOLDS_WITHIN,
          );
          await page.goto("about:blank");
        });
      }
    });

    test(`${theme}'s static hero fits its box without clipping at 320 px after a failure`, async ({
      page,
    }) => {
      await openWithFailedScene(page, theme, 320);
      // Counts what `overflow: hidden` would cut off, which toBeVisible cannot see.
      const overflowing = await themeRoot(page, theme)
        .locator(THEME_HOOKS.staticHero)
        .evaluate((staticHero) =>
          [staticHero, staticHero.parentElement].flatMap((element) =>
            element && element.scrollHeight > element.clientHeight + 1
              ? [
                  `${element.tagName}: ${element.scrollHeight} in ${element.clientHeight}`,
                ]
              : [],
          ),
        );
      expect(overflowing).toEqual([]);
    });
  }
});

test.describe("the tokens the switcher reads", () => {
  for (const theme of THEMES) {
    for (const { name, system, picked } of SCHEME_ROUTES) {
      test(`${theme} sets them, ${name}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: system });
        if (picked) {
          await seedStorage(page, { [STORAGE_KEYS.colorScheme]: picked });
        }
        await page.goto(`/${themeHash(theme)}`);
        await expectShowing(page, theme);

        const notColours = await themeRoot(page, theme).evaluate(
          (root, names) => {
            const style = getComputedStyle(root);
            return names.filter(
              (name) =>
                !CSS.supports("color", style.getPropertyValue(name).trim()),
            );
          },
          SWITCHER_TOKENS,
        );
        expect(notColours).toEqual([]);
      });
    }
  }
});

test.describe("a switched-to section's heading", () => {
  // Real scenes are heavier than stubs, and theme tasks cannot edit this suite.
  test.describe.configure({ timeout: 90_000 });

  /**
   * What sits over the heading and stays put while the page scrolls. It asks the
   * browser what is on top, so a theme with no sticky header has nothing to report,
   * and a fixed backdrop behind the page is not a cover.
   */
  function pinnedCovers(page: Page, id: string): Promise<string[]> {
    return page.evaluate((sectionElementId) => {
      const section = document.getElementById(sectionElementId);
      if (!section) return [`no element #${sectionElementId}`];
      const heading =
        [...section.querySelectorAll("h1, h2, h3")].find(
          (element) => element.getBoundingClientRect().height > 1,
        ) ?? section;
      const { left, top, width, height } = heading.getBoundingClientRect();
      // 1 px for the fraction a scroll can land off.
      if (top < -1) return [`heading is ${-top}px above the viewport`];

      const isPinned = (element: Element | null): boolean => {
        for (let at = element; at; at = at.parentElement) {
          const { position } = getComputedStyle(at);
          if (position === "sticky" || position === "fixed") return true;
        }
        return false;
      };

      const covers = new Set<string>();
      for (const [x, y] of [
        [left + 2, top + 1],
        [left + width / 2, top + 1],
        [left + 2, top + height / 2],
        [left + width / 2, top + height / 2],
      ] as const) {
        for (const element of document.elementsFromPoint(x, y)) {
          if (element === heading || heading.contains(element)) break;
          if (isPinned(element)) covers.add(element.tagName.toLowerCase());
        }
      }
      return [...covers];
    }, id);
  }

  const VIEWPORTS = [
    { name: "desktop", viewport: DESKTOP },
    { name: "phone", viewport: PHONE },
  ];
  const KEYS_WITH_HEADINGS = SECTION_KEYS.filter((key) => key !== "top");

  for (const theme of THEMES) {
    const from = THEMES.find((name) => name !== theme) ?? theme;

    for (const { name, viewport } of VIEWPORTS) {
      test(`${theme} keeps it clear of any pinned header on ${name}`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await serveWithCss(page, tallSectionsCss());
        for (const key of KEYS_WITH_HEADINGS) {
          await test.step(key, async () => {
            await page.goto("about:blank");
            await page.goto(`/${themeHash(from)}`);
            await sceneSettled(page, from);
            await scrollToSection(page, from, key);

            await pickThemeInPlace(page, theme);
            await expectShowing(page, theme);
            await sceneSettled(page, theme);
            await pastPinSettling(page);

            expect(await pinnedCovers(page, sectionId(theme, key))).toEqual([]);
          });
        }
      });
    }
  }
});

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
  const THEME_TOKENS = ["--bg", "--ink", "--muted", ...SWITCHER_TOKENS];
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
