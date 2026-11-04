// The scene goes still when a stopped train comes to rest, not at the press, and
// the text answers to its own flag (RFC section 7).
import { describe, expect, it } from "vitest";
import { type CreateWorldOptions, type World } from "./index";
import {
  driveToDwell,
  driveToRest,
  FRAME_SECONDS,
  framesUntilDeparture,
  sceneOf,
  startWorld,
  step,
} from "./testkit";

/** Longer than any dwell, walk or puff would last if the scene were running. */
const LONG_HOLD_FRAMES = 400;
const FRAMES_INTO_THE_RIDE = 10;
const FRAMES_INTO_THE_DWELL = 10;
const WALK_SPEED = 16;

function pressedDuringDwell(options?: Partial<CreateWorldOptions>): World {
  const world = startWorld(options);
  driveToDwell(world);
  step(world, FRAMES_INTO_THE_DWELL);
  world.toggleStop();
  return world;
}

function pressedWhileMoving(options?: Partial<CreateWorldOptions>): World {
  const world = startWorld(options);
  step(world, FRAMES_INTO_THE_RIDE);
  world.toggleStop();
  return world;
}

function atRestAfterPressWhileMoving(
  options?: Partial<CreateWorldOptions>,
): World {
  const world = pressedWhileMoving(options);
  driveToRest(world);
  return world;
}

const STILL_WORLDS = [
  ["a reduced-motion start", () => startWorld({ startStopped: true })],
  ["a press during a dwell", () => pressedDuringDwell()],
  ["a press on a moving train, once it stops", atRestAfterPressWhileMoving],
  [
    "a reduced-motion start on steam",
    () => startWorld({ startStopped: true, livery: "steam" }),
  ],
  [
    "a press during a dwell on steam",
    () => pressedDuringDwell({ livery: "steam" }),
  ],
  [
    "a press on a moving steam train, once it stops",
    () => atRestAfterPressWhileMoving({ livery: "steam" }),
  ],
] as const;

describe("a stopped train at rest", () => {
  it.each(STILL_WORLDS)(
    "holds the whole scene after %s",
    (_label, makeWorld) => {
      const world = makeWorld();
      const held = sceneOf(world);
      expect(held.people.length).toBeGreaterThan(0);

      step(world, LONG_HOLD_FRAMES);

      expect(sceneOf(world)).toEqual(held);
    },
  );

  it("applies a livery change at once, and holds everything else", () => {
    const world = atRestAfterPressWhileMoving();
    const { time, people } = sceneOf(world);

    world.setLivery("bullet");
    step(world, 20);

    expect(world.liveryId).toBe("bullet");
    expect(world.cars).toHaveLength(world.livery.cars.length);
    expect(world.cars.every(({ x, y }) => x !== 0 || y !== 0)).toBe(true);
    expect(sceneOf(world)).toMatchObject({ time, people });
  });
});

describe("a press on a moving train", () => {
  it("pauses the text at once", () => {
    const world = pressedWhileMoving();
    const { textTime } = world;

    step(world, 1);

    expect(world.textTime).toBe(textTime);
  });

  it("keeps the scene clock running while the train brakes", () => {
    const world = pressedWhileMoving();
    const { time } = world;

    step(world, 10);

    expect(world.time).toBeCloseTo(time + 10 * FRAME_SECONDS);
  });

  it("keeps the crowd moving while the train brakes", () => {
    const world = pressedWhileMoving();
    const { people } = sceneOf(world);

    step(world, 10);

    expect(sceneOf(world).people).not.toEqual(people);
  });

  it("keeps the steam moving while the train brakes", () => {
    const world = pressedWhileMoving({ livery: "steam" });
    const { puffs } = sceneOf(world);

    step(world, 10);

    expect(sceneOf(world).puffs).not.toEqual(puffs);
  });

  it("keeps the train moving until it comes to rest", () => {
    const world = pressedWhileMoving();
    const { x, y } = world.cars[0];

    step(world, 3);

    expect(world.cars[0]).not.toMatchObject({ x, y });
  });

  it("stops the clock when the train stops, not at the press", () => {
    const world = pressedWhileMoving();
    const { time } = world;

    driveToRest(world);

    expect(world.time).toBeGreaterThan(time);
  });
});

