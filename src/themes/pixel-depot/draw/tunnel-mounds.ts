import { forEachInDisc, noiseAt, Raster, solid } from "./raster";
import { worldToBufferX, worldToBufferY, type Stage } from "./stage";

/** A mound over each tunnel end, with its dark mouth facing the track. */
export function paintTunnelMounds(
  raster: Raster,
  { world, view, palette }: Stage,
): void {
  const outline = solid(palette.outline);
  const rock = solid(palette.stoneDark);
  const hill = solid(palette.hill);
  const hillDark = solid(palette.hillDark);
  const lintel = solid(palette.stone);
  const mouth = solid(palette.mouth);
  for (const portal of world.portals) {
    const moundX = worldToBufferX(view, portal.x + portal.dx * 14);
    const moundY = worldToBufferY(view, portal.y + portal.dy * 14);
    const moundRadius = 14 * view.scale + 1;
    const mouthX = worldToBufferX(view, portal.x);
    const mouthY = worldToBufferY(view, portal.y);
    const mouthRadius = Math.max(3, 7.5 * view.scale + 1);
    const isAhead = (x: number, y: number) =>
      (x + 0.5 - mouthX) * portal.dx + (y + 0.5 - mouthY) * portal.dy >= 0;

    forEachInDisc(moundX, moundY, moundRadius, (x, y, distance) => {
      if (!isAhead(x, y)) return;
      raster.set(
        x,
        y,
        distance > moundRadius - 1
          ? outline
          : noiseAt(x, y) < 0.25
            ? rock
            : distance > moundRadius - 2.2
              ? hillDark
              : hill,
      );
    });
    forEachInDisc(mouthX, mouthY, mouthRadius + 1, (x, y, distance) => {
      if (isAhead(x, y))
        raster.set(x, y, distance > mouthRadius ? lintel : mouth);
    });
  }
}
