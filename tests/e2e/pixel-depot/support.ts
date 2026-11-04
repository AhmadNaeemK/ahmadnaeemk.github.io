/**
 * What Pixel Depot's specs share: reading the canvas's own pixels, and reading a
 * screenshot back as pixels, to compare what a visitor sees with what was painted.
 */
import { inflateSync } from "node:zlib";
import { expect, type Page } from "@playwright/test";
import type { ThemeName } from "../../../src/scene/contract";
import { canvas } from "../scene/helpers";

export const THEME: ThemeName = "pixel-depot";

/** The `.now` list in the theme's HTML, for specs that choose its items. */
const NOW_LIST = /(<ul class="now__list"[^>]*>)[\s\S]*?(<\/ul>)/;

export const nowItemsHtml =
  (items: readonly (readonly [string, string])[]) =>
  (themeHtml: string): string =>
    themeHtml.replace(
      NOW_LIST,
      `$1${items
        .map(
          ([label, value]) =>
            `<li><span class="now__k">${label}</span> <span class="now__v">${value}</span></li>`,
        )
        .join("")}$2`,
    );

export interface CanvasPixels {
  readonly width: number;
  readonly height: number;
  /** One `0xrrggbb` number per pixel, row by row. */
  readonly pixels: readonly number[];
}

