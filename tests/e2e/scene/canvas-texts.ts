/** What a theme's canvas drew as text, for the themes that draw it with `fillText`. */
import type { Page } from "@playwright/test";
import {
  THEME_ROOT_ATTRIBUTE,
  type ThemeName,
} from "../../../src/scene/contract";

/** One `fillText` on a theme's canvas, with its box in device pixels. */
export interface CanvasText {
  readonly text: string;
  readonly box: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

declare global {
  interface Window {
    __canvasTexts: CanvasText[];
  }
}

/** Half the height of a board's text in the scene's units, from its font size. */
const TEXT_HALF_HEIGHT = 7;
const TEXTS_KEPT = 2000;

/** Call before the page loads. Keeps every text the theme's scene draws. */
export async function logThemeCanvasTexts(
  page: Page,
  theme: ThemeName,
): Promise<void> {
  await page.addInitScript(
    ({ rootAttribute, themeName, halfHeight, kept }) => {
      const log: CanvasText[] = [];
      window.__canvasTexts = log;
      const prototype = CanvasRenderingContext2D.prototype;
      const fillText = prototype.fillText;
      prototype.fillText = function (
        this: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        maxWidth?: number,
      ) {
        const owner = this.canvas as HTMLCanvasElement;
        if (owner.closest(`[${rootAttribute}="${themeName}"]`)) {
          const { a, d, e, f } = this.getTransform();
          log.push({
            text,
            box: {
              x: Math.round(a * x + e),
              y: Math.round(d * (y - halfHeight) + f),
              width: Math.round(a * this.measureText(text).width),
              height: Math.round(d * halfHeight * 2),
            },
          });
          if (log.length > kept) log.splice(0, log.length - kept);
        }
        return maxWidth === undefined
          ? fillText.call(this, text, x, y)
          : fillText.call(this, text, x, y, maxWidth);
      };
    },
    {
      rootAttribute: THEME_ROOT_ATTRIBUTE,
      themeName: theme,
      halfHeight: TEXT_HALF_HEIGHT,
      kept: TEXTS_KEPT,
    },
  );
}

export const clearCanvasTexts = (page: Page): Promise<void> =>
  page.evaluate(() => {
    window.__canvasTexts.length = 0;
  });

/**
 * Everything drawn since `firstText` was last drawn, it included, or an empty list
 * when it was not drawn since the log was last cleared.
 */
export const lastTextsFrom = (
  page: Page,
  firstText: string,
): Promise<CanvasText[]> =>
  page.evaluate((chipText) => {
    const log = window.__canvasTexts;
    const start = log.map(({ text }) => text).lastIndexOf(chipText);
    return start < 0 ? [] : log.slice(start);
  }, firstText);
