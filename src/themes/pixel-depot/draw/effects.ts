/** What the train and the lamps add over everything else: steam and night glows. */
import { forEachInDisc, Raster, rgbOf, solid, type Rgb } from "./raster";
import { worldToBufferX, worldToBufferY, type Stage } from "./stage";
import { LAMPS } from "./town";

export function paintSteam(
  raster: Raster,
  { world, view, palette }: Stage,
  flicker: number,
): void {
  const steam = solid(palette.smoke);
  for (const puff of world.puffs) {
    const age = puff.life / puff.max;
    if (age >= 0.85) continue;
    const isSolid = age < 0.45;
    forEachInDisc(
      worldToBufferX(view, puff.x),
      worldToBufferY(view, puff.y - puff.z * 0.6),
      Math.max(1, puff.r * view.scale * 1.2),
      (x, y) => {
        if (isSolid || (x + y + flicker) % 2 === 0) raster.set(x, y, steam);
      },
    );
  }
}

function paintGlow(
  raster: Raster,
  centreX: number,
  centreY: number,
  radius: number,
  added: Rgb,
): void {
  forEachInDisc(centreX, centreY, radius, (x, y, distance) => {
    if ((x + y) % 2 === 0 || distance < radius * 0.45) {
      raster.lighten(x, y, added);
    }
  });
}

export function paintNightGlows(
  raster: Raster,
  { world, view, palette }: Stage,
): void {
  const lampGlow = rgbOf(palette.lampGlow);
  const headlightGlow = rgbOf(palette.headlightGlow);
  const scaleRadius = (radius: number) => radius * view.scale * 2;
  for (const [x, y] of LAMPS) {
    paintGlow(
      raster,
      worldToBufferX(view, x),
      worldToBufferY(view, y),
      scaleRadius(9),
      lampGlow,
    );
  }
  for (const car of world.cars) {
    if (car.hidden || car.i !== 0 || car.clip) continue;
    const reach = (car.rev ? -1 : 1) * (car.len / 2 + 8);
    paintGlow(
      raster,
      worldToBufferX(view, car.x + Math.cos(car.a) * reach),
      worldToBufferY(view, car.y + Math.sin(car.a) * reach),
      scaleRadius(6),
      headlightGlow,
    );
  }
}
