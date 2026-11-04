import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { THEME_HOOKS, themeHash } from "../../../src/scene/contract";
import {
  expect,
  expectState,
  failSceneChunks,
  type PageProblems,
  root,
  test,
} from "../scene/helpers";
import { decodePng, THEME } from "./support";

const NOTE = "The town is asleep";
const HANDLE = /^\s*handle:\s*(\S+)/m.exec(
  readFileSync(resolve("src/content/profile.yaml"), "utf8"),
)?.[1];
/** WCAG AA: normal text, and large text like the sign. */
const NOTE_MIN_CONTRAST = 4.5;
const SIGN_MIN_CONTRAST = 3;
/** Ignores anti-aliased edges of the background's dots. */
const BACKGROUND_COLOUR_MIN_SHARE = 0.005;

const staticHero = (page: Page) =>
  root(page, THEME).locator(THEME_HOOKS.staticHero);

async function openWithFailedScene(
  page: Page,
  problems: PageProblems,
  width: number,
  colorScheme: "light" | "dark" = "light",
): Promise<void> {
  await page.emulateMedia({ colorScheme });
  await page.setViewportSize({ width, height: 800 });
  await failSceneChunks(page);
  await page.goto(`/${themeHash(THEME)}`);
  await expectState(page, THEME, "failed");
  await expect.poll(() => problems.sceneErrors.length).toBeGreaterThan(0);
  problems.sceneErrors.length = 0;
}

const channels = (colour: number) => [
  (colour >> 16) & 0xff,
  (colour >> 8) & 0xff,
  colour & 0xff,
];

function luminance(colour: number): number {
  const [red, green, blue] = channels(colour).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(a: number, b: number): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const parseRgb = (css: string): number => {
  const [red, green, blue] = (css.match(/[\d.]+/g) ?? []).map(Number);
  return (red << 16) | (green << 8) | blue;
};

test.describe("the static hero after a failed chunk", () => {
  test("shows the handle and the note", async ({ page, problems }) => {
    await openWithFailedScene(page, problems, 1280);
    expect(HANDLE).toBeTruthy();
    await expect(staticHero(page)).toBeVisible();
    await expect(staticHero(page)).toContainText(HANDLE ?? "");
    await expect(staticHero(page)).toContainText(NOTE);
  });

  for (const width of [320, 390, 768, 1280]) {
    test(`keeps all its text inside its box at ${width} px`, async ({
      page,
      problems,
    }) => {
      await openWithFailedScene(page, problems, width);
      const cutOff = await staticHero(page).evaluate((element) => {
        const box = element.parentElement?.getBoundingClientRect();
        if (!box) return ["no parent"];
        const range = document.createRange();
        range.selectNodeContents(element);
        return [...range.getClientRects()].flatMap((rect) =>
          rect.top < box.top - 1 ||
          rect.bottom > box.bottom + 1 ||
          rect.left < box.left - 1 ||
          rect.right > box.right + 1
            ? [`${rect.top}-${rect.bottom} in ${box.top}-${box.bottom}`]
            : [],
        );
      });
      expect(cutOff).toEqual([]);
    });
  }

  for (const colorScheme of ["light", "dark"] as const) {
    for (const width of [320, 1280]) {
      test(`is readable against everything behind it, ${colorScheme}, ${width} px`, async ({
        page,
        problems,
      }) => {
        await openWithFailedScene(page, problems, width, colorScheme);
        const [signColour, noteColour] = await staticHero(page).evaluate(
          (element) => {
            const colours = [...element.children].map(
              (child) => getComputedStyle(child).color,
            );
            // Leaves only the background in the screenshot below.
            for (const child of element.children) {
              const { style } = child as HTMLElement;
              style.color = "transparent";
              style.textShadow = "none";
            }
            return colours;
          },
        );

        const { pixels } = decodePng(await staticHero(page).screenshot());
        const counts = new Map<number, number>();
        for (const pixel of pixels) {
          counts.set(pixel, (counts.get(pixel) ?? 0) + 1);
        }
        const background = [...counts]
          .filter(
            ([, count]) => count / pixels.length >= BACKGROUND_COLOUR_MIN_SHARE,
          )
          .map(([colour]) => colour);
        expect(background.length).toBeGreaterThan(0);

        const lowest = (text: string) =>
          Math.min(
            ...background.map((colour) => contrast(parseRgb(text), colour)),
          );
        expect(lowest(signColour)).toBeGreaterThanOrEqual(SIGN_MIN_CONTRAST);
        expect(lowest(noteColour)).toBeGreaterThanOrEqual(NOTE_MIN_CONTRAST);
      });
    }
  }
});
