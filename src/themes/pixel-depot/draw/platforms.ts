/** The stations' platforms: plank rectangles, and round plazas with a fountain. */
import type { Station } from "../../../rail";
import { forEachInDisc, Raster, solid, STRUCTURE_SHADOW } from "./raster";
import { worldToBufferX, worldToBufferY, type Stage } from "./stage";

function paintRectPlatform(
  raster: Raster,
  station: Station,
  platform: { x: number; y: number; w: number; h: number },
  { view, palette }: Stage,
): void {
  const left = Math.round(worldToBufferX(view, platform.x));
  const top = Math.round(worldToBufferY(view, platform.y));
  const right = Math.round(worldToBufferX(view, platform.x + platform.w));
  const bottom = Math.round(worldToBufferY(view, platform.y + platform.h));
  if (station.elevated) {
    for (let y = top + 2; y <= bottom + 3; y += 1) {
      for (let x = left + 2; x <= right + 2; x += 1) {
        raster.darken(x, y, STRUCTURE_SHADOW);
      }
    }
  }
  const seam = solid(palette.seam);
  const plank = solid(palette.plank);
  const plankDark = solid(palette.plankDark);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const isEdge = x === left || y === top || x === right || y === bottom;
      const stripe = station.elevated ? x : y;
      raster.set(x, y, isEdge ? seam : stripe % 2 ? plank : plankDark);
    }
  }
  // The yellow line runs along the side that faces the track.
  const edge = solid(palette.edge);
  if (station.elevated) {
    for (let x = left + 1; x < right; x += 1) raster.set(x, top + 1, edge);
  } else {
    for (let y = top + 1; y < bottom; y += 1) raster.set(right - 1, y, edge);
  }
}

function paintRoundPlatform(
  raster: Raster,
  platform: { cx: number; cy: number; r: number },
  { view, palette }: Stage,
): void {
  const centreX = worldToBufferX(view, platform.cx);
  const centreY = worldToBufferY(view, platform.cy);
  const radius = platform.r * view.scale;
  const stone = solid(palette.stone);
  const stoneDark = solid(palette.stoneDark);
  const edge = solid(palette.edge);
  forEachInDisc(centreX, centreY, radius, (x, y, distance) => {
    const paving = (x + y) % 4 < 2 ? stone : stoneDark;
    raster.set(
      x,
      y,
      distance > radius - 1 ? stoneDark : distance > radius - 2 ? edge : paving,
    );
  });
  const water = solid(palette.water);
  const fountainRim = 3.2 * view.scale * 2;
  forEachInDisc(
    centreX,
    centreY,
    Math.max(2, 4.5 * view.scale * 2),
    (x, y, distance) => {
      raster.set(x, y, distance > fountainRim ? stoneDark : water);
    },
  );
  raster.set(centreX, centreY - 1, solid(palette.waterLight));
}

export function paintPlatforms(raster: Raster, stage: Stage): void {
  for (const station of stage.world.stations) {
    const { platform } = station;
    if (platform.type === "rect") {
      paintRectPlatform(raster, station, platform, stage);
    } else {
      paintRoundPlatform(raster, platform, stage);
    }
  }
}
