// Everything here goes through the public entry point, so it keeps guarding the
// contract (RFC section 7) however the engine is arranged behind it.
import { describe, expect, it } from "vitest";
import {
  createWorld,
  DEFAULT_LIVERY,
  SPEEDS,
  type World,
  type WorldView,
} from "./index";
import { step } from "./testkit";

const FRAMES_TO_SEE_MOTION = 20;
/** Long enough for a train at cruising speed to coast to a stop. */
const FRAMES_TO_COME_TO_REST = 400;

const RUNNING = { userStopped: false, textPaused: false };
const REDUCED_MOTION_START = { userStopped: true, textPaused: false };
const STOPPED = { userStopped: true, textPaused: true };

function start(startStopped: boolean): World {
  return createWorld({ seed: 11, livery: DEFAULT_LIVERY, startStopped });
}

function startRunning(): World {
  return start(false);
}

function startReducedMotion(): World {
  return start(true);
}

function startStoppedByPress(): World {
  const world = start(false);
  world.toggleStop();
  return world;
}

const STARTS = [
  ["running", startRunning],
  ["the reduced-motion start", startReducedMotion],
  ["stopped", startStoppedByPress],
] as const;

function stopFlags({ userStopped, textPaused }: World) {
  return { userStopped, textPaused };
}

/** A copy, because an engine may move the same car objects each frame. */
function frontCarPosition({ cars }: WorldView) {
  const { x, y } = cars[0];
  return { x, y };
}

const CONTROLS: readonly ((world: World) => void)[] = [
  (world) => world.toggleStop(),
  (world) => world.toggleStop(true),
  (world) => world.toggleStop(false),
  (world) => world.setSpeed(0),
];

/** The flags after every control, in every order, up to `depth` presses long. */
function flagsReachedFrom(
  createStart: () => World,
  depth: number,
  pressesSoFar: readonly ((world: World) => void)[] = [],
): ReturnType<typeof stopFlags>[] {
  if (depth === 0) return [];
  return CONTROLS.flatMap((control) => {
    const presses = [...pressesSoFar, control];
    const world = createStart();
    presses.forEach((press) => press(world));
    return [
      stopFlags(world),
      ...flagsReachedFrom(createStart, depth - 1, presses),
    ];
  });
}

describe("stop state (E18)", () => {
  it("starts running on a normal start", () => {
    expect(stopFlags(startRunning())).toEqual(RUNNING);
  });

  it("starts with the train stopped and the text rolling on a reduced-motion start", () => {
    expect(stopFlags(startReducedMotion())).toEqual(REDUCED_MOTION_START);
  });

  it.each([
    ["running", startRunning, STOPPED],
    ["the reduced-motion start", startReducedMotion, STOPPED],
    ["stopped", startStoppedByPress, RUNNING],
  ] as const)("moves on one press from %s", (_label, createStart, expected) => {
    const world = createStart();

    world.toggleStop();

    expect(stopFlags(world)).toEqual(expected);
  });

  it.each(STARTS)(
    "toggleStop(true) stops everything from %s",
    (_label, make) => {
      const world = make();

      world.toggleStop(true);

      expect(stopFlags(world)).toEqual(STOPPED);
    },
  );

  it.each(STARTS)(
    "toggleStop(false) runs everything from %s",
    (_label, make) => {
      const world = make();

      world.toggleStop(false);

      expect(stopFlags(world)).toEqual(RUNNING);
    },
  );

  it("never returns to the reduced-motion start after leaving it", () => {
    expect(flagsReachedFrom(startReducedMotion, 4)).not.toContainEqual(
      REDUCED_MOTION_START,
    );
  });

  it.each(STARTS)(
    "never pauses the text of a moving train, from %s",
    (_label, make) => {
      expect(flagsReachedFrom(make, 4)).not.toContainEqual({
        userStopped: false,
        textPaused: true,
      });
    },
  );
});

