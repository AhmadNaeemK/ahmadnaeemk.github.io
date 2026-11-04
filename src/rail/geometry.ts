/** Track pieces. World units: baseline y=200, x-height y=100, ascender y=0. */
import type {
  ArcSegment,
  LineSegment,
  PortalClip,
  Sample,
  SegmentKind,
  SegmentPoint,
  TunnelEnd,
  TunnelSegment,
} from "./types";

export const TAU = Math.PI * 2;

/** How far the track runs past a portal before it is fully hidden. */
const UNDER = 36;
/** Distance spent fully underground. */
const HIDDEN = 50;
const DEFAULT_SAMPLE_STEP = 2;
const MIN_SAMPLE_INTERVALS = 2;

/** A point near a portal, with the portal its car is clipped against. */
interface PortalPoint extends SegmentPoint {
  readonly portal: PortalClip;
}

export interface PortalTunnel extends TunnelSegment {
  at(d: number): PortalPoint | null;
}

export function line(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  kind: SegmentKind = "track",
): LineSegment {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const a = Math.atan2(dy, dx);
  return {
    type: "line",
    kind,
    x0,
    y0,
    x1,
    y1,
    len,
    at(d) {
      const t = d / len;
      return { x: x0 + dx * t, y: y0 + dy * t, a };
    },
  };
}

export function arc(
  cx: number,
  cy: number,
  r: number,
  t0: number,
  t1: number,
  kind: SegmentKind = "track",
): ArcSegment {
  const direction = Math.sign(t1 - t0);
  return {
    type: "arc",
    kind,
    cx,
    cy,
    r,
    t0,
    t1,
    len: Math.abs(t1 - t0) * r,
    at(d) {
      const theta = t0 + (direction * d) / r;
      return {
        x: cx + r * Math.cos(theta),
        y: cy + r * Math.sin(theta),
        a: Math.atan2(
          Math.cos(theta) * direction,
          -Math.sin(theta) * direction,
        ),
      };
    },
  };
}

export function tunnel(from: TunnelEnd, to: TunnelEnd): PortalTunnel {
  const len = UNDER * 2 + HIDDEN;
  const entry: PortalClip = {
    x: from.x,
    y: from.y,
    nx: -from.dx,
    ny: -from.dy,
  };
  const exit: PortalClip = { x: to.x, y: to.y, nx: to.dx, ny: to.dy };
  return {
    type: "tunnel",
    kind: "tunnel",
    len,
    from,
    to,
    at(d) {
      if (d < UNDER) {
        return {
          x: from.x + from.dx * d,
          y: from.y + from.dy * d,
          a: Math.atan2(from.dy, from.dx),
          portal: entry,
        };
      }
      if (d > UNDER + HIDDEN) {
        const remaining = len - d;
        return {
          x: to.x - to.dx * remaining,
          y: to.y - to.dy * remaining,
          a: Math.atan2(to.dy, to.dx),
          portal: exit,
        };
      }
      return null;
    },
  };
}

export const sample: Sample = (segment, step) => {
  // `||`, not a default parameter: a step of 0 would otherwise ask for an
  // endless array.
  const intervals = Math.max(
    MIN_SAMPLE_INTERVALS,
    Math.ceil(segment.len / (step || DEFAULT_SAMPLE_STEP)),
  );
  return Array.from({ length: intervals + 1 }, (_, i) => ({
    ...segment.at((segment.len * i) / intervals),
    seg: segment,
  }));
};
