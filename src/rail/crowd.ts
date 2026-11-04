/**
 * The people on the platforms. The order of `random()` calls here is part of
 * what a seed produces, so reordering them changes every world.
 */
import { TAU } from "./geometry";
import type { Mutable } from "./mutable";
import type { Random } from "./random";
import { randomSpotOn, stations } from "./stations";
import { doorFacing, seatsIn, type Rider, type TrainCar } from "./train";
import type { Person, Station, WorldPoint } from "./types";

const PALETTE: readonly string[] = [
  "#E4572E",
  "#F3A712",
  "#29A39A",
  "#7B4B94",
  "#2F6EBA",
  "#E86A92",
  "#7FB800",
  "#FF8C42",
  "#3CBBB1",
  "#C1292E",
];
const SKIN: readonly string[] = [
  "#F2D0B1",
  "#D9A779",
  "#B07A50",
  "#8A5A3B",
  "#5E3B26",
];

const WALK_SPEED = 16;
const WAITING_WALK_FACTOR = 0.35;
const PLATFORM_PADDING = 3;
const MAX_WAITING = 6;
const INITIAL_WAITING = 3;
const INITIAL_WAITING_RANGE = 3;
const INITIAL_SEAT_FILL = 0.7;
const ALIGHT_CHANCE = 0.9;
const INITIAL_IDLE_RANGE_SECONDS = 3;
const IDLE_MIN_SECONDS = 2;
const IDLE_RANGE_SECONDS = 5;
const SPAWN_MIN_SECONDS = 2;
const SPAWN_RANGE_SECONDS = 4;
const BOARD_DELAY_MIN_SECONDS = 0.3;
const BOARD_DELAY_RANGE_SECONDS = 0.9;
const ALIGHT_DELAY_RANGE_SECONDS = 0.6;
const LEAVE_AFTER_MIN_SECONDS = 1;
const LEAVE_AFTER_RANGE_SECONDS = 2;
/** Some people are waiting for another train. */
const SKIP_TRAIN_CHANCE = 0.15;
const PHASE_RATE = 6;
const FADE_IN_RATE = 1.5;
const FADE_OUT_RATE = 0.7;
const STILL_DISTANCE = 0.01;
const MOVING_DISTANCE = 0.3;
const BOARDED_DISTANCE = 0.6;

type PersonState = "wait" | "board" | "alight" | "leave";

type Pedestrian = Mutable<Person> & {
  targetX: number;
  targetY: number;
  state: PersonState;
  idleSeconds: number;
  delaySeconds: number;
  leaveInSeconds: number;
  car: TrainCar | null;
  boarded: boolean;
};

export class Crowd {
  people: Pedestrian[] = [];

  readonly #random: Random;
  readonly #spawnTimers = new Map<Station, number>();

  constructor(random: Random) {
    this.#random = random;
  }

  /** Fills the platforms for the first frame. */
  populate(): void {
    for (const station of stations) {
      // The limit draws afresh on every pass, as the prototype's loop did.
      for (let i = 0; i < this.#drawInitialWaiting(); i += 1) {
        const person = this.#newPerson(this.#drawSpotOn(station), station);
        person.alpha = 1;
        this.people.push(person);
      }
    }
  }

  /** Part-fills the seats for the first frame. */
  seatFirstRiders(cars: readonly TrainCar[]): void {
    for (const car of cars) {
      const count = Math.floor(
        seatsIn(car) * this.#random() * INITIAL_SEAT_FILL,
      );
      for (let i = 0; i < count; i += 1) {
        car.passengers.push({
          color: this.#drawFrom(PALETTE),
          skin: this.#drawFrom(SKIN),
          dest: this.#drawFrom(stations),
        });
      }
    }
  }

  /** Riders for this station get off, then those waiting start towards doors. */
  meetTrain(station: Station, cars: readonly TrainCar[]): void {
    const visibleCars = cars.filter(({ hidden }) => !hidden);
    for (const car of visibleCars) this.#alightAt(station, car);
    for (const person of this.people) {
      if (person.station !== station || person.state !== "wait") continue;
      if (this.#random() < SKIP_TRAIN_CHANCE) continue;
      const car = this.#nearestCarWithRoom(person, visibleCars);
      if (!car) continue;
      const door = doorFacing(car, station);
      person.state = "board";
      person.car = car;
      person.targetX = door.x;
      person.targetY = door.y;
      person.delaySeconds =
        BOARD_DELAY_MIN_SECONDS + this.#random() * BOARD_DELAY_RANGE_SECONDS;
    }
  }

  isBoarding(): boolean {
    return this.people.some(({ state }) => state === "board");
  }

  /** Those still walking to a door go back to waiting. */
  giveUpBoarding(): void {
    for (const person of this.people) {
      if (person.state !== "board") continue;
      person.state = "wait";
      person.car = null;
      person.idleSeconds = 0;
    }
  }

  update(dt: number): void {
    for (const station of stations) this.#spawnAt(station, dt);
    for (const person of this.people) this.#move(person, dt);
    this.people = this.people.filter(
      ({ boarded, state, alpha }) =>
        !boarded && !(state === "leave" && alpha <= 0),
    );
  }

  #alightAt(station: Station, car: TrainCar): void {
    const staying: Rider[] = [];
    for (const rider of car.passengers) {
      if (rider.dest !== station || this.#random() >= ALIGHT_CHANCE) {
        staying.push(rider);
        continue;
      }
      const door = doorFacing(car, station);
      const target = this.#drawSpotOn(station);
      const person = this.#newPerson(door, station);
      person.color = rider.color;
      person.skin = rider.skin;
      person.alpha = 1;
      person.targetX = target.x;
      person.targetY = target.y;
      person.state = "alight";
      person.delaySeconds = this.#random() * ALIGHT_DELAY_RANGE_SECONDS;
      person.leaveInSeconds =
        LEAVE_AFTER_MIN_SECONDS + this.#random() * LEAVE_AFTER_RANGE_SECONDS;
      this.people.push(person);
    }
    car.passengers = staying;
  }

