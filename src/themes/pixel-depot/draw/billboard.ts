/**
 * The "Right now" board that stands over the town at full width. It draws its own
 * text, so it keeps the rules the engine's helpers would: text rolls on `textTime`
 * for everyone, one item that fits stays still, and a long one scrolls in the board.
 */
import type { NowItem } from "../../../scene/contract";
import { glyphFor, textWidth, toBoardText } from "./glyphs";
import { Raster, solid, STRUCTURE_SHADOW, type Pixel } from "./raster";
import { worldToBufferX, worldToBufferY, type Stage } from "./stage";

const LABEL = "NOW";
const SEPARATOR = "   ·   ";
const GLYPH_ROWS = 7;
const BOARD_HEIGHT = 17;
const ROLL_PIXELS_PER_SECOND = 14;
const SHADOW_OFFSET = 2;
/** Clear of the canvas edge on both sides, so a long item cannot run off it. */
const CANVAS_MARGIN = 4;
const LABEL_PADDING = 9;
const TEXT_GAP = 6;
const COLUMN_GAP = 5;
const CENTRE_WORLD_X = 430;
const TOP_WORLD_Y = -58;
const LEGS_FOOT_WORLD_Y = -8;
const LEG_INSET = 6;
const BULB_SPACING = 6;

interface BoardBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  /** Where the label's panel stops. */
  readonly labelEnd: number;
  /** Where the item text starts. */
  readonly textStart: number;
}

interface TextRun {
  readonly text: string;
  readonly tone: "boardKey" | "boardValue" | "boardSeparator";
}

/** Text is painted only where it falls within this span of columns. */
interface ColumnWindow {
  readonly from: number;
  readonly to: number;
}

function paintText(
  raster: Raster,
  text: string,
  { x, y }: { x: number; y: number },
  pixel: Pixel,
  { from, to }: ColumnWindow,
): void {
  let pen = x;
  for (const character of text) {
    const glyph = glyphFor(character);
    const width = glyph[0].length;
    if (pen + width >= from && pen <= to) {
      for (let row = 0; row < GLYPH_ROWS; row += 1) {
        for (let column = 0; column < width; column += 1) {
          const at = pen + column;
          if (glyph[row][column] === "1" && at >= from && at <= to) {
            raster.set(at, y + row, pixel);
          }
        }
      }
    }
    pen += width + 1;
  }
}

function paintRuns(
  raster: Raster,
  runs: readonly TextRun[],
  { x, y }: { x: number; y: number },
  window: ColumnWindow,
  { palette }: Stage,
): void {
  let pen = x;
  for (const { text, tone } of runs) {
    paintText(raster, text, { x: pen, y }, solid(palette[tone]), window);
    pen += textWidth(text);
  }
}

const runsWidth = (runs: readonly TextRun[]) =>
  runs.reduce((width, { text }) => width + textWidth(text), 0);

function paintBoard(raster: Raster, box: BoardBox, stage: Stage): void {
  const { view, palette } = stage;
  const { left, top, right, bottom, labelEnd } = box;
  const outline = solid(palette.outline);
  const post = solid(palette.sleeper);
  const legsFoot = Math.round(worldToBufferY(view, LEGS_FOOT_WORLD_Y));
  for (const leg of [left + LEG_INSET, right - LEG_INSET]) {
    for (let y = bottom; y <= legsFoot; y += 1) {
      raster.set(leg, y, outline);
      raster.set(leg + 1, y, post);
    }
  }
  for (let y = top + SHADOW_OFFSET; y <= bottom + SHADOW_OFFSET; y += 1) {
    for (let x = left + SHADOW_OFFSET; x <= right + SHADOW_OFFSET; x += 1) {
      raster.darken(x, y, STRUCTURE_SHADOW);
    }
  }
  const labelPanel = solid(palette.boardLabel);
  const panel = solid(palette.board);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const isEdge = x === left || x === right || y === top || y === bottom;
      raster.set(x, y, isEdge ? outline : x < labelEnd ? labelPanel : panel);
    }
  }
  if (palette.night) {
    const bulb = solid(palette.lamp);
    for (let x = left + 3; x < right; x += BULB_SPACING) {
      raster.set(x, top - 1, bulb);
    }
  }
}

export interface Billboard {
  /** Paints nothing at compact widths, where the HTML line shows instead. */
  paint(raster: Raster, stage: Stage, textTime: number): void;
}

export function createBillboard(nowItems: readonly NowItem[]): Billboard {
  const items = nowItems.map(({ label, value }) => ({
    key: toBoardText(label),
    value: toBoardText(value),
  }));
  const runsOf = ({
    key,
    value,
  }: {
    key: string;
    value: string;
  }): TextRun[] => [
    { text: `${key} `, tone: "boardKey" },
    { text: value, tone: "boardValue" },
  ];
  const stillRuns = items.flatMap(runsOf);
  const rollingRuns = items.flatMap((item): TextRun[] => [
    ...runsOf(item),
    { text: SEPARATOR, tone: "boardSeparator" },
  ]);
  const stillWidth = runsWidth(stillRuns);
  const loopWidth = runsWidth(rollingRuns);

  const labelWidth = textWidth(LABEL) + LABEL_PADDING;
  const keyColumn = Math.max(0, ...items.map(({ key }) => textWidth(key)));
  const valueColumn = Math.max(
    0,
    ...items.map(({ value }) => textWidth(value)),
  );
  const fullWidth =
    labelWidth + TEXT_GAP + keyColumn + COLUMN_GAP + valueColumn + TEXT_GAP;

  function boxFor({ view }: Stage): BoardBox {
    const usable = view.bufferWidth - 2 * CANVAS_MARGIN - SHADOW_OFFSET;
    const width = Math.min(fullWidth, usable);
    const centred =
      Math.round(worldToBufferX(view, CENTRE_WORLD_X)) - (width >> 1);
    const left = Math.max(
      CANVAS_MARGIN,
      Math.min(centred, CANVAS_MARGIN + usable - width),
    );
    const top = Math.round(worldToBufferY(view, TOP_WORLD_Y));
    return {
      left,
      top,
      right: left + width,
      bottom: top + BOARD_HEIGHT,
      labelEnd: left + labelWidth,
      textStart: left + labelWidth + TEXT_GAP,
    };
  }

  function paintContent(
    raster: Raster,
    box: BoardBox,
    stage: Stage,
    textTime: number,
  ): void {
    const { left, top, right, bottom, labelEnd, textStart } = box;
    const y = Math.round((top + bottom) / 2 - 3);
    paintText(
      raster,
      LABEL,
      { x: Math.round((left + labelEnd) / 2 - textWidth(LABEL) / 2), y },
      solid(stage.palette.boardLabelInk),
      { from: left + 1, to: labelEnd - 1 },
    );

    const end = right - 2;
    const window = { from: textStart, to: end };
    if (items.length === 1 && stillWidth <= end - textStart) {
      paintRuns(raster, stillRuns, { x: textStart, y }, window, stage);
      return;
    }
    const offset = Math.floor(textTime * ROLL_PIXELS_PER_SECOND) % loopWidth;
    for (let x = textStart - offset; x < end; x += loopWidth) {
      paintRuns(raster, rollingRuns, { x, y }, window, stage);
    }
  }

  return {
    paint(raster, stage, textTime) {
      if (stage.view.compact || items.length === 0) return;
      const box = boxFor(stage);
      paintBoard(raster, box, stage);
      paintContent(raster, box, stage, textTime);
    },
  };
}
