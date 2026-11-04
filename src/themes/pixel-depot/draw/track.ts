/** The track that spells the name, and the raised stretch of it on the stone bridge. */
import type { DrawnSegment } from "../../../rail";
import {
  BRIDGE_SHADOW,
  noiseAt,
  Raster,
  shaded,
  solid,
  type Pixel,
} from "./raster";
import { worldToBufferX, worldToBufferY, type Stage, type View } from "./stage";

interface TrackPoint {
  readonly x: number;
  readonly y: number;
  readonly normalX: number;
  readonly normalY: number;
}

const SAMPLE_STEP = 0.4;
const THICKNESS_STEP = 0.5;

const ballastHalfWidth = ({ scale }: View) => Math.max(2.5, 7.5 * scale);

function pointsAlong(
  segments: readonly DrawnSegment[],
  view: View,
): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (const segment of segments) {
    const count = Math.ceil((segment.len * view.scale) / SAMPLE_STEP);
    for (let i = 0; i <= count; i += 1) {
      const { x, y, a } = segment.at((segment.len * i) / count);
      points.push({
        x: worldToBufferX(view, x),
        y: worldToBufferY(view, y),
        normalX: -Math.sin(a),
        normalY: Math.cos(a),
      });
    }
  }
  return points;
}

/** Calls `paint` for each pixel of a band straight across the track at each point. */
function forEachAcross(
  points: readonly TrackPoint[],
  halfWidth: number,
  paint: (x: number, y: number) => void,
): void {
  for (const { x, y, normalX, normalY } of points) {
    for (let t = -halfWidth; t <= halfWidth; t += THICKNESS_STEP) {
      paint(Math.round(x + normalX * t), Math.round(y + normalY * t));
    }
  }
}

function paintBallast(
  raster: Raster,
  points: readonly TrackPoint[],
  view: View,
  { stone, stoneSpeck }: { stone: Pixel; stoneSpeck: Pixel },
): void {
  forEachAcross(points, ballastHalfWidth(view), (x, y) =>
    raster.set(x, y, noiseAt(x, y) < 0.3 ? stoneSpeck : stone),
  );
}

function paintSleepersAndRails(
  raster: Raster,
  points: readonly TrackPoint[],
  { view, palette }: Stage,
): void {
  const halfLength = Math.max(2, 6 * view.scale);
  const spacing = Math.max(2.5, 5.5 * view.scale);
  const sleeper = solid(palette.sleeper);
  let sinceLast = 0;
  for (const { x, y, normalX, normalY } of points) {
    sinceLast += SAMPLE_STEP;
    if (sinceLast < spacing) continue;
    sinceLast = 0;
    for (let t = -halfLength; t <= halfLength; t += THICKNESS_STEP) {
      raster.set(
        Math.round(x + normalX * t),
        Math.round(y + normalY * t),
        sleeper,
      );
    }
  }

  const gauge = Math.max(1.5, 3.4 * view.scale);
  const rail = solid(palette.rail);
  for (const { x, y, normalX, normalY } of points) {
    raster.set(
      Math.round(x + normalX * gauge),
      Math.round(y + normalY * gauge),
      rail,
    );
    raster.set(
      Math.round(x - normalX * gauge),
      Math.round(y - normalY * gauge),
      rail,
    );
  }
}

export function paintGroundTrack(raster: Raster, stage: Stage): void {
  const { world, view, palette } = stage;
  const points = pointsAlong(
    world.letters.flatMap(({ parts }) => parts),
    view,
  );
  // A worn dirt shoulder makes the letters read from a distance.
  const shoulder = solid(palette.shoulder);
  forEachAcross(points, ballastHalfWidth(view) + 1.5, (x, y) => {
    if (noiseAt(x, y) > 0.25) raster.set(x, y, shoulder);
  });
  paintBallast(raster, points, view, {
    stone: solid(palette.ballast),
    stoneSpeck: solid(palette.ballastDark),
  });
  paintSleepersAndRails(raster, points, stage);
}

export function paintBridge(raster: Raster, stage: Stage): void {
  const { world, view, palette } = stage;
  const points = pointsAlong(world.bridge, view);
  const halfWidth = ballastHalfWidth(view);

  // Pixels repeat along the curve, and each may darken the ground only once.
  const alreadyShaded = new Set<number>();
  forEachAcross(
    points.map((point) => ({ ...point, x: point.x + 2, y: point.y + 4 })),
    halfWidth + 1.5,
    (x, y) => {
      const key = y * raster.width + x;
      if (alreadyShaded.has(key)) return;
      alreadyShaded.add(key);
      raster.darken(x, y, BRIDGE_SHADOW);
    },
  );

  paintBallast(raster, points, view, {
    stone: shaded(palette.stone, 1.05),
    stoneSpeck: solid(palette.stone),
  });
  const parapet = solid(palette.stoneDark);
  for (const { x, y, normalX, normalY } of points) {
    for (const t of [
      -halfWidth - 1.5,
      -halfWidth - 0.5,
      halfWidth + 0.5,
      halfWidth + 1.5,
    ]) {
      raster.set(
        Math.round(x + normalX * t),
        Math.round(y + normalY * t),
        parapet,
      );
    }
  }
  paintSleepersAndRails(raster, points, stage);

  const coping = solid(palette.stone);
  for (const segment of world.bridge) {
    const count = Math.ceil((segment.len * view.scale) / 4);
    for (let i = 0; i <= count; i += 1) {
      const { x, y, a } = segment.at((segment.len * i) / count);
      raster.set(
        worldToBufferX(view, x) - Math.sin(a) * (halfWidth + 1),
        worldToBufferY(view, y) + Math.cos(a) * (halfWidth + 1),
        coping,
      );
    }
  }
}
