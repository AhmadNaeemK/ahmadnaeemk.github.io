/** The viaduct and its deck, from the top of the h to the top of the d. */
import { sample } from "../../rail";
import type { TrackPoint, WorldView } from "../../rail";
import type { Lighting } from "./palette";
import {
  BRIDGE_HEIGHT,
  projectY,
  RAIL_OFFSETS,
  shade,
  SLEEPER_HALF_LENGTH,
  SLEEPER_SPACING,
} from "./view";

/** The viaduct wall's footprint, along y = 7 under the straight span. */
const VIADUCT = { x0: 160, x1: 700, y: 7 } as const;
/** Arch holes through the wall: the first centre, where they stop, and their shape. */
const VIADUCT_ARCHES = {
  firstX: 190,
  endX: 690,
  spacing: 50,
  halfWidth: 17,
  springingHeight: 9,
} as const;

type RaisedPoint = TrackPoint & { readonly z: number };

function bridgePoints(world: WorldView, step: number): RaisedPoint[] {
  return world.bridge.flatMap((segment) =>
    sample(segment, step).map((point) => ({
      ...point,
      z: world.elevationAt(point),
    })),
  );
}

function tracePolyline(
  ctx: CanvasRenderingContext2D,
  points: readonly (readonly [x: number, y: number])[],
): void {
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
}

export function drawBridge(
  ctx: CanvasRenderingContext2D,
  world: WorldView,
  lighting: Lighting,
): void {
  const points = bridgePoints(world, 2);
  drawViaductWall(ctx, points, lighting);
  drawDeck(ctx, world, points, lighting);
}

/** The wall under the straight span, with arches cut through it. */
function drawViaductWall(
  ctx: CanvasRenderingContext2D,
  points: readonly RaisedPoint[],
  { palette }: Lighting,
): void {
  const { x0, x1, y } = VIADUCT;
  const groundY = projectY(y);
  ctx.fillStyle = palette.stone2;
  ctx.beginPath();
  ctx.moveTo(x0, groundY);
  for (const point of points) {
    if (point.seg.type === "line") ctx.lineTo(point.x, projectY(y, point.z));
  }
  ctx.lineTo(x1, groundY);
  ctx.closePath();
  const { firstX, endX, spacing, halfWidth, springingHeight } = VIADUCT_ARCHES;
  const archTop = projectY(y, springingHeight);
  for (let archX = firstX; archX < endX; archX += spacing) {
    ctx.moveTo(archX + halfWidth, groundY);
    ctx.lineTo(archX + halfWidth, archTop + halfWidth * 0.5);
    ctx.ellipse(
      archX,
      archTop + halfWidth * 0.5,
      halfWidth,
      halfWidth * 0.5,
      0,
      0,
      Math.PI,
      true,
    );
    ctx.lineTo(archX - halfWidth, groundY);
    ctx.closePath();
  }
  ctx.fill("evenodd");

  ctx.strokeStyle = shade(palette.stone2, 0.82);
  ctx.lineWidth = 0.6;
  for (let z = 3; z < BRIDGE_HEIGHT; z += 3.2) {
    ctx.beginPath();
    ctx.moveTo(x0, projectY(y, z));
    ctx.lineTo(x1, projectY(y, z));
    ctx.stroke();
  }
}

/** The deck's face and surface, its sleepers and rails, and the parapet. */
function drawDeck(
  ctx: CanvasRenderingContext2D,
  world: WorldView,
  points: readonly RaisedPoint[],
  { palette }: Lighting,
): void {
  const edges = points.map(({ x, y, a, z }) => {
    const left = { x: x - Math.sin(a) * 8, y: y + Math.cos(a) * 8, z };
    const right = { x: x + Math.sin(a) * 8, y: y - Math.cos(a) * 8, z };
    return left.y > right.y
      ? { front: left, back: right }
      : { front: right, back: left };
  });
  const front = edges.map((edge) => edge.front);
  const back = edges.map((edge) => edge.back);
  const atHeight = (lift: number) =>
    front.map(({ x, y, z }) => [x, projectY(y, z + lift)] as const);

  ctx.fillStyle = shade(palette.stone2, 0.9);
  ctx.beginPath();
  tracePolyline(ctx, [...atHeight(0), ...atHeight(-3).reverse()]);
  ctx.fill();

  ctx.fillStyle = palette.ballast;
  ctx.beginPath();
  tracePolyline(ctx, [
    ...back.map(({ x, y, z }) => [x, projectY(y, z)] as const),
    ...atHeight(0).reverse(),
  ]);
  ctx.fill();

  ctx.strokeStyle = palette.sleeper;
  ctx.lineWidth = 2.2;
  for (const { x, y, a, z } of bridgePoints(world, SLEEPER_SPACING)) {
    const normalX = -Math.sin(a) * SLEEPER_HALF_LENGTH;
    const normalY = Math.cos(a) * SLEEPER_HALF_LENGTH;
    ctx.beginPath();
    ctx.moveTo(x + normalX, projectY(y + normalY, z));
    ctx.lineTo(x - normalX, projectY(y - normalY, z));
    ctx.stroke();
  }

  ctx.strokeStyle = palette.rail;
  ctx.lineWidth = 1.4;
  for (const offset of RAIL_OFFSETS) {
    ctx.beginPath();
    tracePolyline(
      ctx,
      points.map(
        ({ x, y, a, z }) =>
          [
            x - Math.sin(a) * offset,
            projectY(y + Math.cos(a) * offset, z),
          ] as const,
      ),
    );
    ctx.stroke();
  }

  ctx.strokeStyle = shade(palette.stone, 1.05);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  tracePolyline(ctx, atHeight(1.5));
  ctx.stroke();
}
