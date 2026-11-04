/** What moves on top of the town: the crowd and the train, then its effects. */
import type { Car, Person } from "../../../rail";
import { paintNightGlows, paintSteam } from "./effects";
import {
  noiseAt,
  Raster,
  shaded,
  solid,
  TREE_AND_CAR_SHADOW,
  type Pixel,
} from "./raster";
import {
  bufferToWorldX,
  bufferToWorldY,
  worldToBufferX,
  worldToBufferY,
  type Stage,
} from "./stage";

const CAR_HALF_WIDTH = 5.25;
const TOY_LIVERY = "toy";
const NIGHT_DIMMING = 0.72;
/** Above this height a car runs on the bridge, and draws over the raised platform. */
const ON_BRIDGE_ABOVE = 0.5;
const WINDOWS_PER_CAR = 6;

/**
 * The loco, in world units along its length from either end. Its cab is at the back,
 * with a funnel and a dome on the boiler in front of it.
 */
const LOCO = {
  cabLength: 9,
  cabWindowFromBack: 2.5,
  cabWindowHalfLength: 1.2,
  cabLight: 1.1,
  funnelFromFront: 6,
  funnelRadius: 2.4,
  domeFromFront: 13,
  domeRadius: 1.8,
  skirtWidth: 1.6,
  /** Added so the band pattern's remainder is never negative along the loco. */
  bandOffset: 50,
  bandSpacing: 5,
  bandHalfWidth: 0.5,
  bandDimming: 0.9,
  sunnySideLight: 1.12,
} as const;

/** Everything `carPixel` would otherwise work out once per pixel. */
interface CarPaint {
  readonly stage: Stage;
  readonly isToy: boolean;
  readonly dimming: number;
  readonly outline: Pixel;
  readonly glass: Pixel;
}

function carPaintFor(stage: Stage): CarPaint {
  const { world, palette } = stage;
  const isToy = world.liveryId === TOY_LIVERY;
  return {
    stage,
    isToy,
    dimming: palette.night ? NIGHT_DIMMING : 1,
    outline: solid(palette.outline),
    glass: solid(
      !palette.night && isToy ? world.livery.colors.window : palette.glass,
    ),
  };
}

function locoPixel(car: Car, u: number, v: number, paint: CarPaint): Pixel {
  const { stage, isToy, dimming, glass } = paint;
  const { palette, world } = stage;
  const { colors } = world.livery;
  const halfLength = car.len / 2;
  if (u < -halfLength + LOCO.cabLength) {
    if (
      Math.abs(u + halfLength - LOCO.cabWindowFromBack) <
      LOCO.cabWindowHalfLength
    ) {
      return glass;
    }
    const cab = isToy ? (colors.coach2 ?? colors.body) : colors.roof;
    return shaded(cab, dimming * LOCO.cabLight);
  }
  if (
    Math.hypot(u - (halfLength - LOCO.funnelFromFront), v) < LOCO.funnelRadius
  ) {
    return shaded(isToy ? colors.trim : palette.stack, dimming);
  }
  if (Math.hypot(u - (halfLength - LOCO.domeFromFront), v) < LOCO.domeRadius) {
    return shaded(colors.trim, dimming);
  }
  if (Math.abs(v) > CAR_HALF_WIDTH - LOCO.skirtWidth) {
    return shaded(palette.skirt, dimming);
  }
  const bandPosition = (u + LOCO.bandOffset) % LOCO.bandSpacing;
  if (
    !isToy &&
    Math.abs(bandPosition - LOCO.bandSpacing / 2) < LOCO.bandHalfWidth
  ) {
    return shaded(colors.trim, dimming * LOCO.bandDimming);
  }
  return shaded(colors.body, dimming * (v < 0 ? LOCO.sunnySideLight : 1));
}

function tenderPixel(car: Car, u: number, v: number, paint: CarPaint): Pixel {
  const { palette, world } = paint.stage;
  if (Math.abs(u) < car.len / 2 - 2 && Math.abs(v) < CAR_HALF_WIDTH - 2) {
    return noiseAt((u * 3) | 0, (v * 3) | 0) < 0.2
      ? solid(palette.coalLump)
      : solid(palette.coal);
  }
  return shaded(world.livery.colors.body, paint.dimming);
}

function coachColour(car: Car, { stage, isToy }: CarPaint): string {
  const { colors } = stage.world.livery;
  if (car.kind !== "coach") return colors.body;
  if (isToy) {
    return (car.i % 2 ? colors.coach : colors.coach2) ?? colors.body;
  }
  return colors.coach ?? colors.body;
}

function passengerCarPixel(
  car: Car,
  u: number,
  v: number,
  halfWidth: number,
  paint: CarPaint,
): Pixel {
  const { dimming, glass, stage } = paint;
  const halfLength = car.len / 2;
  const body = coachColour(car, paint);
  const isWindscreen =
    (car.kind === "cab" && u > halfLength - 4) ||
    (car.kind === "nose" && u > halfLength - 10 && u < halfLength - 5);
  if (isWindscreen) {
    return Math.abs(v) < halfWidth - 1.4 ? glass : shaded(body, dimming);
  }
  if (Math.abs(v) < 1.8 && Math.abs(u) < halfLength - 3) {
    const windowLength = (car.len - 6) / WINDOWS_PER_CAR;
    const passenger =
      car.passengers[Math.floor((u + halfLength - 3) / windowLength)];
    return passenger ? solid(passenger.color) : glass;
  }
  if (Math.abs(v) > CAR_HALF_WIDTH - 2.4) {
    return shaded(stage.world.livery.colors.trim, dimming);
  }
  return shaded(body, dimming * (v < 0 ? 1.1 : 1));
}