  #nearestCarWithRoom(
    person: Pedestrian,
    cars: readonly TrainCar[],
  ): TrainCar | null {
    let nearest: TrainCar | null = null;
    let nearestDistance = Infinity;
    for (const car of cars) {
      const headingThere = this.people.filter((p) => p.car === car).length;
      if (seatsIn(car) - car.passengers.length - headingThere <= 0) continue;
      const distance = Math.hypot(car.x - person.x, car.y - person.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = car;
      }
    }
    return nearest;
  }

  #spawnAt(station: Station, dt: number): void {
    const waiting = this.people.filter(
      (person) => person.station === station && person.state === "wait",
    ).length;
    const timer = (this.#spawnTimers.get(station) ?? 0) - dt;
    this.#spawnTimers.set(station, timer);
    if (waiting >= MAX_WAITING || timer > 0) return;
    this.people.push(this.#newPerson(this.#drawSpotOn(station), station));
    this.#spawnTimers.set(
      station,
      SPAWN_MIN_SECONDS + this.#random() * SPAWN_RANGE_SECONDS,
    );
  }

  #move(person: Pedestrian, dt: number): void {
    person.phase += dt * PHASE_RATE;
    if (person.delaySeconds > 0) {
      person.delaySeconds -= dt;
      return;
    }
    if (person.state === "wait") this.#wander(person, dt);
    this.#fadeOutAfterAlighting(person, dt);
    const distanceBeforeStep = this.#walkToTarget(person, dt);
    this.#boardIfAtDoor(person, distanceBeforeStep);
  }

  #wander(person: Pedestrian, dt: number): void {
    person.alpha = Math.min(1, person.alpha + dt * FADE_IN_RATE);
    person.idleSeconds -= dt;
    if (person.idleSeconds > 0) return;
    const target = this.#drawSpotOn(person.station);
    person.targetX = target.x;
    person.targetY = target.y;
    person.idleSeconds = IDLE_MIN_SECONDS + this.#random() * IDLE_RANGE_SECONDS;
  }

  #fadeOutAfterAlighting(person: Pedestrian, dt: number): void {
    if (person.state !== "alight" && person.state !== "leave") return;
    person.leaveInSeconds -= dt;
    if (person.state === "alight" && person.leaveInSeconds <= 0) {
      person.state = "leave";
    }
    if (person.state === "leave") person.alpha -= dt * FADE_OUT_RATE;
  }

  /** Takes one step, and returns how far away the target was before it. */
  #walkToTarget(person: Pedestrian, dt: number): number {
    const dx = person.targetX - person.x;
    const dy = person.targetY - person.y;
    const distance = Math.hypot(dx, dy);
    const stride =
      WALK_SPEED * (person.state === "wait" ? WAITING_WALK_FACTOR : 1) * dt;
    if (distance > STILL_DISTANCE) {
      const progress = Math.min(1, stride / distance);
      person.x += dx * progress;
      person.y += dy * progress;
    }
    person.moving = distance > MOVING_DISTANCE;
    return distance;
  }

  #boardIfAtDoor(person: Pedestrian, distanceToDoor: number): void {
    if (person.state !== "board" || !person.car) return;
    if (distanceToDoor >= BOARDED_DISTANCE) return;
    person.car.passengers.push({
      color: person.color,
      skin: person.skin,
      dest: this.#drawOtherStationThan(person.station),
    });
    person.boarded = true;
  }

  #newPerson({ x, y }: WorldPoint, station: Station): Pedestrian {
    return {
      x,
      y,
      targetX: x,
      targetY: y,
      color: this.#drawFrom(PALETTE),
      skin: this.#drawFrom(SKIN),
      state: "wait",
      station,
      alpha: 0,
      idleSeconds: this.#random() * INITIAL_IDLE_RANGE_SECONDS,
      delaySeconds: 0,
      leaveInSeconds: 0,
      car: null,
      boarded: false,
      phase: this.#random() * TAU,
    };
  }

  #drawInitialWaiting(): number {
    return INITIAL_WAITING + Math.floor(this.#random() * INITIAL_WAITING_RANGE);
  }

  #drawSpotOn({ platform }: Station): WorldPoint {
    return randomSpotOn(platform, this.#random, PLATFORM_PADDING);
  }

  #drawOtherStationThan(station: Station): Station {
    return this.#drawFrom(stations.filter((other) => other !== station));
  }

  #drawFrom<Item>(items: readonly Item[]): Item {
    return items[Math.floor(this.#random() * items.length)];
  }
}
