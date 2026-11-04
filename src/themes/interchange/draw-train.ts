/** What moves: the crowd, the train and its steam. */
import { TAU } from "../../rail";
import type { Car, LiveryColors, Person } from "../../rail";
import type { Paint } from "./scene-tokens";

const CAR_WIDTH = 10;
/** How far a tunnel's clip region reaches past the mouth. */
const CLIP_REACH = 600;
const MAX_PASSENGER_DOTS = 6;
const COAL_FLECKS = 7;

export function drawPeople({ ctx }: Paint, people: readonly Person[]): void {
  for (const person of people) {
    if (person.alpha <= 0) continue;
    ctx.globalAlpha = Math.min(1, person.alpha);
    const bob = person.moving ? Math.sin(person.phase * 2) * 0.35 : 0;
    ctx.fillStyle = person.color;
    ctx.beginPath();
    ctx.roundRect(person.x - 1.5, person.y - 0.6 + bob, 3, 3.4, 1);
    ctx.fill();
    ctx.fillStyle = person.skin;
    ctx.beginPath();
    ctx.arc(person.x, person.y - 1.9 + bob, 1.25, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function clipAtPortal(
  ctx: CanvasRenderingContext2D,
  { x, y, nx, ny }: NonNullable<Car["clip"]>,
): void {
  const tangentX = -ny * CLIP_REACH;
  const tangentY = nx * CLIP_REACH;
  const outX = nx * CLIP_REACH;
  const outY = ny * CLIP_REACH;
  ctx.beginPath();
  ctx.moveTo(x + tangentX, y + tangentY);
  ctx.lineTo(x - tangentX, y - tangentY);
  ctx.lineTo(x - tangentX + outX, y - tangentY + outY);
  ctx.lineTo(x + tangentX + outX, y + tangentY + outY);
  ctx.clip();
}

function traceCarShape(
  { ctx, world }: Paint,
  { kind, len }: Car,
  width: number,
): void {
  const half = width / 2;
  ctx.beginPath();
  if (kind === "nose") {
    ctx.moveTo(-len / 2, -half);
    ctx.lineTo(len / 2 - 13, -half);
    ctx.quadraticCurveTo(len / 2 + 1, -half * 0.4, len / 2, 0);
    ctx.quadraticCurveTo(len / 2 + 1, half * 0.4, len / 2 - 13, half);
    ctx.lineTo(-len / 2, half);
    ctx.closePath();
  } else if (kind === "cab" || (kind === "loco" && world.liveryId === "toy")) {
    ctx.roundRect(-len / 2, -half, len, width, [2, 4.5, 4.5, 2]);
  } else {
    ctx.roundRect(-len / 2, -half, len, width, 2);
  }
}

function drawPassengerDots(
  ctx: CanvasRenderingContext2D,
  car: Car,
  area: { x0: number; x1: number; y0: number; y1: number },
): void {
  const seated = car.passengers.slice(0, MAX_PASSENGER_DOTS);
  if (seated.length === 0) return;
  const { x0, x1, y0, y1 } = area;
  const columns = Math.ceil(seated.length / 2);
  const step = (x1 - x0) / Math.max(columns, 3);
  const rowHeight = (y1 - y0) / 2;
  seated.forEach(({ color }, index) => {
    const column = index >> 1;
    const inSecondRow = (index & 1) === 1;
    ctx.fillStyle = color;
    ctx.fillRect(
      x0 + step * (column + 0.25),
      y0 + (inSecondRow ? rowHeight + 0.2 : 0.2),
      Math.min(2.4, step * 0.6),
      rowHeight - 0.4,
    );
  });
}

/** Cab at the back, boiler forward, chimney at the front. */
function drawLoco(paint: Paint, car: Car, colors: LiveryColors): void {
  const { ctx, world } = paint;
  const { len } = car;
  const half = CAR_WIDTH / 2;
  const isToy = world.liveryId === "toy";

  ctx.fillStyle = colors.roof;
  ctx.beginPath();
  ctx.roundRect(-len / 2, -half, 10, CAR_WIDTH, 2);
  ctx.fill();

  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.roundRect(
    -len / 2 + 9,
    -half + 1.3,
    len - 9,
    CAR_WIDTH - 2.6,
    isToy ? 4 : [1, 3.5, 3.5, 1],
  );
  ctx.fill();

  ctx.strokeStyle = colors.trim;
  ctx.lineWidth = 0.9;
  for (let x = -len / 2 + 13; x < len / 2 - 4; x += 5) {
    ctx.beginPath();
    ctx.moveTo(x, -half + 1.5);
    ctx.lineTo(x, half - 1.5);
    ctx.stroke();
  }

  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.arc(len / 2 - 6, 0, 2.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = colors.trim;
  ctx.beginPath();
  ctx.arc(len / 2 - 13, 0, 1.6, 0, TAU);
  ctx.fill();

  ctx.fillStyle = windowColor(paint, colors);
  ctx.fillRect(-len / 2 + 2, -half + 2, 2, CAR_WIDTH - 4);
}

function drawTender(
  { ctx, tokens }: Paint,
  car: Car,
  colors: LiveryColors,
): void {
  const { len } = car;
  const half = CAR_WIDTH / 2;
  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.roundRect(-len / 2, -half, len, CAR_WIDTH, 1.5);
  ctx.fill();
  ctx.fillStyle = tokens.coal;
  ctx.fillRect(-len / 2 + 2, -half + 2, len - 4, CAR_WIDTH - 4);
  ctx.fillStyle = tokens.coalFleck;
  for (let fleck = 0; fleck < COAL_FLECKS; fleck += 1) {
    ctx.fillRect(
      -len / 2 + 3 + ((fleck * 7) % (len - 6)),
      -half + 2.6 + ((fleck * 3) % 5),
      1,
      1,
    );
  }
}

function coachBodyColor(
  { world }: Paint,
  car: Car,
  colors: LiveryColors,
): string {
  if (world.liveryId !== "toy") return colors.coach ?? colors.body;
  return (car.i % 2 ? colors.coach : colors.coach2) ?? colors.body;
}

function windowColor({ tokens }: Paint, colors: LiveryColors): string {
  return tokens.dark ? tokens.lit : colors.window;
}

/** A coach, a cab or a nose: painted body, side stripes and a glass roof with people. */
function drawCarriage(paint: Paint, car: Car, colors: LiveryColors): void {
  const { ctx, world } = paint;
  const { kind, len } = car;
  const half = CAR_WIDTH / 2;
  const windows = windowColor(paint, colors);

  ctx.fillStyle =
    kind === "coach" ? coachBodyColor(paint, car, colors) : colors.body;
  traceCarShape(paint, car, CAR_WIDTH);
  ctx.fill();

  ctx.fillStyle = colors.trim;
  const stripeFront = kind === "nose" ? len / 2 - 12 : len / 2 - 1;
  const stripeLength = stripeFront + len / 2 - 1;
  ctx.fillRect(-len / 2 + 1, -half + 0.6, stripeLength, 1.3);
  ctx.fillRect(-len / 2 + 1, half - 1.9, stripeLength, 1.3);

  const roofStart = -len / 2 + 3;
  const roofEnd =
    kind === "coach"
      ? len / 2 - 3
      : kind === "nose"
        ? len / 2 - 15
        : len / 2 - 7;
  const hasSolidRoof =
    world.liveryId === "steam" || world.liveryId === "heritage";
  ctx.fillStyle = hasSolidRoof ? (colors.coachRoof ?? colors.roof) : windows;
  ctx.beginPath();
  ctx.roundRect(roofStart, -2.3, roofEnd - roofStart, 4.6, 1.2);
  ctx.fill();
  drawPassengerDots(ctx, car, {
    x0: roofStart + 0.5,
    x1: roofEnd - 0.5,
    y0: -2,
    y1: 2,
  });

  if (kind === "nose") {
    ctx.fillStyle = windows;
    ctx.beginPath();
    ctx.ellipse(len / 2 - 8, 0, 3.2, 2.6, 0, 0, TAU);
    ctx.fill();
  } else if (kind === "cab") {
    ctx.fillStyle = windows;
    ctx.beginPath();
    ctx.roundRect(len / 2 - 4.5, -3.2, 2.6, 6.4, 1);
    ctx.fill();
  }

  if (world.liveryId === "toy") {
    ctx.fillStyle = colors.coachRoof ?? colors.roof;
    ctx.fillRect(-len / 2 + 2, -half - 0.6, len - 4, 1);
  }
}

function drawCar(paint: Paint, car: Car): void {
  const { ctx, world, tokens } = paint;
  const { colors } = world.livery;

  ctx.save();
  if (car.clip) clipAtPortal(ctx, car.clip);

  // The shadow grows with height on the bridge.
  const lift = 1 + car.z * 0.32;
  ctx.save();
  ctx.translate(car.x + 1.2 * lift, car.y + 2 * lift);
  ctx.rotate(car.a);
  if (car.rev) ctx.scale(-1, 1);
  ctx.fillStyle = tokens.shadow;
  traceCarShape(paint, car, CAR_WIDTH);
  ctx.fill();
  ctx.restore();

  ctx.translate(car.x, car.y);
  ctx.rotate(car.a);
  if (car.rev) ctx.scale(-1, 1);
  if (car.kind === "loco") drawLoco(paint, car, colors);
  else if (car.kind === "tender") drawTender(paint, car, colors);
  else drawCarriage(paint, car, colors);
  ctx.restore();
}

export function drawCars(paint: Paint, cars: readonly Car[]): void {
  for (const car of cars) drawCar(paint, car);
}

export function drawPuffs({ ctx, world, tokens }: Paint): void {
  for (const { x, y, z, r, life, max } of world.puffs) {
    const age = life / max;
    ctx.globalAlpha = (1 - age) * 0.55;
    ctx.fillStyle = tokens.puff;
    ctx.beginPath();
    ctx.arc(x - z * 0.25, y - z * 0.45, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = (1 - age) * 0.35;
    ctx.strokeStyle = tokens.muted;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