describe("a reduced-motion visitor's presses", () => {
  it("pauses the text on the first press without starting the train", () => {
    const world = startReducedMotion();
    const { textTime } = world;
    const position = frontCarPosition(world);

    world.toggleStop();
    step(world, FRAMES_TO_SEE_MOTION);

    expect(world.textTime).toBe(textTime);
    expect(frontCarPosition(world)).toEqual(position);
  });

  it("rolls the text and moves the train on the second press", () => {
    const world = startReducedMotion();
    world.toggleStop();
    const { textTime } = world;
    const position = frontCarPosition(world);

    world.toggleStop();
    step(world, FRAMES_TO_SEE_MOTION);

    expect(world.textTime).toBeGreaterThan(textTime);
    expect(frontCarPosition(world)).not.toEqual(position);
  });
});

describe("the text clock", () => {
  it("rolls from a normal start", () => {
    const world = startRunning();
    const { textTime } = world;

    step(world, FRAMES_TO_SEE_MOTION);

    expect(world.textTime).toBeGreaterThan(textTime);
  });

  it("rolls from a reduced-motion start", () => {
    const world = startReducedMotion();
    const { textTime } = world;

    step(world, FRAMES_TO_SEE_MOTION);

    expect(world.textTime).toBeGreaterThan(textTime);
  });

  it("stops as soon as the visitor stops a running train", () => {
    const world = startRunning();
    step(world, FRAMES_TO_SEE_MOTION);
    world.toggleStop();
    const { textTime } = world;

    step(world, FRAMES_TO_SEE_MOTION);

    expect(world.textTime).toBe(textTime);
  });
});

describe("toggleStop on a running train", () => {
  it("brings the train to rest", () => {
    const world = startRunning();
    step(world, FRAMES_TO_SEE_MOTION);

    world.toggleStop();
    step(world, FRAMES_TO_COME_TO_REST);
    const position = frontCarPosition(world);
    step(world, FRAMES_TO_SEE_MOTION);

    expect(frontCarPosition(world)).toEqual(position);
  });
});

describe("setSpeed", () => {
  it.each([
    ["stopped", startStoppedByPress],
    ["the reduced-motion start", startReducedMotion],
  ] as const)("clears both flags from %s", (_label, make) => {
    const world = make();

    world.setSpeed(0);

    expect(stopFlags(world)).toEqual(RUNNING);
  });

  it.each([
    ["stopped", startStoppedByPress],
    ["the reduced-motion start", startReducedMotion],
  ] as const)("rolls the text and moves the train from %s", (_label, make) => {
    const world = make();
    const { textTime } = world;
    const position = frontCarPosition(world);

    world.setSpeed(0);
    step(world, FRAMES_TO_SEE_MOTION);

    expect(world.textTime).toBeGreaterThan(textTime);
    expect(frontCarPosition(world)).not.toEqual(position);
  });
});

describe("setSpeed at the ends of the range", () => {
  it("stays on the slowest speed when asked for one below it", () => {
    const world = startRunning();
    world.setSpeed(0);

    world.setSpeed(world.speedIndex - 1);

    expect(world.speedIndex).toBe(0);
  });

  it("stays on the fastest speed when asked for one above it", () => {
    const world = startRunning();
    const lastIndex = SPEEDS.length - 1;
    world.setSpeed(lastIndex);

    world.setSpeed(world.speedIndex + 1);

    expect(world.speedIndex).toBe(lastIndex);
  });

  it.each([-1, 99])("keeps the train moving after setSpeed(%i)", (index) => {
    const world = startRunning();
    const position = frontCarPosition(world);

    world.setSpeed(index);
    step(world, FRAMES_TO_SEE_MOTION);

    expect(Number.isFinite(frontCarPosition(world).x)).toBe(true);
    expect(frontCarPosition(world)).not.toEqual(position);
  });
});

// Checked by `npm run typecheck`, never run: Vitest strips types. If the line
// below ever compiles, the unused directive fails typecheck, because a theme
// could then replace `hitTrain` on the world all three share (C14).
function replaceHitTrainOnSharedWorld(world: WorldView): void {
  // @ts-expect-error `WorldView.hitTrain` is readonly (RFC section 7).
  world.hitTrain = () => false;
}
void replaceHitTrainOnSharedWorld;
