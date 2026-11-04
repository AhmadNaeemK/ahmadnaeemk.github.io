/** The map's fixed parts: grid, track, stations and bridge. */
import { TAU } from "../../rail";
import type { DrawnSegment, Platform, Station } from "../../rail";
import {
  BRIDGE_BED_WIDTH,
  BRIDGE_CASING_WIDTH,
  BRIDGE_DECK_WIDTH,
  BRIDGE_GRADIENT_X,
  LETTER_WIDTH,
  TUNNEL_CONTROL_REACH,
  TUNNEL_DASH,
  TUNNEL_WIDTH,
} from "./map-view";
import type { Paint } from "./scene-tokens";

const GRID_STEP = 24;
const GRID_X_END = 720;
const GRID_Y_START = -12;
const GRID_Y_END = 228;
const GRID_DOT_RADIUS = 0.9;
const PLATFORM_RADIUS = 3;
const PORTAL_RADIUS = 8.5;
const STATION_MARK_OFFSET = 9.5;
const STATION_MARK_RADIUS = 2.6;

function tracePath(ctx: CanvasRenderingContext2D, segment: DrawnSegment): void {
  if (segment.type === "line") {
    ctx.moveTo(segment.x0, segment.y0);
    ctx.lineTo(segment.x1, segment.y1);
    return;
  }
  const { cx, cy, r, t0, t1 } = segment;
  ctx.moveTo(cx + r * Math.cos(t0), cy + r * Math.sin(t0));
  ctx.arc(cx, cy, r, t0, t1, t1 < t0);
}

export function drawGrid({ ctx, tokens }: Paint): void {
  ctx.fillStyle = tokens.rule;
  for (let x = 0; x <= GRID_X_END; x += GRID_STEP) {
    for (let y = GRID_Y_START; y <= GRID_Y_END; y += GRID_STEP) {
      ctx.beginPath();
      ctx.arc(x, y, GRID_DOT_RADIUS, 0, TAU);
      ctx.fill();
    }
  }
}

export function drawUnderground({ ctx, world, tokens }: Paint): void {
  ctx.save();
  ctx.setLineDash(TUNNEL_DASH);
  ctx.lineWidth = TUNNEL_WIDTH;
  ctx.strokeStyle = tokens.trackUnder;
  for (const { from, to } of world.tunnels) {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.bezierCurveTo(
      from.x + from.dx * TUNNEL_CONTROL_REACH,
      from.y + from.dy * TUNNEL_CONTROL_REACH,
      to.x - to.dx * TUNNEL_CONTROL_REACH,
      to.y - to.dy * TUNNEL_CONTROL_REACH,
      to.x,
      to.y,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function tracePlatform(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  offset = { x: 0, y: 0 },
): void {
  ctx.beginPath();
  if (platform.type === "rect") {
    ctx.roundRect(
      platform.x + offset.x,
      platform.y + offset.y,
      platform.w,
      platform.h,
      PLATFORM_RADIUS,
    );
  } else {
    ctx.arc(platform.cx + offset.x, platform.cy + offset.y, platform.r, 0, TAU);
  }
}

/** A marigold line along the platform's edge: the top when raised, otherwise the side. */
function tracePlatformEdge(
  ctx: CanvasRenderingContext2D,
  { platform, elevated }: Station,
): void {
  ctx.beginPath();
  if (platform.type === "circle") {
    ctx.arc(platform.cx, platform.cy, platform.r - 2, 0, TAU);
    return;
  }
  const { x, y, w, h } = platform;
  if (elevated) {
    ctx.moveTo(x + 3, y + 1.8);
    ctx.lineTo(x + w - 3, y + 1.8);
  } else {
    ctx.moveTo(x + w - 1.8, y + 3);
    ctx.lineTo(x + w - 1.8, y + h - 3);
  }
}

export function drawPlatforms(
  { ctx, tokens }: Paint,
  stations: readonly Station[],
): void {
  for (const station of stations) {
    if (station.elevated) {
      ctx.fillStyle = tokens.shadow;
      tracePlatform(ctx, station.platform, { x: 2, y: 3 });
      ctx.fill();
    }
    ctx.fillStyle = tokens.platform;
    ctx.strokeStyle = tokens.ink;
    ctx.lineWidth = 1.4;
    tracePlatform(ctx, station.platform);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = tokens.marigold;
    ctx.lineWidth = 1.6;
    tracePlatformEdge(ctx, station);
    ctx.stroke();
  }
}

export function drawLetters({ ctx, world, tokens }: Paint): void {
  ctx.lineWidth = LETTER_WIDTH;
  world.letters.forEach(({ parts }, index) => {
    ctx.strokeStyle = tokens.lines[index];
    ctx.beginPath();
    for (const part of parts) tracePath(ctx, part);
    ctx.stroke();
  });
}

/** A small arch over each track end, opening towards the tunnel. */
export function drawPortals({ ctx, world, tokens }: Paint): void {
  ctx.strokeStyle = tokens.ink;
  ctx.lineWidth = 2.6;
  for (const { x, y, dx, dy } of world.portals) {
    const facing = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      PORTAL_RADIUS,
      facing - Math.PI / 2,
      facing + Math.PI / 2,
      true,
    );
    ctx.stroke();
  }
}

export function drawBridge({ ctx, world, tokens }: Paint): void {
  const trace = () => {
    ctx.beginPath();
    for (const segment of world.bridge) tracePath(ctx, segment);
  };
  ctx.lineCap = "round";

  ctx.save();
  ctx.translate(3, 6);
  ctx.strokeStyle = tokens.shadow;
  ctx.lineWidth = 15;
  ctx.filter = "blur(2px)";
  trace();
  ctx.stroke();
  ctx.restore();

  const deck = ctx.createLinearGradient(
    BRIDGE_GRADIENT_X.from,
    0,
    BRIDGE_GRADIENT_X.to,
    0,
  );
  deck.addColorStop(0, tokens.tomato);
  deck.addColorStop(1, tokens.cobalt);
  trace();
  ctx.strokeStyle = tokens.ink;
  ctx.lineWidth = BRIDGE_CASING_WIDTH;
  ctx.stroke();
  ctx.strokeStyle = tokens.bg;
  ctx.lineWidth = BRIDGE_BED_WIDTH;
  ctx.stroke();
  ctx.strokeStyle = deck;
  ctx.lineWidth = BRIDGE_DECK_WIDTH;
  ctx.stroke();
}

/** Each mark sits beside the middle of a stopped train. */
export function drawStationMarks({ ctx, world, tokens }: Paint): void {
  ctx.fillStyle = tokens.surface;
  ctx.strokeStyle = tokens.ink;
  ctx.lineWidth = 2.4;
  for (const station of world.stations) {
    const point = world.pointAt(station.s - world.trainLength / 2);
    if (!point) continue;
    const normalX = -Math.sin(point.a);
    const normalY = Math.cos(point.a);
    const towardsPlatform =
      (station.cx - point.x) * normalX + (station.cy - point.y) * normalY >= 0
        ? 1
        : -1;
    const offset = towardsPlatform * STATION_MARK_OFFSET;
    ctx.beginPath();
    ctx.arc(
      point.x + normalX * offset,
      point.y + normalY * offset,
      STATION_MARK_RADIUS,
      0,
      TAU,
    );
    ctx.fill();
    ctx.stroke();
  }
}
