/** The "Right now" billboard behind the bridge, where there is room for it. */
import { marqueeSegments, TAU } from "../../rail";
import type { MarqueeSegment } from "../../rail";
import type { NowItem } from "../../scene/contract";
import type { Lighting, Palette } from "./palette";
import { projectY, shade } from "./view";

const LABEL = "RIGHT NOW";
const BOARD = { centreX: 410, y: -24, clearance: 24, height: 30 } as const;
/** Keeps a long item on the board: it rolls past however wide its text is. */
const MAX_WIDTH = 680;
const ROLL_SPEED = 24;
const BULB_SPACING = 18;
/** Whitespace on both sides, so the loop's last item is spaced from its first. */
const SEPARATOR = "      ·      ";

interface BoardWidths {
  readonly label: number;
  readonly total: number;
}

interface BoardStyle {
  readonly palette: Palette;
  readonly labelFont: string;
  readonly segments: readonly MarqueeSegment[];
}

export interface Billboard {
  draw(
    ctx: CanvasRenderingContext2D,
    textTime: number,
    lighting: Lighting,
  ): void;
  /** A web font arrived, so the board's measured width is stale. */
  forgetMeasurements(): void;
}

export function createBillboard(nowItems: readonly NowItem[]): Billboard {
  const items = nowItems.map(({ label, value }) => ({
    key: label?.toUpperCase(),
    value: value.toUpperCase(),
  }));
  let widths: BoardWidths | null = null;
  /** Rebuilt only for a new palette, since a frame draws these unchanged. */
  let styled: BoardStyle | null = null;

  const fonts = (family: string) => ({
    key: `700 12px ${family}`,
    value: `800 15px ${family}`,
    label: `800 12px ${family}`,
  });

  function styleFor(palette: Palette): BoardStyle {
    const font = fonts(palette.displayFont);
    return {
      palette,
      labelFont: font.label,
      segments: items.flatMap(({ key, value }): MarqueeSegment[] => [
        ...(key
          ? [{ text: `${key}  `, font: font.key, color: palette.billboardKey }]
          : []),
        { text: value, font: font.value, color: palette.billboardValue },
        { text: SEPARATOR, font: font.key, color: palette.billboardSeparator },
      ]),
    };
  }

  function measure(ctx: CanvasRenderingContext2D, family: string): BoardWidths {
    const font = fonts(family);
    const widest = (texts: readonly string[], fontString: string) => {
      ctx.font = fontString;
      return Math.max(0, ...texts.map((text) => ctx.measureText(text).width));
    };
    const keyWidth = widest(
      items.flatMap(({ key }) => key ?? []),
      font.key,
    );
    const valueWidth = widest(
      items.map(({ value }) => value),
      font.value,
    );
    const labelWidth = widest([LABEL], font.label) + 12;
    return {
      label: labelWidth,
      total: Math.min(
        MAX_WIDTH,
        8 +
          labelWidth +
          12 +
          (keyWidth > 0 ? keyWidth + 8 : 0) +
          valueWidth +
          14,
      ),
    };
  }

  return {
    draw(ctx, textTime, { palette, night }) {
      if (items.length === 0) return;
      if (styled?.palette !== palette) styled = styleFor(palette);
      const { labelFont, segments } = styled;
      widths ??= measure(ctx, palette.displayFont);
      const { label: labelWidth, total: width } = widths;

      const { centreX, y, clearance, height } = BOARD;
      const left = centreX - width / 2;
      const top = projectY(y, clearance + height);
      const bottom = projectY(y, clearance);
      const middle = top + height / 2 + 1;
      const textLeft = left + labelWidth + 16;
      const textWidth = left + width - textLeft;

      ctx.textBaseline = "middle";
      // Posts and frame.
      ctx.fillStyle = shade(palette.trunk, night ? 0.6 : 1);
      for (const postX of [left + 30, left + width - 30]) {
        ctx.fillRect(postX - 2, bottom, 4, projectY(y) - bottom);
      }
      ctx.fillStyle = shade(palette.wood, night ? 0.7 : 1);
      ctx.beginPath();
      ctx.roundRect(left - 4, top - 4, width + 8, height + 8, 3);
      ctx.fill();
      ctx.fillStyle = palette.billboardFace;
      ctx.fillRect(left, top, width, height);
      // The label.
      ctx.fillStyle = palette.billboardPlate;
      ctx.fillRect(left + 4, top + 4, labelWidth, height - 8);
      ctx.fillStyle = palette.billboardPlateText;
      ctx.font = labelFont;
      ctx.fillText(LABEL, left + 10, middle);
      // The rolling text.
      ctx.save();
      ctx.beginPath();
      ctx.rect(textLeft - 4, top + 2, textWidth, height - 4);
      ctx.clip();
      marqueeSegments(ctx, segments, {
        x: textLeft,
        baseline: middle,
        width: textWidth,
        time: textTime,
        speed: ROLL_SPEED,
      });
      ctx.restore();
      drawBulbs(ctx, left, width, top - 6, palette, night);
    },
    forgetMeasurements() {
      widths = null;
    },
  };
}

function drawBulbs(
  ctx: CanvasRenderingContext2D,
  left: number,
  width: number,
  y: number,
  palette: Palette,
  night: boolean,
): void {
  for (let x = left + 8; x < left + width; x += BULB_SPACING) {
    ctx.fillStyle = palette.lampHead;
    ctx.beginPath();
    ctx.arc(x, y, 1.4, 0, TAU);
    ctx.fill();
    if (!night) continue;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 9);
    glow.addColorStop(0, `rgba(${palette.glowRgb},.35)`);
    glow.addColorStop(1, `rgba(${palette.glowRgb},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, TAU);
    ctx.fill();
  }
}
