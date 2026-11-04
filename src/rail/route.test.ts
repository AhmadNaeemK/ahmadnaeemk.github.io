import { describe, expect, it } from "vitest";
import { sample, type TrackPoint, type WorldView } from "./index";
import { startWorld, step } from "./testkit";

const world = startWorld();

/** Past rounding in `pointAt`, which can land just before a segment's start. */
const JUST_INSIDE = 1e-6;

/** Each segment once, in order, walking the public `pointAt` from the start. */
function walkRoute({ pointAt }: WorldView) {
  const first = pointAt(JUST_INSIDE)?.seg;
  if (!first) throw new Error("Expected the route to start above ground.");
  const walked = [{ seg: first, start: 0 }];
  let s = first.len;
  for (let i = 0; i < 100; i += 1) {
    const seg = pointAt(s + JUST_INSIDE)?.seg;
    if (seg === first) return { segments: walked, lap: s };
    if (!seg) throw new Error(`Expected a segment to start at ${s}.`);
    walked.push({ seg, start: s });
    s += seg.len;
  }
  throw new Error("The route never came back to its start.");
}

const { segments, lap } = walkRoute(world);

function expectSamePlace(actual: TrackPoint | null, expected: TrackPoint) {
  expect(actual?.x).toBeCloseTo(expected.x, 6);
  expect(actual?.y).toBeCloseTo(expected.y, 6);
  expect(actual?.a).toBeCloseTo(expected.a, 6);
}

function pointsAboveGround(): { s: number; point: TrackPoint }[] {
  const points = [];
  for (let s = 0; s < lap; s += 7.3) {
    const point = world.pointAt(s);
    if (point) points.push({ s, point });
  }
  return points;
}

describe("the route", () => {
  it("comes back to where it started after one lap", () => {
    for (const { s, point } of pointsAboveGround()) {
      expectSamePlace(world.pointAt(s + lap), point);
    }
  });

  it("has no gap where the lap joins", () => {
    const beforeJoin = world.pointAt(lap - 0.01);
    const afterJoin = world.pointAt(0.01);
    if (!beforeJoin || !afterJoin) throw new Error("Expected both to show.");

    expect(
      Math.hypot(beforeJoin.x - afterJoin.x, beforeJoin.y - afterJoin.y),
    ).toBeLessThan(0.021);
  });

  it("has no jump anywhere above ground", () => {
    const stride = 0.5;
    let previous = world.pointAt(0);
    for (let s = stride; s <= lap; s += stride) {
      const point = world.pointAt(s);
      if (point && previous) {
        const jump = Math.hypot(point.x - previous.x, point.y - previous.y);
        expect(jump).toBeLessThan(stride * 1.01);
      }
      previous = point;
    }
  });

  it("takes negative distances as the same places, a lap on", () => {
    for (const { s, point } of pointsAboveGround()) {
      expectSamePlace(world.pointAt(s - lap), point);
    }
  });

  it("gives no point in the middle of a tunnel, and one at each mouth", () => {
    const tunnels = segments.filter(({ seg }) => seg.kind === "tunnel");
    expect(tunnels.length).toBeGreaterThan(0);

    for (const { seg, start } of tunnels) {
      expect(world.pointAt(start + seg.len / 2)).toBeNull();
      expect(world.pointAt(start + 1)).not.toBeNull();
      expect(world.pointAt(start + seg.len - 1)).not.toBeNull();
    }
  });
});

describe("what lies along the route", () => {
  it("has four stations, in the order the train meets them", () => {
    expect(world.stations.map(({ id }) => id)).toEqual([
      "stem",
      "sky",
      "dbowl",
      "abowl",
    ]);
    const distances = world.stations.map(({ s }) => s);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("puts each station on the track, above ground", () => {
    for (const station of world.stations) {
      const point = world.pointAt(station.s);
      if (!point) throw new Error(`Station ${station.id} is underground.`);
      expect(point.x).toBeCloseTo(station.x, 6);
      expect(point.y).toBeCloseTo(station.y, 6);
    }
  });

  it("has six tunnels, and all of them are on the route", () => {
    expect(world.tunnels).toHaveLength(6);
    expect(segments.filter(({ seg }) => seg.kind === "tunnel")).toHaveLength(6);
  });

  it("has ten portals, each at its own place", () => {
    const places = world.portals.map(({ x, y }) => `${x},${y}`);

    expect(places).toHaveLength(10);
    expect(new Set(places).size).toBe(10);
  });
});

describe("height above the ground", () => {
  it("lifts the bridge above the ground, peaking at 16 on the span", () => {
    const span = world.bridge.find(({ type }) => type === "line");
    if (!span) throw new Error("Expected the bridge to have a straight span.");

    const heights = sample(span).map((point) => world.elevationAt(point));

    expect(Math.min(...heights)).toBeGreaterThan(0);
    expect(Math.max(...heights)).toBe(16);
  });

  it("climbs from the ground round the bridge's end curve", () => {
    const [leftCurve] = world.bridge;

    const heights = sample(leftCurve).map((point) => world.elevationAt(point));

    expect(heights[0]).toBe(0);
    expect(heights.at(-1)).toBeGreaterThan(0);
  });

  it("stays at nothing all along the letters", () => {
    const parts = world.letters.flatMap((letter) => letter.parts);

    const heights = parts.flatMap((part) =>
      sample(part).map((point) => world.elevationAt(point)),
    );

    expect(new Set(heights)).toEqual(new Set([0]));
  });
});

describe("cars at a tunnel", () => {
  /** Steps the train, and gives back the first car that `isWanted`. */
  function firstCarThat(isWanted: (car: WorldView["cars"][number]) => boolean) {
    const train = startWorld();
    for (let frame = 0; frame < 5_000; frame += 1) {
      const car = train.cars.find(isWanted);
      if (car) return car;
      step(train, 1);
    }
    throw new Error("No car ever matched.");
  }

  it("clips a car near a portal against it, facing out of the tunnel", () => {
    const { clip } = firstCarThat((car) => car.clip !== null);
    if (!clip) throw new Error("Expected a clipped car.");

    const portal = world.portals.find(
      ({ x, y }) => x === clip.x && y === clip.y,
    );
    if (!portal) throw new Error("Expected the clip to be at a portal.");
    expect(clip.nx).toBeCloseTo(-portal.dx);
    expect(clip.ny).toBeCloseTo(-portal.dy);
  });

  it("hides a car underground, with nothing to clip against", () => {
    expect(firstCarThat((car) => car.hidden).clip).toBeNull();
  });

  it("shows a car again once it comes out", () => {
    const train = startWorld();
    let hiddenFrames = 0;
    for (let frame = 0; frame < 5_000 && hiddenFrames === 0; frame += 1) {
      step(train, 1);
      if (train.cars[0].hidden) hiddenFrames += 1;
    }
    expect(hiddenFrames).toBe(1);

    for (let frame = 0; frame < 5_000 && train.cars[0].hidden; frame += 1) {
      step(train, 1);
    }

    expect(train.cars[0].hidden).toBe(false);
  });
});
