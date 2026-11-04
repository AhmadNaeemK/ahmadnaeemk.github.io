/**
 * Rolling billboard text. It takes its text measurement from the canvas it is
 * given, and caches nothing, so a late font is picked up on the next frame.
 */
import type {
  Marquee,
  MarqueeOptions,
  MarqueeSegments,
  NowCycle,
} from "./types";

/** What separates one pass of a single string from the next. */
const MARQUEE_GAP = "      ";
const DEFAULT_ITEM_SECONDS = 5;
/** Share of an item's time spent fading, at each end. */
const FADE_EDGE = 0.1;

/**
 * Calls `drawPass` with the left edge of each pass that may reach the window.
 * Draws nothing unless `span` is positive, since the loop would otherwise never
 * end.
 */
function eachPass(
  span: number,
  { x, width, time, speed }: MarqueeOptions,
  drawPass: (left: number) => void,
): void {
  if (!(span > 0)) return;
  const offset = (((time * speed) % span) + span) % span;
  for (let start = -offset; start < width; start += span) {
    drawPass(x + start);
  }
}

export const marquee: Marquee = (canvas, text, options) => {
  const span =
    canvas.measureText(text).width + canvas.measureText(MARQUEE_GAP).width;
  eachPass(span, options, (left) => {
    canvas.fillText(text, left, options.baseline);
  });
};

export const marqueeSegments: MarqueeSegments = (canvas, segments, options) => {
  const widths = segments.map(({ text, font }) => {
    canvas.font = font;
    return canvas.measureText(text).width;
  });
  const span = widths.reduce((sum, width) => sum + width, 0);
  eachPass(span, options, (left) => {
    let cursor = left;
    segments.forEach(({ text, font, color }, i) => {
      canvas.font = font;
      canvas.fillStyle = color;
      canvas.fillText(text, cursor, options.baseline);
      cursor += widths[i];
    });
  });
};

export const nowCycle: NowCycle = (time, count, period) => {
  const itemCount = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1;
  const elapsed = Number.isFinite(time) ? Math.max(0, time) : 0;
  const phase = elapsed / (period || DEFAULT_ITEM_SECONDS);
  const whole = Math.floor(phase);
  const fraction = phase - whole;
  return {
    index: ((whole % itemCount) + itemCount) % itemCount,
    alpha: itemCount > 1 ? fadeAt(fraction) : 1,
  };
};

function fadeAt(fraction: number): number {
  if (fraction < FADE_EDGE) return fraction / FADE_EDGE;
  if (fraction > 1 - FADE_EDGE) return (1 - fraction) / FADE_EDGE;
  return 1;
}
