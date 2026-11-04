/** Cars: building them from a livery, and placing them along the route. */
import type { Mutable } from "./mutable";
import { elevationAt, pointAt } from "./route";
import type {
  Car,
  CarKind,
  Livery,
  Passenger,
  Station,
  WorldPoint,
} from "./types";

const AXLE_OFFSET = 0.38;
const DOOR_OFFSET = 6.5;
const SEATS_BY_KIND: Readonly<Record<CarKind, number>> = {
  coach: 6,
  cab: 4,
  nose: 4,
  loco: 0,
  tender: 0,
};

/** A passenger on a train, who knows where they are getting off. */
export interface Rider extends Passenger {
  readonly dest: Station;
}

export type TrainCar = Mutable<Car> & { passengers: Rider[] };

export function seatsIn({ kind }: TrainCar): number {
  return SEATS_BY_KIND[kind];
}

/** New cars for a livery, with `riders` shared out across the seats. */
export function buildCars(
  livery: Livery,
  riders: readonly Rider[],
): TrainCar[] {
  const cars = livery.cars.map(([kind, len, rev], i): TrainCar => ({
    i,
    kind,
    len,
    rev: Boolean(rev),
    passengers: [],
    x: 0,
    y: 0,
    a: 0,
    hidden: false,
    clip: null,
    z: 0,
  }));
  const seated = cars.filter((car) => seatsIn(car) > 0);
  riders.forEach((rider, i) => {
    seated[i % seated.length].passengers.push(rider);
  });
  return cars;
}

export function trainLengthOf({ cars, gap }: Livery): number {
  return (
    cars.reduce((sum, [, length]) => sum + length, 0) + gap * (cars.length - 1)
  );
}

/** Places the cars behind `head`. A hidden car keeps its last position. */
export function layOutCars(
  cars: readonly TrainCar[],
  head: number,
  gap: number,
): void {
  let front = head;
  for (const car of cars) {
    const center = front - car.len / 2;
    const axle = car.len * AXLE_OFFSET;
    const frontPoint = pointAt(center + axle);
    const backPoint = pointAt(center - axle);
    if (!frontPoint || !backPoint) {
      car.hidden = true;
      car.clip = null;
    } else {
      const frontHeight = elevationAt(frontPoint);
      const backHeight = elevationAt(backPoint);
      car.hidden = false;
      car.x = (frontPoint.x + backPoint.x) / 2;
      car.y = (frontPoint.y + backPoint.y) / 2;
      car.a = Math.atan2(
        frontPoint.y - backPoint.y,
        frontPoint.x - backPoint.x,
      );
      car.clip = frontPoint.portal ?? backPoint.portal ?? null;
      car.z = (frontHeight + backHeight) / 2;
      car.pitch = frontHeight - backHeight;
    }
    front = center - car.len / 2 - gap;
  }
}

/** The side of the car that faces the station's platform. */
export function doorFacing(car: TrainCar, station: Station): WorldPoint {
  const normalX = -Math.sin(car.a);
  const normalY = Math.cos(car.a);
  const toPlatform =
    (station.cx - car.x) * normalX + (station.cy - car.y) * normalY;
  const side = toPlatform >= 0 ? 1 : -1;
  return {
    x: car.x + normalX * side * DOOR_OFFSET,
    y: car.y + normalY * side * DOOR_OFFSET,
  };
}