/** The canvas's own pixels, from `fromRow` down, for `rowCount` rows or to the end. */
export const readCanvasPixels = (
  page: Page,
  { fromRow = 0, rowCount }: { fromRow?: number; rowCount?: number } = {},
): Promise<CanvasPixels> =>
  canvas(page, THEME).evaluate(
    (element: HTMLCanvasElement, range) => {
      const context = element.getContext("2d");
      if (!context) throw new Error("The canvas has no 2D context.");
      const { width } = element;
      const height = Math.min(
        range.rowCount ?? element.height,
        element.height - range.fromRow,
      );
      const { data } = context.getImageData(0, range.fromRow, width, height);
      const pixels: number[] = [];
      for (let i = 0; i < data.length; i += 4) {
        pixels.push((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
      }
      return { width, height, pixels };
    },
    { fromRow, rowCount },
  );

/** Buffer rows from the top that hold the billboard and its shadow, at any full width. */
const BILLBOARD_BAND_ROWS = 24;
/** Clear of the billboard's legs too. */
const TOWN_FROM_ROW = 36;

export const readBillboardBand = (page: Page): Promise<CanvasPixels> =>
  readCanvasPixels(page, { rowCount: BILLBOARD_BAND_ROWS });

export const readTownBelowBillboard = (page: Page): Promise<CanvasPixels> =>
  readCanvasPixels(page, { fromRow: TOWN_FROM_ROW });

export const samePixels = (a: CanvasPixels, b: CanvasPixels): boolean =>
  a.width === b.width &&
  a.pixels.length === b.pixels.length &&
  a.pixels.every((pixel, index) => pixel === b.pixels[index]);

/** A `--scene-*` token as the `0xrrggbb` the canvas paints it with. */
export const tokenColour = (
  page: Page,
  token: `--${string}`,
): Promise<number> =>
  canvas(page, THEME).evaluate((element, name) => {
    const value = getComputedStyle(element).getPropertyValue(name).trim();
    return Number.parseInt(value.slice(1), 16);
  }, token);

/** The columns of a band holding a colour, or null if none do. */
export function columnsWith(
  { width, pixels }: CanvasPixels,
  colour: number,
): { first: number; last: number } | null {
  let first = Number.POSITIVE_INFINITY;
  let last = -1;
  pixels.forEach((pixel, index) => {
    if (pixel !== colour) return;
    const column = index % width;
    first = Math.min(first, column);
    last = Math.max(last, column);
  });
  return last < 0 ? null : { first, last };
}

/** Needs `instrumentScenes`. */
export const worldClocks = (
  page: Page,
): Promise<{ time: number; textTime: number }> =>
  page.evaluate((name) => {
    const { time, textTime } = window.__sceneSpy.contexts[name].world;
    return { time, textTime };
  }, THEME);

/** Text rolls 14 px a second, so this is several pixels of roll. */
const VISIBLE_ROLL_SECONDS = 0.5;

/** Long enough on the text clock that rolling text would have moved. */
export async function waitForVisibleRoll(page: Page): Promise<void> {
  const { textTime } = await worldClocks(page);
  await expect
    .poll(async () => (await worldClocks(page)).textTime - textTime)
    .toBeGreaterThan(VISIBLE_ROLL_SECONDS);
}

export interface DecodedPng {
  readonly width: number;
  readonly height: number;
  /** `0xrrggbb` per pixel. */
  readonly pixels: Uint32Array;
}

const PNG_SIGNATURE_BYTES = 8;
const BYTES_PER_CHANNELS: Readonly<Record<number, number>> = { 2: 3, 6: 4 };

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

/** Enough PNG for what browsers' screenshots are: 8-bit RGB(A), not interlaced. */
export function decodePng(png: Buffer): DecodedPng {
  let at = PNG_SIGNATURE_BYTES;
  let width = 0;
  let height = 0;
  let channels = 0;
  const compressed: Buffer[] = [];
  while (at < png.length) {
    const length = png.readUInt32BE(at);
    const type = png.toString("latin1", at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      channels = BYTES_PER_CHANNELS[body[9]] ?? 0;
      if (body[8] !== 8 || channels === 0 || body[12] !== 0) {
        throw new Error("Only 8-bit, non-interlaced RGB(A) PNGs are handled.");
      }
    } else if (type === "IDAT") {
      compressed.push(body);
    }
    at += length + 12;
  }
  const raw = inflateSync(Buffer.concat(compressed));
  const stride = width * channels;
  const pixels = new Uint32Array(width * height);
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(
      y * (stride + 1) + 1,
      (y + 1) * (stride + 1),
    ) as Uint8Array;
    const row = new Uint8Array(stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;
      const predicted = [
        0,
        left,
        up,
        (left + up) >> 1,
        paeth(left, up, upLeft),
      ][filter];
      row[x] = (line[x] + predicted) & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      const start = x * channels;
      pixels[y * width + x] =
        (row[start] << 16) | (row[start + 1] << 8) | row[start + 2];
    }
    previous = row;
  }
  return { width, height, pixels };
}

export interface BlockReport {
  readonly phaseX: number;
  readonly phaseY: number;
  readonly total: number;
  readonly mixed: number;
}

function reportAtPhase(
  { width, height, pixels }: DecodedPng,
  block: number,
  phaseX: number,
  phaseY: number,
): BlockReport {
  let total = 0;
  let mixed = 0;
  for (let top = phaseY; top + block <= height; top += block) {
    for (let left = phaseX; left + block <= width; left += block) {
      total += 1;
      const colour = pixels[top * width + left];
      let solid = true;
      for (let y = top; solid && y < top + block; y += 1) {
        for (let x = left; x < left + block; x += 1) {
          if (pixels[y * width + x] !== colour) {
            solid = false;
            break;
          }
        }
      }
      if (!solid) mixed += 1;
    }
  }
  return { phaseX, phaseY, total, mixed };
}

/**
 * Splits the image into blocks of `block` device pixels and counts those that are
 * not one colour, at the alignment that suits the image best: where a canvas lands
 * depends on the layout above it, which is often fractional.
 */
export function bestBlockReport(image: DecodedPng, block: number): BlockReport {
  let best: BlockReport | null = null;
  for (let phaseY = 0; phaseY < block; phaseY += 1) {
    for (let phaseX = 0; phaseX < block; phaseX += 1) {
      const report = reportAtPhase(image, block, phaseX, phaseY);
      if (!best || report.mixed < best.mixed) best = report;
    }
  }
  if (!best) throw new Error("A block needs at least one device pixel.");
  return best;
}

/**
 * The fewest blocks whose colour differs from the buffer pixel they should show,
 * over the buffer offsets the crop can start at. This is what makes a ratio of 1 at
 * 320 px a real check, as a one-pixel block is always solid but can still be smoothed.
 */
export function fewestWrongBlocks(
  image: DecodedPng,
  buffer: CanvasPixels,
  block: number,
  { phaseX, phaseY }: BlockReport,
): number {
  const MAX_CROPPED_BUFFER_PIXELS = 2;
  let fewest = Number.POSITIVE_INFINITY;
  for (let startY = 0; startY <= MAX_CROPPED_BUFFER_PIXELS; startY += 1) {
    for (let startX = 0; startX <= MAX_CROPPED_BUFFER_PIXELS; startX += 1) {
      let wrong = 0;
      for (let top = phaseY; top + block <= image.height; top += block) {
        for (let left = phaseX; left + block <= image.width; left += block) {
          const column = startX + (left - phaseX) / block;
          const row = startY + (top - phaseY) / block;
          if (
            image.pixels[top * image.width + left] !==
            buffer.pixels[row * buffer.width + column]
          ) {
            wrong += 1;
          }
        }
      }
      fewest = Math.min(fewest, wrong);
    }
  }
  return fewest;
}
