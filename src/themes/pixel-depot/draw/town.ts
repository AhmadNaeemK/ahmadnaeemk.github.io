/** The still part of the scene, painted once per size and colour scheme. */
import { paintPlatforms } from "./platforms";
import {
  forEachInDisc,
  noiseAt,
  Raster,
  shaded,
  solid,
  STRUCTURE_SHADOW,
  TREE_AND_CAR_SHADOW,
} from "./raster";
import { worldToBufferX, worldToBufferY, type Stage } from "./stage";
import { paintBridge, paintGroundTrack } from "./track";
import { paintTunnelMounds } from "./tunnel-mounds";

const TREES: readonly (readonly [x: number, y: number])[] = [
  [188, 52],
  [236, 78],
  [340, 36],
  [462, 72],
  [516, 42],
  [552, 84],
  [640, 52],
  [684, 86],
  [-12, 120],
  [-10, 196],
  [745, 150],
  [742, 208],
  [-8, 30],
  [748, 40],
  [190, 228],
  [322, 232],
  [410, 228],
  [500, 230],
  [652, 230],
];
/** From this tree on they are the small ones along the bottom and the edges. */
const FIRST_SMALL_TREE = 14;

const HOUSES = [
  { x: 298, y: 66, width: 26, height: 16, roof: 0 },
  { x: 404, y: 58, width: 20, height: 14, roof: 1 },
  { x: 600, y: 64, width: 22, height: 15, roof: 2 },
] as const;

/** In world units, so night glows can find them too. */
export const LAMPS: readonly (readonly [x: number, y: number])[] = [
  [107, 46],
  [106, 140],
  [480, 22],
  [690, 100],
];

const POND = { x: 50, y: 152, radius: 23 };
const FLOWER_COUNT = 140;

function paintGround(raster: Raster, { view, palette }: Stage): void {
  const grass = solid(palette.grass);
  const grassDark = solid(palette.grassDark);
  const grassLight = solid(palette.grassLight);
  const { bufferWidth, bufferHeight } = view;
  for (let y = 0; y < bufferHeight; y += 1) {
    for (let x = 0; x < bufferWidth; x += 1) {
      const fine = noiseAt(x, y);
      const patch = noiseAt((x / 9) | 0, (y / 7) | 0);
      raster.set(
        x,
        y,
        fine < 0.07
          ? grassDark
          : fine > 0.955
            ? grassLight
            : patch < 0.18
              ? grassDark
              : grass,
      );
    }
  }
  for (let i = 0; i < FLOWER_COUNT; i += 1) {
    raster.set(
      noiseAt(i, 7) * bufferWidth,
      noiseAt(i, 13) * bufferHeight,
      solid(palette.flowers[i % palette.flowers.length]),
    );
  }
}

/** The pond sits inside the first letter a. */
function paintPond(raster: Raster, { view, palette }: Stage): void {
  const centreX = worldToBufferX(view, POND.x);
  const centreY = worldToBufferY(view, POND.y);
  const radius = POND.radius * view.scale;
  const rim = solid(palette.stoneDark);
  const water = solid(palette.water);
  const ripple = solid(palette.waterLight);
  forEachInDisc(centreX, centreY, radius + 1, (x, y, distance) => {
    raster.set(
      x,
      y,
      distance > radius ? rim : noiseAt(x, y) < 0.06 ? ripple : water,
    );
  });
  for (let k = 0; k < 5; k += 1) {
    raster.set(centreX - 4 + k, centreY - 3, ripple);
  }
}

function paintHouses(raster: Raster, { view, palette }: Stage): void {
  const outline = solid(palette.outline);
  for (const { x, y, width, height, roof } of HOUSES) {
    const left = Math.round(worldToBufferX(view, x - width / 2));
    const top = Math.round(worldToBufferY(view, y - height / 2));
    const right = Math.round(worldToBufferX(view, x + width / 2));
    const bottom = Math.round(worldToBufferY(view, y + height / 2));
    for (let row = top + 2; row <= bottom + 2; row += 1) {
      for (let column = left + 2; column <= right + 2; column += 1) {
        raster.darken(column, row, STRUCTURE_SHADOW);
      }
    }
    const roofColour = palette.roofs[roof];
    const ridge = shaded(roofColour, 1.25);
    const sunnySlope = shaded(roofColour, 1.08);
    const shadySlope = shaded(roofColour, 0.82);
    const ridgeRow = (top + bottom) >> 1;
    for (let row = top; row <= bottom; row += 1) {
      for (let column = left; column <= right; column += 1) {
        const isEdge =
          column === left || column === right || row === top || row === bottom;
        raster.set(
          column,
          row,
          isEdge
            ? outline
            : row === ridgeRow
              ? ridge
              : row < ridgeRow
                ? sunnySlope
                : shadySlope,
        );
      }
    }
    // The chimney.
    raster.set(right - 3, top + 1, outline);
    raster.set(right - 3, top + 2, outline);
    raster.set(right - 4, top + 1, outline);
    if (palette.night) {
      const lit = solid(palette.lamp);
      raster.set(left + 2, bottom + 1, lit);
      raster.set(right - 2, bottom + 1, lit);
    }
  }
}

function paintTrees(raster: Raster, { view, palette }: Stage): void {
  const outline = solid(palette.outline);
  TREES.forEach(([x, y], index) => {
    const worldRadius = index >= FIRST_SMALL_TREE ? 6 : 9 + (index % 3) * 1.5;
    const centreX = worldToBufferX(view, x);
    const centreY = worldToBufferY(view, y);
    const radius = Math.max(3, worldRadius * view.scale);
    const colour = palette.trees[index % palette.trees.length];
    const leaves = solid(colour);
    const shade = shaded(colour, 0.78);
    const light = shaded(colour, 1.18);
    forEachInDisc(centreX + 2, centreY + 2, radius, (column, row) =>
      raster.darken(column, row, TREE_AND_CAR_SHADOW),
    );
    forEachInDisc(centreX, centreY, radius, (column, row, distance) => {
      const across = column + 0.5 - centreX + (row + 0.5 - centreY);
      raster.set(
        column,
        row,
        distance > radius - 1
          ? outline
          : across > radius * 0.5
            ? shade
            : across < -radius * 0.6
              ? light
              : leaves,
      );
    });
  });
}

function paintLamps(raster: Raster, { view, palette }: Stage): void {
  const post = solid(palette.outline);
  const light = solid(palette.lamp);
  for (const [x, y] of LAMPS) {
    const column = worldToBufferX(view, x);
    const row = worldToBufferY(view, y);
    raster.set(column, row, post);
    raster.set(column, row - 1, light);
  }
}

export function paintTown(raster: Raster, stage: Stage): void {
  paintGround(raster, stage);
  paintPond(raster, stage);
  paintGroundTrack(raster, stage);
  paintPlatforms(raster, stage);
  paintBridge(raster, stage);
  paintHouses(raster, stage);
  paintTrees(raster, stage);
  paintLamps(raster, stage);
  paintTunnelMounds(raster, stage);
}
