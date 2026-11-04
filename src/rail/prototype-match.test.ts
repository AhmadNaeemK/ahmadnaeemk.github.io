// The engine has to behave as the prototype does, except where the contract says
// otherwise: forced toggles only, because the unforced one follows `textPaused`,
// and the prototype's update skipped once a stopped train is at rest.
import { describe, expect, it } from "vitest";
import { createWorld, LIVERY_ORDER } from "./index";
import {
  BRAKING_ARRIVAL_DISTANCE,
  distanceToNextStation,
  firstDifference,
  loadPrototype,
  stepPrototype,
  type PrototypeWorld,
  type SharedControls,
} from "./prototype-testkit";
import { BRAKING_ARRIVAL_FRAME_SECONDS } from "./testkit";

/** The three seeds the prototypes use. */
const SEEDS = [11, 23, 31];
const FRAMES_ON_A_RIDE = 3_500;
const FRAMES_OF_RANDOM_PRESSES = 2_500;
const FRAMES_TO_THE_LONGEST_DWELL = 2_600;
const FRAMES_OF_DOORSTEP_PRESSES = 4_000;
const FRAMES_A_DOORSTEP_PRESS_HOLDS = 30;

type ScriptRandom = () => number;

/** The script's own randomness, so it never touches the worlds' own. */
function createScriptRandom(seed: number): ScriptRandom {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function pick<Item>(items: readonly Item[], random: ScriptRandom): Item {
  return items[Math.floor(random() * items.length)];
}

type Press = (world: SharedControls) => void;

/** Picked once, so both worlds get exactly the same press. */
const PICK_PRESS: readonly ((random: ScriptRandom) => Press)[] = [
  () => (world) => world.toggleStop(true),
  () => (world) => world.toggleStop(true),
  () => (world) => world.toggleStop(false),
  (random) => {
    const index = Math.floor(random() * 4);
    return (world) => world.setSpeed(index);
  },
  (random) => {
    const livery = pick(LIVERY_ORDER, random);
    return (world) => world.setLivery(livery);
  },
];

/** Every kind of frame time the prototype survives. It has no answer to NaN. */
function varyingFrameSeconds(random: ScriptRandom): number {
  const roll = random();
  if (roll < 0.8) return 1 / 60;
  if (roll < 0.95) return random() * 0.05;
  return pick([0.2, -1, Infinity, -Infinity, 0], random);
}

interface Script {
  readonly frames: number;
  frameSeconds(random: ScriptRandom): number;
  /** The controls to press this frame, the same on both worlds. */
  pressesFor(prototype: PrototypeWorld, random: ScriptRandom): readonly Press[];
}

const SCRIPTS = {
  "no presses": (): Script => ({
    frames: FRAMES_ON_A_RIDE,
    frameSeconds: () => 1 / 30,
    pressesFor: () => [],
  }),
  "the longest dwell": (): Script => ({
    frames: FRAMES_TO_THE_LONGEST_DWELL,
    frameSeconds: () => 0.05,
    pressesFor: () => [],
  }),
  "random presses": (): Script => ({
    frames: FRAMES_OF_RANDOM_PRESSES,
    frameSeconds: varyingFrameSeconds,
    pressesFor: (prototype, random) => {
      if (prototype.userStopped && random() < 1 / 60) {
        return [(world) => world.toggleStop(false)];
      }
      if (random() >= 1 / 90) return [];
      return [pick(PICK_PRESS, random)(random)];
    },
  }),
  "a press on the doorstep of every station": (): Script => {
    let framesHeld = 0;
    return {
      frames: FRAMES_OF_DOORSTEP_PRESSES,
      frameSeconds: () => BRAKING_ARRIVAL_FRAME_SECONDS,
      pressesFor: (prototype) => {
        if (prototype.userStopped) {
          framesHeld += 1;
          if (framesHeld < FRAMES_A_DOORSTEP_PRESS_HOLDS) return [];
          framesHeld = 0;
          return [(world) => world.toggleStop(false)];
        }
        if (distanceToNextStation(prototype) >= BRAKING_ARRIVAL_DISTANCE) {
          return [];
        }
        return [(world) => world.toggleStop(true)];
      },
    };
  },
};

interface Run {
  readonly difference: string | null;
  /** So a script that stops reaching a state fails, rather than proving less. */
  readonly seen: {
    arrivals: number;
    brakingArrivals: number;
    framesHeldAtRest: number;
    framesBraking: number;
    longestDwellSeconds: number;
  };
}

function compareRun(
  seed: number,
  livery: string,
  makeScript: () => Script,
): Run {
  const options = { seed, livery, startStopped: false };
  const engine = createWorld(options);
  const prototype = loadPrototype().createWorld(options);
  const random = createScriptRandom(
    seed * 7919 + LIVERY_ORDER.findIndex((id) => id === livery),
  );
  const script = makeScript();
  const seen = {
    arrivals: 0,
    brakingArrivals: 0,
    framesHeldAtRest: 0,
    framesBraking: 0,
    longestDwellSeconds: 0,
  };

  let difference = firstDifference(engine, prototype);
  for (let frame = 0; frame < script.frames && !difference; frame += 1) {
    for (const press of script.pressesFor(prototype, random)) {
      press(engine);
      press(prototype);
    }
    const seconds = script.frameSeconds(random);
    const modeBefore = prototype.mode;
    const wasStopped = prototype.userStopped;
    const wasBraking = wasStopped && prototype.v > 0;
    if (wasStopped && prototype.v === 0) seen.framesHeldAtRest += 1;
    if (wasBraking) seen.framesBraking += 1;

    engine.update(seconds);
    stepPrototype(prototype, seconds);

    if (modeBefore === "run" && prototype.mode === "dwell") {
      seen.arrivals += 1;
      if (wasBraking) seen.brakingArrivals += 1;
    }
    if (prototype.mode === "dwell") {
      seen.longestDwellSeconds = Math.max(
        seen.longestDwellSeconds,
        prototype.dwell,
      );
    }
    const found = firstDifference(engine, prototype);
    if (found) difference = `frame ${frame}, ${found}`;
  }
  return { difference, seen };
}

const EVERY_SEED_ON_EVERY_LIVERY = SEEDS.flatMap((seed) =>
  LIVERY_ORDER.map((livery) => ({ seed, livery })),
);
/** The ones with fewer surprises, so one seed each is enough to keep it fast. */
const EVERY_LIVERY = LIVERY_ORDER.map((livery, i) => ({
  seed: SEEDS[i % SEEDS.length],
  livery,
}));

describe("the engine matches the prototype, frame by frame", () => {
  it.each(EVERY_LIVERY)(
    "on a ride with no presses, seed $seed on $livery",
    ({ seed, livery }) => {
      const { difference, seen } = compareRun(
        seed,
        livery,
        SCRIPTS["no presses"],
      );

      expect(difference).toBeNull();
      expect(seen.arrivals).toBeGreaterThanOrEqual(4);
    },
  );

  it.each(EVERY_SEED_ON_EVERY_LIVERY)(
    "through random presses and frame times, seed $seed starting on $livery",
    ({ seed, livery }) => {
      const { difference, seen } = compareRun(
        seed,
        livery,
        SCRIPTS["random presses"],
      );

      expect(difference).toBeNull();
      expect(seen.framesBraking).toBeGreaterThan(0);
      expect(seen.framesHeldAtRest).toBeGreaterThan(0);
    },
  );

  it("through a dwell that reaches the longest, seed 31 on heritage", () => {
    const { difference, seen } = compareRun(
      31,
      "heritage",
      SCRIPTS["the longest dwell"],
    );

    expect(difference).toBeNull();
    expect(seen.longestDwellSeconds).toBeGreaterThan(7.9);
  });

  it.each(EVERY_LIVERY)(
    "through arrivals while braking, seed $seed on $livery",
    ({ seed, livery }) => {
      const { difference, seen } = compareRun(
        seed,
        livery,
        SCRIPTS["a press on the doorstep of every station"],
      );

      expect(difference).toBeNull();
      expect(seen.brakingArrivals).toBeGreaterThanOrEqual(4);
    },
  );
});
