/** What never moves: the board, the ground, the track and the platforms. */
import { sample, TAU } from "../../rail";
import type { Station, TunnelEnd, WorldView } from "../../rail";
import { drawBridge } from "./bridge";
import type { Lighting } from "./palette";
import {
  ELEVATED_PLATFORM_HEIGHT,
  GROUND_PLATFORM_HEIGHT,
  GROUND_SQUASH,
  projectY,
  RAIL_OFFSETS,
  seededRandom,
  shade,
  SLEEPER_HALF_LENGTH,
  SLEEPER_SPACING,
  traceArch,
  traceSegment,
} from "./view";

const BOARD = { x: -40, top: -34, bottom: 246, width: 800 } as const;

export function drawStaticLayer(
  ctx: CanvasRenderingContext2D,
  world: WorldView,
  topPortals: readonly TunnelEnd[],
  lighting: Lighting,
): void {
  drawBoardEdge(ctx, lighting);
  ctx.save();
  ctx.scale(1, GROUND_SQUASH);
  drawField(ctx, lighting);
  drawPond(ctx, lighting);
  drawGroundTrack(ctx, world, lighting);
  ctx.restore();
  ctx.fillStyle = lighting.palette.tunnelMouth;
  for (const portal of topPortals) {
    ctx.beginPath();
    traceArch(ctx, portal);
    ctx.fill();
  }
  for (const station of world.stations) {
    if (!station.elevated)
      drawPlatform(ctx, station, GROUND_PLATFORM_HEIGHT, lighting);
  }
  drawBridge(ctx, world, lighting);
  for (const station of world.stations) {
    if (station.elevated)
      drawPlatform(ctx, station, ELEVATED_PLATFORM_HEIGHT, lighting);
  }
}

function drawBoardEdge(
  ctx: CanvasRenderingContext2D,
  { palette }: Lighting,
): void {
  const edge = projectY(BOARD.bottom);
  const gradient = ctx.createLinearGradient(0, edge, 0, edge + 16);
  gradient.addColorStop(0, palette.wood);
  gradient.addColorStop(1, palette.wood2);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(BOARD.x, edge - 12, BOARD.width, 28, [0, 0, 10, 10]);
  ctx.fill();
}

function drawField(
  ctx: CanvasRenderingContext2D,
  { palette, night }: Lighting,
): void {
  const { x, top, bottom, width } = BOARD;
  const height = bottom - top;
  const random = seededRandom(5);
  const outline = () => {
    ctx.beginPath();
    ctx.roundRect(x, top, width, height, 18);
  };
  ctx.fillStyle = palette.grass;
  outline();
  ctx.fill();

  ctx.save();
  outline();
  ctx.clip();
  // Soft field patches.
  ctx.fillStyle = palette.grass2;
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 14; i += 1) {
    ctx.beginPath();
    ctx.ellipse(
      -20 + random() * 760,
      random() * 240 - 20,
      30 + random() * 50,
      14 + random() * 20,
      0,
      0,
      TAU,
    );
    ctx.fill();
  }
  // Grass tufts.
  ctx.globalAlpha = 1;
  ctx.strokeStyle = palette.grass2;
  ctx.lineWidth = 1;
  for (let i = 0; i < 700; i += 1) {
    const tuftX = -34 + random() * 788;
    const tuftY = top + 4 + random() * (height - 8);
    ctx.beginPath();
    ctx.moveTo(tuftX, tuftY);
    ctx.lineTo(tuftX + (random() - 0.5) * 2, tuftY - 3);
    ctx.stroke();
  }
  // Flowers, which fade at night.
  ctx.globalAlpha = night ? 0.35 : 0.9;
  for (let i = 0; i < 90; i += 1) {
    ctx.fillStyle = palette.flowers[i % palette.flowers.length];
    ctx.fillRect(
      -34 + random() * 788,
      top + 4 + random() * (height - 8),
      1.6,
      1.6,
    );
  }
  ctx.restore();
}

/** The pond inside the first a. */
function drawPond(
  ctx: CanvasRenderingContext2D,
  { palette, night }: Lighting,
): void {
  ctx.fillStyle = shade(palette.pond, night ? 0.6 : 1.05);
  ctx.beginPath();
  ctx.ellipse(50, 152, 24, 21, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = palette.stone;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = palette.pondGlint;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(44, 146, 10, Math.PI * 1.1, Math.PI * 1.5);
  ctx.stroke();
}

function drawGroundTrack(
  ctx: CanvasRenderingContext2D,
  world: WorldView,
  { palette }: Lighting,
): void {
  const parts = world.letters.flatMap((letter) => letter.parts);
  const strokeAll = (offset = 0) => {
    ctx.beginPath();
    for (const part of parts) traceSegment(ctx, part, offset);
    ctx.stroke();
  };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.save();
  ctx.translate(0, 2.2 / GROUND_SQUASH);
  ctx.strokeStyle = palette.ballast2;
  ctx.lineWidth = 16;
  strokeAll();
  ctx.restore();
  ctx.strokeStyle = palette.ballast;
  ctx.lineWidth = 15;
  strokeAll();

  ctx.strokeStyle = palette.sleeper;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "butt";
  for (const part of parts) {
    for (const { x, y, a } of sample(part, SLEEPER_SPACING)) {
      const normalX = -Math.sin(a) * SLEEPER_HALF_LENGTH;
      const normalY = Math.cos(a) * SLEEPER_HALF_LENGTH;
      ctx.beginPath();
      ctx.moveTo(x + normalX, y + normalY);
      ctx.lineTo(x - normalX, y - normalY);
      ctx.stroke();
    }
  }

  for (const offset of RAIL_OFFSETS) {
    ctx.strokeStyle = palette.rail;
    ctx.lineWidth = 1.5;
    strokeAll(offset);
    ctx.strokeStyle = palette.railHighlight;
    ctx.lineWidth = 0.5;
    strokeAll(offset - 0.4);
  }
}

function drawPlatform(
  ctx: CanvasRenderingContext2D,
  { id, platform }: Station,
  height: number,
  { palette }: Lighting,
): void {
  if (platform.type === "circle") {
    const { cx, cy, r } = platform;
    const centreY = projectY(cy, height);
    ctx.fillStyle = shade(palette.stone, 0.8);
    ctx.beginPath();
    ctx.ellipse(cx, centreY + 2.5, r, r * GROUND_SQUASH, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = palette.stone;
    ctx.beginPath();
    ctx.ellipse(cx, centreY, r, r * GROUND_SQUASH, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = palette.mustard;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, centreY, r - 1.5, (r - 1.5) * GROUND_SQUASH, 0, 0, TAU);
    ctx.stroke();
    return;
  }

  const { x, y, w, h } = platform;
  const backY = projectY(y, height);
  const frontY = projectY(y + h, height);
  if (height > GROUND_PLATFORM_HEIGHT) {
    // Posts down to the ground.
    ctx.fillStyle = palette.stone2;
    for (let postX = x + 6; postX < x + w; postX += 30) {
      ctx.fillRect(postX - 1.5, frontY, 3, height);
    }
  }
  ctx.fillStyle = shade(palette.stone, 0.8);
  ctx.fillRect(x, frontY, w, 3);
  ctx.fillStyle = palette.stone;
  ctx.fillRect(x, backY, w, h * GROUND_SQUASH);
  // The safety line, along the platform's track edge.
  ctx.fillStyle = palette.mustard;
  if (id === "sky") ctx.fillRect(x, backY, w, 1.2);
  else ctx.fillRect(x + w - 1.6, backY, 1.6, h * GROUND_SQUASH);
}
