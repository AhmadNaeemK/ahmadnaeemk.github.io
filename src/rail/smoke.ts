/** Steam from the front car of a smoking livery. */
import type { Mutable } from "./mutable";
import type { Random } from "./random";
import type { TrainCar } from "./train";
import type { Puff } from "./types";

const STACK_OFFSET = 0.3;
const STACK_HEIGHT = 12;
const RUNNING_PUFF_RATE = 2;
const RUNNING_PUFF_RATE_PER_SPEED = 0.12;
const RUNNING_DRIFT = 4;
const RUNNING_SPEED_DRAG = 0.15;
const RUNNING_RADIUS = 2.2;
const RUNNING_LIFE = 1.6;
const RUNNING_LIFE_RANGE = 0.8;
const IDLE_PUFF_CHANCE_PER_SECOND = 1.2;
const IDLE_DRIFT = 2;
const IDLE_RADIUS = 2;
const IDLE_LIFE = 2.4;
const RISE_RATE = 9;
const GROWTH_RATE = 3.2;

type MovingPuff = Mutable<Puff> & { vx: number; vy: number };

interface SmokeFrame {
  readonly frontCar: TrainCar;
  readonly smoking: boolean;
  readonly dwelling: boolean;
  readonly speed: number;
}

export class Smoke {
  puffs: MovingPuff[] = [];

  readonly #random: Random;
  #pending = 0;

  constructor(random: Random) {
    this.#random = random;
  }

  update(frame: SmokeFrame, dt: number): void {
    const { frontCar, smoking, dwelling } = frame;
    if (smoking && !frontCar.hidden) {
      if (dwelling) this.#idle(frontCar, dt);
      else this.#run(frame, dt);
    }
    for (const puff of this.puffs) {
      puff.life += dt;
      puff.x += puff.vx * dt;
      puff.y += puff.vy * dt;
      puff.z += RISE_RATE * dt;
      puff.r += dt * GROWTH_RATE;
    }
    this.puffs = this.puffs.filter(({ life, max }) => life < max);
  }

  #run({ frontCar: car, speed }: SmokeFrame, dt: number): void {
    this.#pending +=
      dt * (RUNNING_PUFF_RATE + speed * RUNNING_PUFF_RATE_PER_SPEED);
    const cos = Math.cos(car.a);
    const sin = Math.sin(car.a);
    while (this.#pending > 1) {
      this.#pending -= 1;
      this.puffs.push({
        ...this.#stackPoint(car),
        r: RUNNING_RADIUS,
        life: 0,
        max: RUNNING_LIFE + this.#random() * RUNNING_LIFE_RANGE,
        vx: this.#drift(RUNNING_DRIFT) - cos * speed * RUNNING_SPEED_DRAG,
        vy: this.#drift(RUNNING_DRIFT) - sin * speed * RUNNING_SPEED_DRAG,
      });
    }
  }

  #idle(car: TrainCar, dt: number): void {
    if (this.#random() >= dt * IDLE_PUFF_CHANCE_PER_SECOND) return;
    this.puffs.push({
      ...this.#stackPoint(car),
      r: IDLE_RADIUS,
      life: 0,
      max: IDLE_LIFE,
      vx: this.#drift(IDLE_DRIFT),
      vy: this.#drift(IDLE_DRIFT),
    });
  }

  /** No smoking livery's front car runs backwards, so its stack is always ahead. */
  #stackPoint(car: TrainCar): Pick<Puff, "x" | "y" | "z"> {
    const offset = car.len * STACK_OFFSET;
    return {
      x: car.x + Math.cos(car.a) * offset,
      y: car.y + Math.sin(car.a) * offset,
      z: car.z + STACK_HEIGHT,
    };
  }

  #drift(range: number): number {
    return (this.#random() - 0.5) * range;
  }
}
