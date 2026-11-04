/** The train in the diorama's view, and what it gives off. */
import { TAU } from "../../rail";
import type { Car, Puff, WorldPoint, WorldView } from "../../rail";
import { CAR_BODIES, type CarStyle } from "./car-bodies";
import { CarPainter, localToWorld } from "./car-painter";
import type { Lighting } from "./palette";
import {
  ARCH_HEIGHT,
  GROUND_SQUASH,
  projectY,
  VIEW_WIDTH,
  VIEW_X0,
} from "./view";

/** The height a car's middle is drawn at, above the rail. */
const CAR_MIDDLE = 6;

/**
 * Does a point in the view touch a visible car? The view's vertical is squashed, so
 * it is stretched back to compare with `radius`, which is in world units.
 */
export function isTrainAt(
  cars: readonly Car[],
  viewPoint: WorldPoint,
  radius: number,
): boolean {
  return cars.some(
    (car) =>
      !car.hidden &&
      Math.hypot(
        car.x - viewPoint.x,
        (projectY(car.y, car.z + CAR_MIDDLE) - viewPoint.y) / GROUND_SQUASH,
      ) < radius,
  );
}

export function drawCar(
  ctx: CanvasRenderingContext2D,
  car: Car,
  world: WorldView,
  viewHeight: number,
  { palette, night }: Lighting,
): void {
  const painter = new CarPainter(ctx, car, night ? 0.7 : 1, palette.carEdge);
  const colors = world.livery.colors;
  const isToy = world.liveryId === "toy";
  const style: CarStyle = {
    colors,
    isToy,
    glass: isToy && !night ? colors.window : palette.pane,
    palette,
  };

  ctx.save();
  if (car.clip && car.clip.ny > 0.5) {
    // Going in under a hill: nothing shows above its mouth.
    ctx.beginPath();
    ctx.rect(
      VIEW_X0,
      projectY(car.clip.y) - ARCH_HEIGHT,
      VIEW_WIDTH,
      viewHeight,
    );
    ctx.clip();
  }
  painter.shadow(palette.shadow);
  CAR_BODIES[car.kind](painter, car, style);
  ctx.restore();
}

export function drawPuffs(
  ctx: CanvasRenderingContext2D,
  puffs: readonly Puff[],
  { palette, night }: Lighting,
): void {
  ctx.fillStyle = palette.steam;
  for (const { x, y, z, r, life, max } of puffs) {
    ctx.globalAlpha = (1 - life / max) * (night ? 0.35 : 0.7);
    ctx.beginPath();
    ctx.arc(x, projectY(y, z), r * 1.1, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Each car's lit windows, and the headlamp on the leading car. */
export function eachTrainGlow(
  cars: readonly Car[],
  paintGlow: (x: number, y: number, radius: number, alpha: number) => void,
): void {
  for (const car of cars) {
    if (car.hidden) continue;
    paintGlow(car.x, projectY(car.y, car.z + 7), 14, 0.1);
    if (car.i === 0 && !(car.clip && car.clip.ny > 0.5)) {
      const [x, y, z] = localToWorld(car, car.len / 2 + 12, 0);
      paintGlow(x, projectY(y, z + 3), 16, 0.22);
    }
  }
}
