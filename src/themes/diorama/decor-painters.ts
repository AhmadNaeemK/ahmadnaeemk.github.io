/** Paints the scenery and the people on the platforms. */
import { TAU } from "../../rail";
import type { Person, TunnelEnd } from "../../rail";
import type { Canopy, Decor, House, Kiosk, Lamp, Planted } from "./decor";
import type { Lighting } from "./palette";
import {
  ELEVATED_PLATFORM_HEIGHT,
  GROUND_PLATFORM_HEIGHT,
  GROUND_SQUASH,
  projectY,
  shade,
  traceArch,
} from "./view";

export function drawDecor(
  ctx: CanvasRenderingContext2D,
  decor: Decor,
  lighting: Lighting,
): void {
  switch (decor.type) {
    case "tree":
      drawTree(ctx, decor, lighting);
      break;
    case "bush":
      drawBush(ctx, decor, lighting);
      break;
    case "house":
      drawHouse(ctx, decor, lighting);
      break;
    case "lamp":
      drawLamp(ctx, decor, lighting);
      break;
    case "canopy":
      drawCanopy(ctx, decor, lighting);
      break;
    case "kiosk":
      drawKiosk(ctx, decor, lighting);
      break;
    case "hill":
      drawHill(ctx, decor.portal, false, lighting);
      break;
  }
}

function fillCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

function fillEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radii: readonly [number, number],
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, radii[0], radii[1], 0, 0, TAU);
  ctx.fill();
}

function drawTree(
  ctx: CanvasRenderingContext2D,
  { x, y, size, color, crown }: Planted,
  { palette, night }: Lighting,
): void {
  const base = projectY(y);
  const leaf = palette.trees[color];
  const dim = night ? 0.45 : 1;
  fillEllipse(ctx, x + 3, base, [7 * size, 3 * size], palette.shadow);
  ctx.fillStyle = shade(palette.trunk, night ? 0.6 : 1);
  ctx.fillRect(x - 1.2, base - 9 * size, 2.4, 9 * size);
  fillCircle(
    ctx,
    x + 1.5,
    base - 12 * size,
    7.5 * size,
    shade(leaf, 0.8 * dim),
  );
  fillCircle(ctx, x - 1.5, base - 15 * size, 6.5 * size, shade(leaf, dim));
  fillCircle(
    ctx,
    x - 2.5,
    base - 18.5 * size,
    4 * size,
    shade(palette.trees[crown], 1.1 * dim),
  );
}

function drawBush(
  ctx: CanvasRenderingContext2D,
  { x, y, size, color }: Planted,
  { palette, night }: Lighting,
): void {
  const base = projectY(y);
  const leaf = palette.trees[color];
  fillEllipse(ctx, x + 3, base, [7 * size, 3 * size], palette.shadow);
  fillEllipse(
    ctx,
    x,
    base - 3 * size,
    [7 * size, 4.5 * size],
    shade(leaf, night ? 0.45 : 0.85),
  );
  fillEllipse(
    ctx,
    x - 1.5,
    base - 4.5 * size,
    [4.5 * size, 3 * size],
    shade(leaf, night ? 0.55 : 1.05),
  );
}

function drawHouse(
  ctx: CanvasRenderingContext2D,
  { x, y, w, d, h, roof }: House,
  { palette, night }: Lighting,
): void {
  const left = x - w / 2;
  const right = x + w / 2;
  const front = y + d / 2;
  const back = y - d / 2;
  const ridge = h + 7;
  const roofColor = palette.roofs[roof];

  ctx.fillStyle = palette.shadow;
  ctx.fillRect(left + 2, projectY(front) - 1, w + 4, 3);
  ctx.fillStyle = palette.houseFront;
  ctx.fillRect(left, projectY(front, h), w, h);

  ctx.fillStyle = palette.houseSide;
  ctx.beginPath();
  ctx.moveTo(right, projectY(front));
  ctx.lineTo(right, projectY(front, h));
  ctx.lineTo(right, projectY(back, h));
  ctx.lineTo(right, projectY(back));
  ctx.closePath();
  ctx.fill();

  // Roof: front slope, then gable.
  ctx.fillStyle = shade(roofColor, night ? 0.55 : 1);
  ctx.beginPath();
  ctx.moveTo(left - 2, projectY(front + 1, h - 1));
  ctx.lineTo(right + 2, projectY(front + 1, h - 1));
  ctx.lineTo(right + 2, projectY(y, ridge));
  ctx.lineTo(left - 2, projectY(y, ridge));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(roofColor, night ? 0.42 : 0.78);
  ctx.beginPath();
  ctx.moveTo(right, projectY(front, h));
  ctx.lineTo(right, projectY(y, ridge - 1));
  ctx.lineTo(right, projectY(back, h));
  ctx.closePath();
  ctx.fill();

  // Windows and door.
  ctx.fillStyle = palette.pane;
  ctx.fillRect(left + 3, projectY(front, h - 3), 3.5, 3);
  ctx.fillRect(right - 6.5, projectY(front, h - 3), 3.5, 3);
  ctx.fillStyle = shade(roofColor, 0.7);
  ctx.fillRect(x - 1.8, projectY(front, 5.5), 3.6, 5.5);
}

