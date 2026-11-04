/**
 * Fonts that fail to load, or a machine without them, make a header's links wider, so
 * it can wrap taller. A section's scroll margin follows the header's measured height,
 * so a heading should stay clear of it anyway. CI's Linux fonts wrapped at widths where
 * macOS's did not, so this measures with a wide fallback on every platform: Verdana
 * where it exists, and DejaVu Sans, about as wide, on Linux.
 */
import { expect } from "@playwright/test";
import { themeHash } from "../../../src/scene/contract";
import {
  expectShowing,
  frames,
  headingsUnderHeader,
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