/** The colour at a point on a car, in its own axes, or null off the car. */
function carPixel(
  car: Car,
  u: number,
  v: number,
  paint: CarPaint,
): Pixel | null {
  const { scale } = paint.stage.view;
  const halfLength = car.len / 2;
  const halfWidth =
    car.kind === "nose" && u > halfLength - 12
      ? CAR_HALF_WIDTH * Math.sqrt(Math.max(0, (halfLength - u) / 12))
      : CAR_HALF_WIDTH;
  if (Math.abs(u) > halfLength || Math.abs(v) > halfWidth) return null;

  const outlineWidth = 0.95 / scale;
  if (
    Math.abs(u) > halfLength - outlineWidth ||
    Math.abs(v) > halfWidth - outlineWidth
  ) {
    return paint.outline;
  }
  if (car.kind === "loco") return locoPixel(car, u, v, paint);
  if (car.kind === "tender") return tenderPixel(car, u, v, paint);
  return passengerCarPixel(car, u, v, halfWidth, paint);
}

function paintCar(raster: Raster, car: Car, paint: CarPaint): void {
  const { view } = paint.stage;
  const { scale } = view;
  const centreX = worldToBufferX(view, car.x);
  const centreY = worldToBufferY(view, car.y);
  const cos = Math.cos(car.a);
  const sin = Math.sin(car.a);
  const reach = (car.len * scale) / 2 + 3;
  const left = Math.floor(centreX - reach);
  const right = Math.ceil(centreX + reach);
  const top = Math.floor(centreY - reach);
  const bottom = Math.ceil(centreY + reach);
  const isRaised = car.z > ON_BRIDGE_ABOVE;
  const shadowX = isRaised ? 2 : 1;
  const shadowY = isRaised ? 3 : 1;

  const isOutOfTunnel = (x: number, y: number) => {
    const { clip } = car;
    if (!clip) return true;
    const worldX = bufferToWorldX(view, x + 0.5);
    const worldY = bufferToWorldY(view, y + 0.5);
    return (worldX - clip.x) * clip.nx + (worldY - clip.y) * clip.ny >= 0;
  };
  const alongCar = (x: number, y: number) => {
    const u = ((x + 0.5 - centreX) * cos + (y + 0.5 - centreY) * sin) / scale;
    return car.rev ? -u : u;
  };
  const acrossCar = (x: number, y: number) =>
    (-(x + 0.5 - centreX) * sin + (y + 0.5 - centreY) * cos) / scale;

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const shadowU = alongCar(x - shadowX, y - shadowY);
      const shadowV = acrossCar(x - shadowX, y - shadowY);
      if (
        Math.abs(shadowU) <= car.len / 2 &&
        Math.abs(shadowV) <= CAR_HALF_WIDTH &&
        isOutOfTunnel(x, y)
      ) {
        raster.darken(x, y, TREE_AND_CAR_SHADOW);
      }
    }
  }
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (!isOutOfTunnel(x, y)) continue;
      const pixel = carPixel(car, alongCar(x, y), acrossCar(x, y), paint);
      if (pixel !== null) raster.set(x, y, pixel);
    }
  }
}

function paintPerson(
  raster: Raster,
  person: Person,
  { view }: Stage,
  flicker: number,
): void {
  if (person.alpha <= 0) return;
  const x = Math.round(worldToBufferX(view, person.x));
  const y = Math.round(worldToBufferY(view, person.y));
  if (person.alpha < 0.6 && (x + y + flicker) % 2) return;
  const clothes = solid(person.color);
  raster.set(x, y, clothes);
  raster.set(x, y - 1, solid(person.skin));
  if (view.pixelSize === 1) raster.set(x, y + 1, clothes);
}

/**
 * Paints everything that moves. `flicker` is a whole number that goes up a few times
 * a second, from `world.time`, for the dithered fade on people and steam. So it
 * holds with the rest of a stopped scene.
 */
export function paintMovingParts(
  raster: Raster,
  stage: Stage,
  flicker: number,
): void {
  const { world, palette } = stage;
  const carPaint = carPaintFor(stage);

  for (const person of world.people) {
    if (!person.station.elevated) paintPerson(raster, person, stage, flicker);
  }
  for (const car of world.cars) {
    if (!car.hidden && car.z < ON_BRIDGE_ABOVE) {
      paintCar(raster, car, carPaint);
    }
  }
  for (const person of world.people) {
    if (person.station.elevated) paintPerson(raster, person, stage, flicker);
  }
  for (const car of world.cars) {
    if (!car.hidden && car.z >= ON_BRIDGE_ABOVE) {
      paintCar(raster, car, carPaint);
    }
  }
  paintSteam(raster, stage, flicker);
  if (palette.night) paintNightGlows(raster, stage);
}
