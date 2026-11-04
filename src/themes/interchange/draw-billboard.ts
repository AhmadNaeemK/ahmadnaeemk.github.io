/** The "Right now" board in the sky above the map. */
import { marqueeSegments } from "../../rail";
import type { MarqueeSegment } from "../../rail";
import type { NowItem } from "../../scene/contract";
import type { Paint, SceneTokens } from "./scene-tokens";

const LABEL = "Right now";
const CENTRE_X = 430;
const TOP = -58;
const HEIGHT = 34;
/** Keeps a long item inside the sky: the text rolls, so the board need not fit it. */
const MAX_WIDTH = 600;
const POST_INSET = 40;
const POST_BOTTOM = -7;
const ROLL_SPEED = 26;
const SCANLINE_STEP = 2.2;
const SCANLINE_WIDTH = 0.7;
/** Ends each item, and with it the loop: `marqueeSegments` adds no gap of its own. */
const ITEM_SEPARATOR = "      ·      ";
const KEY_GAP = "  ";
/** The "Right now" chip's distance from the board's edge, on every side but its right. */
const CHIP_INSET = 6;
/** Between the chip's edge and its text. */
const CHIP_PADDING = 6;
/** Between the chip and the rolling text. */
const CHIP_GAP = 14;
/** The widest key and value, side by side, set the board's width. */
const KEY_VALUE_GAP = 8;
const TEXT_END_PADDING = 16;
/** The rolling text's clip starts this far left of the text. */
const WINDOW_BLEED = 4;

interface BoardFonts {
  readonly key: string;
  readonly value: string;
  readonly label: string;
}

/** What only changes with the tokens, so it is not rebuilt each frame. */
interface BoardText {
  readonly tokens: SceneTokens;
  readonly fonts: BoardFonts;
  readonly segments: readonly MarqueeSegment[];
}

interface BoardLayout {
  readonly x: number;
  readonly width: number;
  readonly labelWidth: number;
}

function fontsFor(fontFamily: string): BoardFonts {
  return {
    key: `600 12px ${fontFamily}`,
    value: `700 13px ${fontFamily}`,
    label: `800 11px ${fontFamily}`,
  };
}

function widestText(
  ctx: CanvasRenderingContext2D,
  font: string,
  texts: readonly string[],
): number {
  ctx.font = font;
  return Math.max(...texts.map((text) => ctx.measureText(text).width));
}

function measureBoard(
  ctx: CanvasRenderingContext2D,
  items: readonly NowItem[],
  fonts: BoardFonts,
): BoardLayout {
  const keyWidth = widestText(
    ctx,
    fonts.key,
    items.map(({ label }) => label),
  );
  const valueWidth = widestText(
    ctx,
    fonts.value,
    items.map(({ value }) => value),
  );
  const labelWidth = widestText(ctx, fonts.label, [LABEL]) + 2 * CHIP_PADDING;
  const width = Math.min(
    MAX_WIDTH,
    CHIP_INSET +
      labelWidth +
      CHIP_GAP +
      keyWidth +
      KEY_VALUE_GAP +
      valueWidth +
      TEXT_END_PADDING,
  );
  return { x: CENTRE_X - width / 2, width, labelWidth };
}

function rollingSegments(
  items: readonly NowItem[],
  fonts: BoardFonts,
  tokens: SceneTokens,
): MarqueeSegment[] {
  return items.flatMap(({ label, value }) => [
    { text: label + KEY_GAP, font: fonts.key, color: tokens.boardKey },
    { text: value, font: fonts.value, color: tokens.boardValue },
    { text: ITEM_SEPARATOR, font: fonts.key, color: tokens.boardSeparator },
  ]);
}

function fillRounded(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number; radius: number },
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.width, box.height, box.radius);
  ctx.fill();
}

function drawFrame({ ctx, tokens }: Paint, { x, width }: BoardLayout): void {
  ctx.strokeStyle = tokens.ink;
  ctx.lineWidth = 3;
  ctx.lineCap = "butt";
  for (const postX of [x + POST_INSET, x + width - POST_INSET]) {
    ctx.beginPath();
    ctx.moveTo(postX, TOP + HEIGHT);
    ctx.lineTo(postX, POST_BOTTOM);
    ctx.stroke();
  }
  fillRounded(
    ctx,
    { x: x + 3, y: TOP + 5, width, height: HEIGHT, radius: 6 },
    tokens.shadow,
  );
  fillRounded(
    ctx,
    { x: x - 3, y: TOP - 3, width: width + 6, height: HEIGHT + 6, radius: 8 },
    tokens.ink,
  );
  fillRounded(
    ctx,
    { x, y: TOP, width, height: HEIGHT, radius: 5 },
    tokens.board,
  );
}

/** The billboard's drawing, with its text measurements kept between frames. */
export function createBillboard(items: readonly NowItem[]) {
  let layout: BoardLayout | null = null;
  let text: BoardText | null = null;

  function textFor(tokens: SceneTokens): BoardText {
    if (text?.tokens === tokens) return text;
    const fonts = fontsFor(tokens.fontFamily);
    text = { tokens, fonts, segments: rollingSegments(items, fonts, tokens) };
    return text;
  }

  return {
    draw(paint: Paint, textTime: number): void {
      if (items.length === 0) return;
      const { ctx, tokens } = paint;
      const { fonts, segments } = textFor(tokens);
      layout ??= measureBoard(ctx, items, fonts);
      const { x, width, labelWidth } = layout;
      const textMiddle = TOP + HEIGHT / 2 + 1;

      drawFrame(paint, layout);

      ctx.textBaseline = "middle";
      fillRounded(
        ctx,
        {
          x: x + CHIP_INSET,
          y: TOP + CHIP_INSET,
          width: labelWidth,
          height: HEIGHT - 2 * CHIP_INSET,
          radius: 4,
        },
        tokens.boardLabelBg,
      );
      ctx.fillStyle = tokens.boardLabelInk;
      ctx.font = fonts.label;
      ctx.fillText(LABEL, x + CHIP_INSET + CHIP_PADDING, textMiddle);

      const textStart = x + CHIP_INSET + labelWidth + CHIP_GAP;
      const windowX = textStart - WINDOW_BLEED;
      const windowWidth = x + width - CHIP_INSET - windowX;

      ctx.save();
      ctx.beginPath();
      ctx.rect(windowX, TOP + 3, windowWidth, HEIGHT - 6);
      ctx.clip();
      ctx.shadowColor = tokens.boardGlow;
      ctx.shadowBlur = 3;
      marqueeSegments(ctx, segments, {
        x: textStart,
        baseline: textMiddle,
        width: windowWidth,
        time: textTime,
        speed: ROLL_SPEED,
      });
      ctx.restore();

      ctx.fillStyle = tokens.boardScanline;
      for (let lineX = windowX; lineX < x + width - 4; lineX += SCANLINE_STEP) {
        ctx.fillRect(lineX, TOP + 3, SCANLINE_WIDTH, HEIGHT - 6);
      }
    },
    /** A web font arrived, so what was measured with a fallback is wrong. */
    dropMeasurements(): void {
      layout = null;
    },
  };
}