describe("a reduced-motion start", () => {
  it("rolls the text from the first frame, with the scene held", () => {
    const world = startWorld({ startStopped: true });
    const held = sceneOf(world);

    step(world, FRAMES_INTO_THE_RIDE);

    expect(world.textTime).toBeCloseTo(FRAMES_INTO_THE_RIDE * FRAME_SECONDS);
    expect(sceneOf(world)).toEqual(held);
    expect(world.time).toBe(0);
  });

  it("pauses the text on the first press, with the scene still held", () => {
    const world = startWorld({ startStopped: true });
    step(world, FRAMES_INTO_THE_RIDE);
    const { textTime } = world;
    const held = sceneOf(world);

    world.toggleStop();
    step(world, FRAMES_INTO_THE_RIDE);

    expect(world.textTime).toBe(textTime);
    expect(sceneOf(world)).toEqual(held);
  });

  it("makes no steam at all", () => {
    const world = startWorld({ startStopped: true, livery: "steam" });

    step(world, LONG_HOLD_FRAMES);

    expect(world.puffs).toHaveLength(0);
  });
});

describe("a steam train at rest while stopped", () => {
  it.each([
    ["braked to a stop", atRestAfterPressWhileMoving],
    ["stopped during a dwell", pressedDuringDwell],
  ])("leaves its puffs where they are, %s", (_label, makeWorld) => {
    const world = makeWorld({ livery: "steam" });
    const { puffs } = sceneOf(world);
    expect(puffs.length).toBeGreaterThan(0);

    step(world, LONG_HOLD_FRAMES);

    expect(sceneOf(world).puffs).toEqual(puffs);
  });
});

const STARTING_AGAIN = [
  ["toggleStop", (world: World) => world.toggleStop()],
  ["setSpeed", (world: World) => world.setSpeed(world.speedIndex)],
] as const;

const WORLDS_TO_RESUME = [
  ["a dwell", () => pressedDuringDwell({ livery: "steam" })],
  ["braking", () => atRestAfterPressWhileMoving({ livery: "steam" })],
] as const;

describe.each(STARTING_AGAIN)("starting again with %s", (_control, press) => {
  it.each(WORLDS_TO_RESUME)(
    "moves the clock on one frame, after %s",
    (_label, make) => {
      const world = make();
      step(world, LONG_HOLD_FRAMES);
      const { time } = world;

      press(world);
      step(world, 1);

      expect(world.time).toBeCloseTo(time + FRAME_SECONDS, 10);
    },
  );

  it.each(WORLDS_TO_RESUME)(
    "moves nobody further than a stride, after %s",
    (_label, make) => {
      const world = make();
      step(world, LONG_HOLD_FRAMES);
      const before = world.people.map((person) => ({
        person,
        x: person.x,
        y: person.y,
      }));

      press(world);
      step(world, 1);

      const stillThere = new Set(world.people);
      for (const { person, x, y } of before) {
        if (stillThere.has(person)) {
          expect(Math.hypot(person.x - x, person.y - y)).toBeLessThanOrEqual(
            WALK_SPEED * FRAME_SECONDS + 1e-9,
          );
        }
      }
    },
  );

  it.each(WORLDS_TO_RESUME)(
    "rolls the text again, after %s",
    (_label, make) => {
      const world = make();
      step(world, LONG_HOLD_FRAMES);
      const { textTime } = world;

      press(world);
      step(world, 1);

      expect(world.textTime).toBeCloseTo(textTime + FRAME_SECONDS, 10);
    },
  );
});

describe("how long a hold lasted", () => {
  it.each(WORLDS_TO_RESUME)(
    "makes no difference to the world after %s",
    (_label, make) => {
      const heldLong = make();
      const heldBriefly = make();
      step(heldLong, LONG_HOLD_FRAMES);
      step(heldBriefly, 1);

      for (const world of [heldLong, heldBriefly]) {
        world.toggleStop();
        step(world, LONG_HOLD_FRAMES);
      }

      expect(sceneOf(heldLong)).toEqual(sceneOf(heldBriefly));
    },
  );
});

describe("a dwell interrupted by a stop", () => {
  it("lasts its full length after the train starts again", () => {
    const uninterrupted = startWorld();
    driveToDwell(uninterrupted);
    const fullDwellFrames = framesUntilDeparture(uninterrupted);

    const world = pressedDuringDwell();
    step(world, LONG_HOLD_FRAMES);
    world.toggleStop();
    const framesLeft = framesUntilDeparture(world);

    expect(framesLeft).toBe(fullDwellFrames - FRAMES_INTO_THE_DWELL);
  });
});
