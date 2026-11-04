/**
 * What Interchange's own specs share: the real content, read from its files, and
 * what the page really painted, read back as pixels. No spec here pins a colour or
 * a piece of content: they compare what is on screen with those two sources.
 */
import { inflateSync } from "node:zlib";
import type { LoaderContext } from "astro/loaders";
import { type Page } from "@playwright/test";
import type { RawCollections } from "../../../src/content/assemble";
import { dateLabels } from "../../../src/content/month";
import { strictFile } from "../../../src/content/strict-file-loader";
import {
  THEME_ROOT_ATTRIBUTE,
  type ThemeName,
} from "../../../src/scene/contract";
import { canvas } from "../scene/helpers";

export const THEME: ThemeName = "interchange";

export const PHONE = { width: 390, height: 844 };
export const DESKTOP = { width: 1280, height: 720 };

const PROJECT_ROOT = new URL("../../../", import.meta.url);

type DataOf<Name extends keyof RawCollections> =
  RawCollections[Name][number]["data"];

/** Through the site's own loader, so an editor's change to a file moves these specs too. */
async function readCollection<Name extends keyof RawCollections>(
  collection: Name,
): Promise<DataOf<Name>[]> {
  const entries: DataOf<Name>[] = [];
  const noOp = () => {};
  const context = {
    collection,
    config: { root: PROJECT_ROOT },
    logger: { debug: noOp, info: noOp, warn: noOp, error: noOp },
    parseData: async ({ data }: { data: unknown }) => data,
    store: {
      clear: noOp,
      set: ({ data }: { data: DataOf<Name> }) => {
        entries.push(data);
      },
    },
  };
  await strictFile(`src/content/${collection}.yaml`).load(
    context as unknown as LoaderContext,
  );
  return entries;
}

const inOrder = <Entry extends { order: number }>(entries: Entry[]) =>
  entries.toSorted((a, b) => a.order - b.order);

const withDates = <Entry extends { start: string; end: string }>(
  entry: Entry,
) => ({ ...entry, ...dateLabels(entry.start, entry.end) });

async function readContent() {
  const [profiles, experience, education, projects, skills, nows] =
    await Promise.all([
      readCollection("profile"),
      readCollection("experience"),
      readCollection("education"),
      readCollection("projects"),
      readCollection("skills"),
      readCollection("now"),
    ]);
  return {
    profile: profiles[0],
    experience: inOrder(experience).map(withDates),
    education: inOrder(education).map(withDates),
    projects: inOrder(projects).map(withDates),
    skills: inOrder(skills),
    now: nows[0].items,
  };
}

export const content = readContent();

/** Pixels in RGBA order, top row first. */
export interface Pixels {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

const PNG_SIGNATURE_BYTES = 8;
const CHANNELS_BY_COLOUR_TYPE: Readonly<Record<number, number>> = {
  2: 3,
  6: 4,
};

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

/** Enough PNG for a browser's screenshot: 8 bits, no interlacing, no palette. */
export function decodeScreenshot(png: Buffer): Pixels {
  const compressed: Buffer[] = [];
  let width = 0;
  let height = 0;
  let channels = 0;
  for (let at = PNG_SIGNATURE_BYTES; at < png.length;) {
    const length = png.readUInt32BE(at);
    const type = png.toString("latin1", at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      channels = CHANNELS_BY_COLOUR_TYPE[body[9]] ?? 0;
      if (body[8] !== 8 || body[12] !== 0 || channels === 0) {
        throw new Error("This screenshot's PNG format is not handled here.");
      }
    }
    if (type === "IDAT") compressed.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(compressed));
  const stride = width * channels;
  const rows = new Uint8Array(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const source = y * (stride + 1) + 1;
    const row = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? rows[row + x - channels] : 0;
      const up = y > 0 ? rows[row + x - stride] : 0;
      const upLeft =
        x >= channels && y > 0 ? rows[row + x - stride - channels] : 0;
      const predicted = [
        0,
        left,
        up,
        (left + up) >> 1,
        paeth(left, up, upLeft),
      ][filter];
      rows[row + x] = raw[source + x] + predicted;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = rows[i * channels];
    rgba[i * 4 + 1] = rows[i * channels + 1];
    rgba[i * 4 + 2] = rows[i * channels + 2];
    rgba[i * 4 + 3] = channels === 4 ? rows[i * channels + 3] : 255;
  }
  return { width, height, rgba };
}

const packColour = (rgba: Uint8Array, i: number) =>
  (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2];

/** How many pixels each colour covers, biggest first. */
export function coloursBySize(pixels: Pixels): [number, number][] {
  const counts = new Map<number, number>();
  for (let i = 0; i < pixels.width * pixels.height; i += 1) {
    const colour = packColour(pixels.rgba, i);
    counts.set(colour, (counts.get(colour) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
}

const relativeLuminance = (colour: number) => {
  const [r, g, b] = [colour >> 16, (colour >> 8) & 255, colour & 255].map(
    (channel) => {
      const value = channel / 255;
      return value <= 0.03928
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    },
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** The WCAG ratio, 1 to 21. */
export function contrastRatio(a: number, b: number): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (light + 0.05) / (dark + 0.05);
}

/** How far the text in `pixels` stands out from the colour most of them are. */
export function textContrast(pixels: Pixels): number {
  const colours = coloursBySize(pixels);
  const background = colours[0][0];
  return Math.max(
    ...colours.map(([colour]) => contrastRatio(colour, background)),
  );
}

export interface CanvasRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Device pixels of a part of Interchange's canvas. */
export async function readCanvasPixels(
  page: Page,
  rect: CanvasRect,
): Promise<Pixels> {
  const { width, height, bytes } = await canvas(page, THEME).evaluate(
    (element: HTMLCanvasElement, { x, y, width: w, height: h }) => {
      const context = element.getContext("2d");
      if (!context) throw new Error("The canvas has no 2D context.");
      const image = context.getImageData(x, y, w, h);
      return {
        width: image.width,
        height: image.height,
        bytes: Array.from(image.data),
      };
    },
    rect,
  );
  return { width, height, rgba: Uint8Array.from(bytes) };
}

/** One `fillText` on Interchange's canvas, with its box in device pixels. */
export interface CanvasText {
  readonly text: string;
  readonly box: CanvasRect;
}

declare global {
  interface Window {
    __canvasTexts: CanvasText[];
  }
}

/** The label the board's chip carries, and where each drawing of the board begins. */
const BOARD_CHIP_TEXT = "Right now";
/** Half the height of the chip's text in the scene's units, from its font size. */
const TEXT_HALF_HEIGHT = 7;
const TEXTS_KEPT = 2000;

/** Call before the page loads. Keeps every text the scene draws. */
export async function logCanvasTexts(page: Page): Promise<void> {
  await page.addInitScript(
    ({ rootAttribute, theme, halfHeight, kept }) => {
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
        if (owner.closest(`[${rootAttribute}="${theme}"]`)) {
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
      theme: THEME,
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
 * The most recent drawing of the board, its chip first and then all it rolled, or
 * an empty list when none was drawn since the log was last cleared.
 */
export const lastBoardTexts = (page: Page): Promise<CanvasText[]> =>
  page.evaluate((chipText) => {
    const log = window.__canvasTexts;
    const start = log.map(({ text }) => text).lastIndexOf(chipText);
    return start < 0 ? [] : log.slice(start);
  }, BOARD_CHIP_TEXT);
