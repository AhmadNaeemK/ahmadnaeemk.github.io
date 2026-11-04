import { describe, expect, it } from "vitest";
import { sample, SPEEDS, type LineSegment, type World } from "./index";
import { FRAME_SECONDS, startWorld, stateOf, step } from "./testkit";

const LONGEST_FRAME_SECONDS = 0.05;
const WARM_UP_FRAMES = 30;

const STARTS = [
  ["a moving train", { startStopped: false }],
  ["a reduced-motion start", { startStopped: true }],
] as const;

describe.each(STARTS)("a bad frame time on %s", (_label, start) => {
  it.each([
    ["NaN", NaN, 0],
    ["undefined", undefined as unknown as number, 0],
    ["-Infinity", -Infinity, 0],
    ["a negative time", -0.5, 0],
    ["Infinity", Infinity, LONGEST_FRAME_SECONDS],
    ["a time over the limit", 0.2, LONGEST_FRAME_SECONDS],
  ])("treats %s as a frame of the nearest good time", (_name, bad, good) => {
    const world = startWorld(start);
    const twin = startWorld(start);
    step(world, WARM_UP_FRAMES);
    step(twin, WARM_UP_FRAMES);

    world.update(bad);
    twin.update(good);

    expect(stateOf(world)).toEqual(stateOf(twin));
  });
});

describe("after a run of bad frame times", () => {
  function everyNumberIn(value: unknown): number[] {
    if (typeof value === "number") return [value];
    if (typeof value !== "object" || value === null) return [];
    return Object.values(value).flatMap(everyNumberIn);
  }

  it("the world holds only real numbers, and keeps moving", () => {
    const world = startWorld({ livery: "steam" });
    for (let frame = 0; frame < 200; frame += 1) {
      for (const bad of [NaN, Infinity, -Infinity, -1]) world.update(bad);
      step(world, 1);
    }
    const { x, y } = world.cars[0];

    step(world, 40);

    expect(everyNumberIn(stateOf(world)).every(Number.isFinite)).toBe(true);
    expect({ x: world.cars[0].x, y: world.cars[0].y }).not.toEqual({ x, y });
  });
});

/** Past the types, as an untyped binding could. */
const NOT_NUMBERS = [
  ["NaN", NaN],
  ["undefined", undefined as unknown as number],
  ["a string", "x" as unknown as number],
  ["an object", {} as unknown as number],
] as const;
const NULL_SPEED = null as unknown as number;

describe("a bad speed", () => {
  it.each([NaN, 1.5, 0.4, Infinity, -Infinity])(
    "setSpeed(%d) leaves a speed that exists",
    (index) => {
      const world = startWorld();

      world.setSpeed(index);

      expect(SPEEDS[world.speedIndex]).toBeDefined();
    },
  );

  it.each(NOT_NUMBERS)(
    "setSpeed(%s) keeps the speed already chosen",
    (_label, index) => {
      const world = startWorld();
      world.setSpeed(2);

      world.setSpeed(index);

      expect(world.speedIndex).toBe(2);
    },
  );

  it("setSpeed(null) gives the slowest speed", () => {
    const world = startWorld();
    world.setSpeed(2);

    world.setSpeed(NULL_SPEED);

    expect(world.speedIndex).toBe(0);
  });

  it.each([...NOT_NUMBERS, ["1.5", 1.5], ["null", NULL_SPEED]] as const)(
    "setSpeed(%s) leaves the train running, on real positions",
    (_label, index) => {
      const world = startWorld();
      const { x, y } = world.cars[0];

      world.setSpeed(index);
      step(world, 40);

      expect(world.cars[0]).not.toMatchObject({ x, y });
      for (const car of world.cars) {
        expect(Number.isFinite(car.x)).toBe(true);
        expect(Number.isFinite(car.y)).toBe(true);
      }
      expect(Number.isFinite(world.time)).toBe(true);
    },
  );
});

describe("controls taken off the world", () => {
  it("toggleStop still stops it", () => {
    const world = startWorld();
    const { toggleStop } = world;

    toggleStop(true);

    expect(world.userStopped).toBe(true);
  });

  it("setSpeed still changes its speed", () => {
    const world = startWorld();
    const { setSpeed } = world;

    setSpeed(3);

    expect(world.speedIndex).toBe(3);
  });

  it("setLivery still changes its train", () => {
    const world = startWorld();
    const { setLivery } = world;

    setLivery("bullet");

    expect(world.liveryId).toBe("bullet");
    expect(world.cars).toHaveLength(world.livery.cars.length);
  });
});

