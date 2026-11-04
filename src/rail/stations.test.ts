import { describe, expect, it } from "vitest";
import {
  LIVERY_ORDER,
  type Car,
  type LiveryId,
  type Passenger,
  type World,
} from "./index";
import {
  driveToDwell,
  framesUntilDeparture,
  FRAME_SECONDS,
  ridersOn,
  startWorld,
  step,
} from "./testkit";

const SEATS_BY_KIND: Readonly<Record<Car["kind"], number>> = {
  coach: 6,
  cab: 4,
  nose: 4,
  loco: 0,
  tender: 0,
};
const SHORTEST_DWELL_SECONDS = 2.4;
const LONGEST_DWELL_SECONDS = 8;
const FRAMES_OF_SERVICE = 3_000;

function nearestStationId(world: World): string {
  const { x, y } = world.cars[0];
  const distances = world.stations.map((station) => ({
    id: station.id,
    distance: Math.hypot(station.x - x, station.y - y),
  }));
  return distances.reduce((a, b) => (b.distance < a.distance ? b : a)).id;
}

describe("a stop at a station", () => {
  it("stands for at least the shortest dwell, then leaves", () => {
    const world = startWorld();

    driveToDwell(world);
    const dwellSeconds = (1 + framesUntilDeparture(world)) * FRAME_SECONDS;

    expect(dwellSeconds).toBeGreaterThan(SHORTEST_DWELL_SECONDS);
  });

  it("leaves at the longest dwell even with someone still walking to a door", () => {
    // Heritage is the longest train, so on this seed someone at the far end of
    // the sky platform walks for a coach they cannot reach in time.
    const world = startWorld({ seed: 31, livery: "heritage" });
    const dwells = Array.from({ length: 12 }, () => {
      driveToDwell(world);
      return (1 + framesUntilDeparture(world)) * FRAME_SECONDS;
    });
    const longest = Math.max(...dwells);

    expect(longest).toBeGreaterThan(LONGEST_DWELL_SECONDS - FRAME_SECONDS * 2);
    expect(longest).toBeLessThanOrEqual(
      LONGEST_DWELL_SECONDS + FRAME_SECONDS * 2,
    );
  });

  it("happens at each station in turn, then starts the lap again", () => {
    const world = startWorld();
    const visited = [];

    for (let stop = 0; stop < 5; stop += 1) {
      driveToDwell(world);
      visited.push(nearestStationId(world));
      framesUntilDeparture(world);
    }

    expect(visited).toEqual(["stem", "sky", "dbowl", "abowl", "stem"]);
  });
});

describe("passengers", () => {
  const SERVICES = [11, 23, 31].flatMap((seed) =>
    LIVERY_ORDER.map((livery) => ({ seed, livery })),
  );

  it.each(SERVICES)(
    "board up to the seats and no further, seed $seed on $livery",
    ({ seed, livery }) => {
      const world = startWorld({ seed, livery });
      const seatedAtStart = ridersOn(world).length;
      let mostSeated = seatedAtStart;

      for (let frame = 0; frame < FRAMES_OF_SERVICE; frame += 1) {
        step(world, 1);
        for (const { kind, passengers } of world.cars) {
          expect(passengers.length).toBeLessThanOrEqual(SEATS_BY_KIND[kind]);
        }
        mostSeated = Math.max(mostSeated, ridersOn(world).length);
      }

      expect(mostSeated).toBeGreaterThan(seatedAtStart);
    },
  );

  it("fill a train completely when there are enough of them", () => {
    const world = startWorld({ livery: "toy" });
    const seats = world.cars.reduce(
      (sum, { kind }) => sum + SEATS_BY_KIND[kind],
      0,
    );
    let mostSeated = 0;

    for (let frame = 0; frame < FRAMES_OF_SERVICE * 2; frame += 1) {
      step(world, 1);
      mostSeated = Math.max(mostSeated, ridersOn(world).length);
    }

    expect(mostSeated).toBe(seats);
  });

  it("get off at a station, and walk the platform in their own colours", () => {
    const world = startWorld();
    for (let frame = 0; frame < 5_000; frame += 1) {
      const ridersBefore = ridersOn(world);
      const peopleBefore = new Set(world.people);

      step(world, 1);

      const stayedOn = new Set(ridersOn(world));
      const rodeOff = ridersBefore.filter((rider) => !stayedOn.has(rider));
      if (rodeOff.length > 0) {
        // Someone new to the platform is faded in only if they came off a train.
        const gotOff = world.people.filter(
          (person) => !peopleBefore.has(person) && person.alpha === 1,
        );
        const coloursOf = (people: readonly Passenger[]) =>
          people.map(({ color, skin }) => `${color} ${skin}`).sort();
        expect(coloursOf(gotOff)).toEqual(coloursOf(rodeOff));
        return;
      }
    }
    throw new Error("Nobody ever got off.");
  });
});

describe("a livery change", () => {
  const LIVERY_PAIRS = LIVERY_ORDER.flatMap((from) =>
    LIVERY_ORDER.filter((to) => to !== from).map((to) => ({ from, to })),
  );

  function ridersKey(world: World): string[] {
    return ridersOn(world)
      .map(({ color, skin }) => `${color} ${skin}`)
      .sort();
  }

  it.each(LIVERY_PAIRS)(
    "keeps every rider from $from to $to",
    ({ from, to }) => {
      const world = startWorld({ livery: from });
      step(world, 300);
      const riders = ridersKey(world);
      expect(riders.length).toBeGreaterThan(0);

      world.setLivery(to);

      expect(ridersKey(world)).toEqual(riders);
    },
  );

  /** A bullet train fuller than the toy train that replaces it can seat. */
  function overfilledToyTrain(): World {
    const world = startWorld({ livery: "bullet" satisfies LiveryId });
    for (let frame = 0; frame < 10_000; frame += 1) {
      if (ridersOn(world).length > 12) {
        world.setLivery("toy");
        return world;
      }
      step(world, 1);
    }
    throw new Error("The bullet train never filled up.");
  }

  it("lets nobody else on a car it overfilled", () => {
    const world = overfilledToyTrain();
    expect(
      world.cars.some(
        ({ kind, passengers }) => passengers.length > SEATS_BY_KIND[kind],
      ),
    ).toBe(true);
    const seatedBefore = world.cars.map(({ passengers }) => passengers.length);

    for (let frame = 0; frame < FRAMES_OF_SERVICE; frame += 1) {
      step(world, 1);
      world.cars.forEach(({ kind, passengers }, i) => {
        if (seatedBefore[i] > SEATS_BY_KIND[kind]) {
          expect(passengers.length).toBeLessThanOrEqual(seatedBefore[i]);
        }
        seatedBefore[i] = passengers.length;
      });
    }
  });
});
