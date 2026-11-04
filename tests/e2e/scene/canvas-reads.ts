/** What the canvas shows, read from its pixels. */
import type { Page } from "@playwright/test";
import type { ThemeName } from "../../../src/scene/contract";
import { canvas } from "./page-actions";

/**
 * The colours covering a real share of what the canvas shows, which changes when
 * a scheme reaches the scene but not as the train moves.
 */
export const canvasPalette = (
  page: Page,
  theme: ThemeName,
): Promise<string[]> =>
  canvas(page, theme).evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("2d");
    if (!context || element.width === 0 || element.height === 0) return [];
    const { data } = context.getImageData(0, 0, element.width, element.height);
    const counts = new Map<number, number>();
    let painted = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] !== 255) continue;
      painted += 1;
      const colour = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      counts.set(colour, (counts.get(colour) ?? 0) + 1);
    }
    return [...counts]
      .filter(([, count]) => count >= painted / 100)
      .map(([colour]) => colour.toString(16))
      .sort();
  });

/** Changes as soon as anything on the canvas does. */
export const canvasFingerprint = (
  page: Page,
  theme: ThemeName,
): Promise<number> =>
  canvas(page, theme).evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("2d");
    if (!context || element.width === 0 || element.height === 0) return 0;
    const { data } = context.getImageData(0, 0, element.width, element.height);
    let hash = 0;
    for (const value of data) hash = (hash * 31 + value) | 0;
    return hash;
  });
