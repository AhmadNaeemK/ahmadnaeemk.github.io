/** A section's scroll margin reads the header's height, so it has to stay true. */
import { expect, type Page } from "@playwright/test";
import {
  HEADER_HEIGHT_PROPERTY,
  THEME_HOOKS,
  themeHash,
  type ThemeName,
} from "../../../src/scene/contract";
import {
  expectShowing,
  frames,
  headingsUnderHeader,
  pastPinSettling,
  pickTheme,
  sceneSettled,
  serveWithCss,
  tallSectionsCss,
  test,
  THEMES,
  themeRoot,
} from "../selection/support";

test.describe.configure({ mode: "parallel" });

const VIEWPORT_HEIGHT = 800;
const WIDTHS = [320, 390, 768, 1280];
const LARGER_TEXT_CSS = "html { font-size: 150% !important; }";

/** The header's height on the page, and what the theme was told it is. */
const headerHeights = (page: Page, theme: ThemeName) =>
  themeRoot(page, theme).evaluate(
    (root: HTMLElement, { switcher, property }) => {
      const header = root.querySelector(`header:has(${switcher})`) as Element;
      return {
        shown: Math.ceil(header.getBoundingClientRect().height),
        told: root.style.getPropertyValue(property),
      };
    },
    { switcher: THEME_HOOKS.themeSwitcher, property: HEADER_HEIGHT_PROPERTY },
  );

async function expectHeightFollowsHeader(
  page: Page,
  theme: ThemeName,
): Promise<number> {
  await expect
    .poll(async () => {
      const { shown, told } = await headerHeights(page, theme);
      return told === `${shown}px`;
    })
    .toBe(true);
  return (await headerHeights(page, theme)).shown;
}

async function open(page: Page, theme: ThemeName, width: number) {
  await serveWithCss(page, tallSectionsCss());
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.goto(`/${themeHash(theme)}`);
  await expectShowing(page, theme);
  await sceneSettled(page, theme);
  await pastPinSettling(page);
}

for (const theme of THEMES) {
  test(`${theme}: the height follows the header as the page narrows`, async ({
    page,
  }) => {
    await open(page, theme, 1280);
    const wide = await expectHeightFollowsHeader(page, theme);

    await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
    const narrow = await expectHeightFollowsHeader(page, theme);

    // A phone's header has a row of its own for the links.
    expect(narrow).toBeGreaterThan(wide);
  });

  test(`${theme}: at larger text the height grows with the header, and headings stay clear`, async ({
    page,
  }) => {
    await open(page, theme, 390);
    const normal = await expectHeightFollowsHeader(page, theme);

    await page.addStyleTag({ content: LARGER_TEXT_CSS });
    await expect
      .poll(() => expectHeightFollowsHeader(page, theme))
      .toBeGreaterThan(normal);

    for (const width of WIDTHS) {
      await test.step(`${width} px`, async () => {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await frames(page);
        await expectHeightFollowsHeader(page, theme);
        expect(await headingsUnderHeader(page, theme)).toEqual([]);
      });
    }
  });

  test(`${theme}: a theme switched to is told its own header's height`, async ({
    page,
  }) => {
    const to = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    await open(page, theme, 390);

    await pickTheme(page, to);
    await expectShowing(page, to);

    await expectHeightFollowsHeader(page, to);
  });
}
