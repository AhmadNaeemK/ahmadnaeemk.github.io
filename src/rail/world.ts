/**
 * The world: stop state, the train's motion, and stepping everything else.
 * A stopped train that has come to rest holds the whole scene still (RFC
 * section 7), so only the text clock changes in `update` from then on.
 */
import { Crowd } from "./crowd";
import { DEFAULT_LIVERY, isLiveryId, LIVERIES } from "./liveries";
import { createRandom } from "./random";
import {
  bridge,
  elevationAt,
  letters,
  pointAt,
  portals,
  ROUTE_LENGTH,
  tunnels,
} from "./route";
import { Smoke } from "./smoke";
import { stations } from "./stations";
import { buildCars, layOutCars, trainLengthOf, type TrainCar } from "./train";
import type {
  CreateWorld,
  CreateWorldOptions,
  Livery,
  LiveryId,
  Station,
  World,
} from "./types";

export const SPEEDS: readonly number[] = [0.5, 1, 1.6, 2.3];

const INITIAL_SPEED_INDEX = 1;
const CRUISE = 52;
const ACCELERATION = 26;
/** The hardest the train plans to brake when slowing for a station. */
const STATION_APPROACH_DECELERATION = 34;
/** Any other slowdown: a stop, or a lower speed. */
const SLOWING_DECELERATION = STATION_APPROACH_DECELERATION * 1.3;
const MIN_APPROACH_SPEED = 3;
const MAX_FRAME_SECONDS = 0.05;
const START_BEHIND_FIRST_STATION = 70;
const DWELL_SECONDS = 2.4;
const MAX_DWELL_SECONDS = 8;

/** `Math.min` and `Math.max` pass NaN through, which would poison the world. */
function clampFrameSeconds(seconds: number): number {
  const clamped = Math.max(0, Math.min(seconds, MAX_FRAME_SECONDS));
  return Number.isNaN(clamped) ? 0 : clamped;
}

function clampSpeedIndex(index: number, fallback: number): number {
  const rounded = Math.round(index);
  if (Number.isNaN(rounded)) return fallback;
  return Math.max(0, Math.min(SPEEDS.length - 1, rounded));
}

class RailWorld implements World {
  readonly letters = letters;
  readonly bridge = bridge;
  readonly portals = portals;
  readonly tunnels = tunnels;
  readonly stations = stations;
  readonly pointAt = pointAt;
  readonly elevationAt = elevationAt;
  // This and the controls are arrows, so they still work detached from the world.
  readonly hitTrain = (x: number, y: number, radius: number): boolean =>
    this.cars.some(
      (car) => !car.hidden && Math.hypot(car.x - x, car.y - y) < radius,
    );

  speedIndex = INITIAL_SPEED_INDEX;
  userStopped: boolean;
  textPaused = false;
  time = 0;
  textTime = 0;
  cars: TrainCar[] = [];
  liveryId: LiveryId = DEFAULT_LIVERY;
  livery: Livery = LIVERIES[DEFAULT_LIVERY];
  trainLength = 0;

  readonly #crowd: Crowd;
  readonly #smoke: Smoke;
  #head = 0;
  #speed: number;
  #dwellSeconds: number | null = null;
  #lastStation: Station | null = null;

  constructor({ seed, livery, startStopped }: CreateWorldOptions) {
    const random = createRandom(seed);
    this.#crowd = new Crowd(random);
    this.#smoke = new Smoke(random);
    this.userStopped = startStopped;
    this.#speed = startStopped ? 0 : CRUISE;
    // Lays out at head 0, which matters: a car hidden at the start below keeps
    // this position.
    this.setLivery(livery);
    this.#head = stations[0].s - START_BEHIND_FIRST_STATION;
    this.#crowd.populate();
    this.#crowd.seatFirstRiders(this.cars);
    this.#layOutCars();
  }

  get people() {
    return this.#crowd.people;
  }

  get puffs() {
    return this.#smoke.puffs;
  }

  readonly toggleStop = (force?: boolean): void => {
    const stopped = force ?? !this.textPaused;
    this.userStopped = stopped;
    this.textPaused = stopped;
  };

  readonly setSpeed = (index: number): void => {
    this.speedIndex = clampSpeedIndex(index, this.speedIndex);
    this.userStopped = false;
    this.textPaused = false;
  };

  readonly setLivery = (id: string): void => {
    this.liveryId = isLiveryId(id) ? id : DEFAULT_LIVERY;
    this.livery = LIVERIES[this.liveryId];
    const riders = this.cars.flatMap(({ passengers }) => passengers);
    this.cars = buildCars(this.livery, riders);
    this.trainLength = trainLengthOf(this.livery);
    this.#layOutCars();
  };

  // A method, so `requestAnimationFrame(world.update)` throws rather than
  // silently clamping timestamps.
  update(dtSeconds: number): void {
    const dt = clampFrameSeconds(dtSeconds);
    if (!this.textPaused) this.textTime += dt;
    if (this.userStopped && this.#speed <= 0) return;
    this.time += dt;
    if (this.#dwellSeconds === null) this.#drive(dt);
    else this.#dwell(this.#dwellSeconds + dt);
    this.#layOutCars();
    this.#crowd.update(dt);
    this.#smoke.update(
      {
        frontCar: this.cars[0],
        smoking: Boolean(this.livery.smoke),
        dwelling: this.#dwellSeconds !== null,
        speed: this.#speed,
      },
      dt,
    );
  }

  #dwell(seconds: number): void {
    this.#dwellSeconds = seconds;
    const boardingDone = seconds > DWELL_SECONDS && !this.#crowd.isBoarding();
    if (!boardingDone && seconds <= MAX_DWELL_SECONDS) return;
    this.#crowd.giveUpBoarding();
    this.#dwellSeconds = null;
  }

  #drive(dt: number): void {
    const target = this.userStopped ? 0 : CRUISE * SPEEDS[this.speedIndex];
    const { station, distance } = this.#nextStation();
    this.#speed =
      this.#speed < target
        ? Math.min(target, this.#speed + ACCELERATION * dt)
        : Math.max(target, this.#speed - SLOWING_DECELERATION * dt);
    const approachSpeedLimit = Math.sqrt(
      2 * STATION_APPROACH_DECELERATION * Math.max(0, distance),
    );
    if (!this.userStopped && this.#speed > approachSpeedLimit) {
      this.#speed = Math.max(approachSpeedLimit, MIN_APPROACH_SPEED);
    }
    const step = this.#speed * dt;
    if (step >= distance) this.#arriveAt(station);
    else this.#head = (this.#head + step) % ROUTE_LENGTH;
  }

  #arriveAt(station: Station): void {
    this.#head = station.s;
    this.#layOutCars();
    this.#dwellSeconds = 0;
    this.#lastStation = station;
    this.#speed = 0;
    this.#crowd.meetTrain(station, this.cars);
  }

  #nextStation(): { station: Station; distance: number } {
    let station = stations[0];
    let distance = Infinity;
    for (const candidate of stations) {
      if (candidate === this.#lastStation) continue;
      const ahead = (candidate.s - this.#head + ROUTE_LENGTH) % ROUTE_LENGTH;
      if (ahead < distance) {
        distance = ahead;
        station = candidate;
      }
    }
    return { station, distance };
  }

  #layOutCars(): void {
    layOutCars(this.cars, this.#head, this.livery.gap);
  }
}

export const createWorld: CreateWorld = (options) => new RailWorld(options);