function drawLamp(
  ctx: CanvasRenderingContext2D,
  { x, y }: Lamp,
  { palette }: Lighting,
): void {
  ctx.fillStyle = palette.lampPost;
  ctx.fillRect(x - 0.6, projectY(y, 14), 1.2, 14);
  fillCircle(ctx, x, projectY(y, 15), 1.8, palette.lampHead);
}

function drawCanopy(
  ctx: CanvasRenderingContext2D,
  { x, y, w, d, z, h }: Canopy,
  { palette, night }: Lighting,
): void {
  const postTop = projectY(y + d - 2, z + h);
  ctx.fillStyle = palette.canopyPost;
  ctx.fillRect(x + 2, postTop, 1.2, h);
  ctx.fillRect(x + w - 3, postTop, 1.2, h);
  ctx.fillStyle = shade(palette.brick, night ? 0.6 : 1);
  ctx.fillRect(x - 1, projectY(y, z + h + 2), w + 2, d * GROUND_SQUASH);
  ctx.fillStyle = shade(palette.brick, night ? 0.45 : 0.75);
  ctx.fillRect(x - 1, projectY(y + d, z + h + 2), w + 2, 2);
}

function drawKiosk(
  ctx: CanvasRenderingContext2D,
  { x, y }: Kiosk,
  { palette, night }: Lighting,
): void {
  ctx.fillStyle = palette.canopyPost;
  ctx.fillRect(x - 0.7, projectY(y, 14), 1.4, 11);
  fillEllipse(
    ctx,
    x,
    projectY(y, 15),
    [9, 4],
    shade(palette.mustard, night ? 0.6 : 1),
  );
  ctx.fillStyle = shade(palette.mustard, night ? 0.45 : 0.78);
  ctx.beginPath();
  ctx.ellipse(x, projectY(y, 14.4), 9, 4, 0, 0, Math.PI);
  ctx.fill();
}

const HILL_ROCKS = [
  [-9, -4, 2.4],
  [7, -7, 1.8],
  [11, 3, 2],
] as const;

/** A tunnel hill. With a mouth, the near-side portal shows through a hole in it. */
export function drawHill(
  ctx: CanvasRenderingContext2D,
  portal: TunnelEnd,
  withMouth: boolean,
  { palette, night }: Lighting,
): void {
  const { x, y } = portal;
  const centreY = withMouth ? projectY(y - 14) - 5 : projectY(y + 17) - 6;
  const gradient = ctx.createRadialGradient(
    x - 6,
    centreY - 6,
    2,
    x,
    centreY,
    24,
  );
  gradient.addColorStop(0, shade(palette.grass, 1.12));
  gradient.addColorStop(1, shade(palette.grass, 0.78));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(x, centreY, 21, withMouth ? 14.5 : 15, 0, 0, TAU);
  if (withMouth) {
    traceArch(ctx, portal, true);
    ctx.fill("evenodd");
  } else {
    ctx.fill();
  }
  const rock = shade(palette.stone, night ? 0.7 : 0.95);
  for (const [dx, dy, radius] of HILL_ROCKS) {
    fillCircle(ctx, x + dx, centreY + dy, radius, rock);
  }
  if (withMouth) {
    ctx.strokeStyle = palette.stone;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    traceArch(ctx, portal);
    ctx.stroke();
  }
}

export function drawPerson(
  ctx: CanvasRenderingContext2D,
  person: Person,
): void {
  if (person.alpha <= 0) return;
  const { x, y, color, skin, station, moving, phase } = person;
  const standing = station.elevated
    ? ELEVATED_PLATFORM_HEIGHT
    : GROUND_PLATFORM_HEIGHT;
  const bob = moving ? Math.abs(Math.sin(phase * 2)) * 0.6 : 0;
  ctx.globalAlpha = Math.min(1, person.alpha);
  ctx.fillStyle = color;
  ctx.fillRect(x - 1.2, projectY(y, standing + 3.6 + bob), 2.4, 3.6);
  fillCircle(ctx, x, projectY(y, standing + 4.8 + bob), 1.15, skin);
  ctx.globalAlpha = 1;
}

/** Warm light at night: lamps, lit houses, kiosks and the train. */
export function glowAround(
  decor: Decor,
  paintGlow: (x: number, y: number, radius: number, alpha: number) => void,
): void {
  if (decor.type === "lamp")
    paintGlow(decor.x, projectY(decor.y, 15), 22, 0.35);
  if (decor.type === "house") {
    paintGlow(decor.x, projectY(decor.y + decor.d / 2, 6), 18, 0.16);
  }
  if (decor.type === "kiosk")
    paintGlow(decor.x, projectY(decor.y, 12), 26, 0.18);
}
