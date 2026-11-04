import { expect, type Page } from "@playwright/test";
import {
  SECTION_KEYS,
  sectionId,
  themeHash,
  type SectionKey,
  type ThemeName,
} from "../../../src/scene/contract";
import {
  currentHash,
  DESKTOP,
  expectSectionAtTop,
  expectShowing,
  frames,
  PHONE,
  pickThemeInPlace,
  sceneSettled,
  scrollToSection,
  serveWithCss,
  switcherChoice,
  tallSectionsCss,
  test,
  THEME_PAIRS,
  THEMES,
  themeRoot,
  pastPinSettling,
} from "./support";

test.describe.configure({ mode: "parallel" });

/** A fresh page on `from`, scrolled to `key`. */
async function readingSection(
  page: Page,
  from: ThemeName,
  key: SectionKey,
): Promise<void> {
  await page.goto("about:blank");
  await page.goto(`/${themeHash(from)}`);
  await expectShowing(page, from);
  // Its first show moves the page, and would move the visitor off the section.
  await sceneSettled(page, from);
  // `top` is where a visitor who has not scrolled already is.
  if (key !== "top") await scrollToSection(page, from, key);
}

for (const [name, viewport] of [
  ["desktop", DESKTOP],
  ["phone", PHONE],
] as const) {
  test.describe(`on ${name}`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await serveWithCss(page, tallSectionsCss());
    });

    for (const { from, to } of THEME_PAIRS) {
      test(`${from} to ${to} keeps every section (E30)`, async ({ page }) => {
        for (const key of SECTION_KEYS) {
          await test.step(key, async () => {
            await readingSection(page, from, key);

            await pickThemeInPlace(page, to);
            await expectShowing(page, to);
            await sceneSettled(page, to);
            await frames(page);

            // `top` is `<main>`, which a switch scrolls to the viewport top.
            await expectSectionAtTop(page, to, key);
            expect(await currentHash(page)).toBe(themeHash(to));
          });
        }
      });
    }

    test("a round trip through every theme keeps the key, under a sticky header's margin", async ({
      page,
    }) => {
      await serveWithCss(
        page,
        `${tallSectionsCss()}
        [data-rail-theme-root] :is(main, section[id]) { scroll-margin-top: 72px !important; }`,
      );
      for (const key of SECTION_KEYS) {
        await test.step(key, async () => {
          const [first, ...others] = THEMES as [ThemeName, ...ThemeName[]];
          await readingSection(page, first, key);

          // Twice round: a margin read wrong walks back one section per switch.
          for (const theme of [...others, first, ...others, first]) {
            await pickThemeInPlace(page, theme);
            await expectShowing(page, theme);
            await sceneSettled(page, theme);
            await frames(page);
            await expectSectionAtTop(page, theme, key);
          }
        });
      }
    });
  });
}

test.describe("without animation", () => {
  test("the section is in place in the same task as the switch", async ({
    page,
  }) => {
    await serveWithCss(page, tallSectionsCss());
    await readingSection(page, "interchange", "projects");
    const choice = await switcherChoice(page, "diorama").elementHandle();

    const offsetAfterClick = await page.evaluate(
      ({ link, id }) => {
        (link as HTMLElement | null)?.click();
        const section = document.getElementById(id);
        if (!section) return Number.NaN;
        return (
          section.getBoundingClientRect().top -
          parseFloat(getComputedStyle(section).scrollMarginTop)
        );
      },
      { link: choice, id: sectionId("diorama", "projects") },
    );

    expect(Math.abs(offsetAfterClick)).toBeLessThanOrEqual(1.5);
  });
});

test.describe("at the bottom of the page", () => {
  test("a short last section counts as the one in view", async ({ page }) => {
    // Contact is left short, so it can never reach the viewport top.
    await serveWithCss(
      page,
      tallSectionsCss(["about", "work", "projects", "skills"]),
    );
    await page.goto("/#a-about");
    await pastPinSettling(page);
    await page.evaluate(() =>
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "instant",
      }),
    );
    await frames(page);

    await pickThemeInPlace(page, "diorama");
    await expect
      .poll(() => currentHash(page))
      .toBe(`#${sectionId("diorama", "contact")}`);
    await sceneSettled(page, "diorama");
    await frames(page);
    const contact = page.locator(`[id="${sectionId("diorama", "contact")}"]`);
    await expect(contact).toBeInViewport();
  });
});

test.describe("switching quickly (E11)", () => {
  test("the last choice wins and the section holds", async ({ page }) => {
    await serveWithCss(page, tallSectionsCss());
    await readingSection(page, "interchange", "projects");

    for (const theme of [
      "diorama",
      "pixel-depot",
      "diorama",
      "interchange",
      "pixel-depot",
    ] as const) {
      await pickThemeInPlace(page, theme);
    }

    await expectShowing(page, "pixel-depot");
    await sceneSettled(page, "pixel-depot");
    await frames(page);
    await expectSectionAtTop(page, "pixel-depot", "projects");
    expect(await currentHash(page)).toBe("#pixel-depot");
    for (const theme of ["interchange", "diorama"] as const) {
      await expect(themeRoot(page, theme)).not.toHaveAttribute(
        "data-scene-state",
        "running",
      );
    }
  });
});
