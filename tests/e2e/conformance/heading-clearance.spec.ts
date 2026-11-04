/**
 * Fonts that fail to load, or a machine without them, make a header's links wider, so
 * it can wrap taller than the height the theme allows for above a section. CI's Linux
 * fonts did that at widths where macOS's did not. So this measures with a wide fallback
 * on every platform: Verdana where it exists, and DejaVu Sans, about as wide, on Linux.
 */
import { expect, type Page } from "@playwright/test";
import {
  SECTION_KEYS,
  sectionId,
  THEME_HOOKS,
  themeHash,
  type ThemeName,
} from "../../../src/scene/contract";
import {
  expectShowing,
  frames,
  pastPinSettling,
  sceneSettled,
  serveWithCss,
  tallSectionsCss,
  test,
  THEMES,
} from "../selection/support";

test.describe.configure({ mode: "parallel" });

const WIDE_FALLBACK_CSS = `
  [data-rail-theme-root] * {
    font-family: Verdana, "DejaVu Sans", sans-serif !important;
  }
`;

/** Either side of where the themes' headers change shape or wrap. */
const WIDTHS = [
  320, 322, 330, 336, 340, 360, 375, 390, 400, 412, 420, 424, 430, 440, 458,
  462, 480, 600, 768, 920, 930, 960, 990, 1000, 1040, 1050, 1100, 1120, 1130,
  1280, 1920,
];

const SECTIONS_WITH_HEADINGS = SECTION_KEYS.filter((key) => key !== "top");

/** One line for each heading under the header, once each section is scrolled to. */
function headingsUnderHeader(page: Page, theme: ThemeName): Promise<string[]> {
  return page.evaluate(
    ({ header, sectionIds }) =>
      sectionIds.flatMap((id) => {
        const section = document.getElementById(id) as HTMLElement;
        section.scrollIntoView({ block: "start", behavior: "instant" });
        const headerBottom = (
          document.querySelector(header) as HTMLElement
        ).getBoundingClientRect().bottom;
        const headingTop = (
          section.querySelector("h2") as HTMLElement
        ).getBoundingClientRect().top;
        const overlap = headerBottom - headingTop;
        return overlap > 0 ? [`${id}, by ${overlap.toFixed(1)} px`] : [];
      }),
    {
      header: `[data-rail-theme-root="${theme}"] header:has(${THEME_HOOKS.themeSwitcher})`,
      sectionIds: SECTIONS_WITH_HEADINGS.map((key) => sectionId(theme, key)),
    },
  );
}

for (const theme of THEMES) {
  test(`${theme}: a wide fallback font leaves every section heading clear of the header`, async ({
    page,
  }) => {
    await serveWithCss(page, WIDE_FALLBACK_CSS + tallSectionsCss());
    await page.goto(`/${themeHash(theme)}`);
    await expectShowing(page, theme);
    await sceneSettled(page, theme);
    await pastPinSettling(page);

    const covered: string[] = [];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await frames(page);
      const headings = await headingsUnderHeader(page, theme);
      covered.push(...headings.map((heading) => `${width} px: ${heading}`));
    }

    expect(covered).toEqual([]);
  });
}