describe("update taken off the world", () => {
  // Handed to requestAnimationFrame, it would get timestamps as frame times, all
  // clamped to the longest frame, so failing loudly is the point.
  it("throws", () => {
    const world = startWorld();
    const { update } = world;

    expect(() => update(FRAME_SECONDS)).toThrow();
  });
});

describe("hitTrain", () => {
  const HIT_RADIUS = 1;

  function worldWithFrontCarUnderground(): World {
    const world = startWorld();
    for (let frame = 0; frame < 5_000; frame += 1) {
      if (world.cars[0].hidden) return world;
      step(world, 1);
    }
    throw new Error("The front car never went underground.");
  }

  it("ignores a car underground, even at its last position", () => {
    const world = worldWithFrontCarUnderground();
    const { x, y } = world.cars[0];
    const visibleCars = world.cars.filter(({ hidden }) => !hidden);
    expect(
      visibleCars.some((car) => Math.hypot(car.x - x, car.y - y) < HIT_RADIUS),
    ).toBe(false);

    expect(world.hitTrain(x, y, HIT_RADIUS)).toBe(false);
  });

  it("still finds the cars above ground while another is underground", () => {
    const world = worldWithFrontCarUnderground();
    const visible = world.cars.find(({ hidden }) => !hidden);
    if (!visible) throw new Error("Expected a car above ground.");

    expect(world.hitTrain(visible.x, visible.y, HIT_RADIUS)).toBe(true);
  });

  it("works when a theme takes it off the world", () => {
    const world = startWorld();
    const { hitTrain } = world;
    const { x, y } = world.cars[0];

    expect(hitTrain(x, y, HIT_RADIUS)).toBe(true);
  });

  it("taken off the world, still follows the train as it moves", () => {
    const world = startWorld();
    const { hitTrain } = world;
    const { x, y } = world.cars[0];

    step(world, 20);

    expect(hitTrain(world.cars[0].x, world.cars[0].y, HIT_RADIUS)).toBe(true);
    expect(hitTrain(x, y, HIT_RADIUS)).toBe(false);
  });

  it("taken off the world, still finds the train after a livery change", () => {
    const world = startWorld();
    const { hitTrain } = world;

    world.setLivery("bullet");
    const lastCar = world.cars[world.cars.length - 1];

    expect(hitTrain(lastCar.x, lastCar.y, HIT_RADIUS)).toBe(true);
  });
});

describe("sample", () => {
  // `elevationAt` reads the segment off the point, so a point without one would
  // draw the bridge flat with no error.
  it("gives every point the segment it came from", () => {
    const segments = startWorld().letters.flatMap(({ parts }) => parts);
    expect(segments.length).toBeGreaterThan(0);

    for (const segment of segments) {
      for (const point of sample(segment)) {
        expect(point.seg).toBe(segment);
      }
    }
  });

  it("gives points elevationAt can read", () => {
    const world = startWorld();
    const [segment] = world.letters.flatMap(({ parts }) => parts);

    for (const point of sample(segment)) {
      expect(Number.isFinite(world.elevationAt(point))).toBe(true);
    }
  });

  const span = startWorld().bridge.find(
    (segment): segment is LineSegment => segment.type === "line",
  );
  if (!span) throw new Error("Expected the bridge to have a straight span.");

  it.each([0, NaN])("treats a step of %d as the default", (badStep) => {
    expect(sample(span, badStep)).toEqual(sample(span));
    expect(sample(span).length).toBeGreaterThan(3);
  });

  it("gives more points for a smaller step", () => {
    expect(sample(span, 10)).toHaveLength(span.len / 10 + 1);
    expect(sample(span, 5)).toHaveLength(span.len / 5 + 1);
  });

  it("gives a middle point however large the step", () => {
    expect(sample(span, span.len * 100)).toHaveLength(3);
  });

  it("runs from one end of the segment to the other", () => {
    const points = sample(span, 7);
    const last = points[points.length - 1];

    expect(points[0]).toMatchObject({ x: span.x0, y: span.y0 });
    expect(last.x).toBeCloseTo(span.x1);
    expect(last.y).toBeCloseTo(span.y1);
  });
});
