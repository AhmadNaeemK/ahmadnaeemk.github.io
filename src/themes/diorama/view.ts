/**
 * The diorama's gentle oblique view: the ground is squashed by `GROUND_SQUASH` and
 * height lifts things straight up the screen.
 */
import type { DrawnSegment, WorldPoint } from "../../rail";

export const GROUND_SQUASH = 0.7;
export const VIEW_X0 = -50;
export const VIEW_WIDTH = 820;
/** A compact view drops the billboard's strip of sky. Reserved in theme.css too. */
export const FULL_VIEW = { y0: -84, height: 282 } as const;
export const COMPACT_VIEW = { y0: -64, height: 262 } as const;

/** Heights above the ground that the track, platforms and people all agree on. */
export const GROUND_PLATFORM_HEIGHT = 3;
export const BRIDGE_HEIGHT = 16;
/** Level with the deck its trains stop on. */
export const ELEVATED_PLATFORM_HEIGHT = BRIDGE_HEIGHT;
export const ARCH_HEIGHT = 13;
export const SLEEPER_SPACING = 5.5;
export const SLEEPER_HALF_LENGTH = 6;
export const RAIL_OFFSETS = [-3.4, 3.4] as const;

export const projectY = (y: number, z = 0) => y * GROUND_SQUASH - z;

/** Scales a hex colour's channels. Anything else comes back as it was. */
export function shade(color: string, factor: number): string {
  if (!color.startsWith("#")) return color;
  const channels = parseInt(color.slice(1), 16);
  const scaled = (channel: number) =>
    Math.trunc(Math.min(255, (channel & 255) * factor));
  return `rgb(${scaled(channels >> 16)},${scaled(channels >> 8)},${scaled(channels)})`;
}

/** The decoration's own generator, so the scenery never depends on the world's. */
export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/** Adds a segment to the path, `offset` to its left. For the squashed ground. */
export function traceSegment(
  ctx: CanvasRenderingContext2D,
  segment: DrawnSegment,
  offset = 0,
): void {
  if (segment.type === "line") {
    const normalX = -(segment.y1 - segment.y0) / segment.len;
    const normalY = (segment.x1 - segment.x0) / segment.len;
    ctx.moveTo(segment.x0 + normalX * offset, segment.y0 + normalY * offset);
    ctx.lineTo(segment.x1 + normalX * offset, segment.y1 + normalY * offset);
    return;
  }
  const radius = segment.r + offset;
  ctx.moveTo(
    segment.cx + radius * Math.cos(segment.t0),
    segment.cy + radius * Math.sin(segment.t0),
  );
  ctx.arc(
    segment.cx,
    segment.cy,
    radius,
    segment.t0,
    segment.t1,
    segment.t1 < segment.t0,
  );
}

const ARCH_HALF_WIDTH = 7.5;

/** Adds a tunnel mouth's outline to the current path. */
export function traceArch(
  ctx: CanvasRenderingContext2D,
  { x, y }: WorldPoint,
  counterWound = false,
): void {
  const base = projectY(y) + 0.5;
  const springing = base - ARCH_HEIGHT + ARCH_HALF_WIDTH;
  const start = counterWound ? ARCH_HALF_WIDTH : -ARCH_HALF_WIDTH;
  ctx.moveTo(x + start, base);
  ctx.lineTo(x + start, springing);
  ctx.arc(
    x,
    springing,
    ARCH_HALF_WIDTH,
    counterWound ? 0 : Math.PI,
    counterWound ? Math.PI : 0,
    counterWound,
  );
  ctx.lineTo(x - start, base);
  ctx.closePath();
}
