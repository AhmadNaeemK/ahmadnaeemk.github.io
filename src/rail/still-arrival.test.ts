// The one way a stopped train still has work to do: it reaches a station while
// braking, starts the exchange on that frame, and holds it (RFC section 7).
import { describe, expect, it } from "vitest";
import { createWorld, type World } from "./index";
import {
  BRAKING_ARRIVAL_FRAME_SECONDS,
  framesUntilDeparture,
  ridersOn,
  sceneOf,
  step,
} from "./testkit";

/** Longer than any dwell or walk would last if the scene were running. */
const LONG_HOLD_FRAMES = 600;
const SHORTEST_DWELL_SECONDS = 2.4;

describe("a braking train that reaches a station", () => {
  /** A seed with riders for the first station, so there is someone to get off. */
  const OPTIONS = { seed: 14, livery: "metro", startStopped: false };
  const SECONDS = BRAKING_ARRIVAL_FRAME_SECONDS;

  /**
   * The train is just short of the first station at this frame, close enough
   * that braking does not stop it in time. If the engine's timing changes, the
   * throws below say so rather than the tests quietly proving less.
   */
  const PRESS_FRAME = 122;

  /** Exactly where the front car stands at the first station, on its straight. */
  function isAtFirstStation(world: World): boolean {
    const front = world.cars[0];
    const standing = world.pointAt(world.stations[0].s - front.len / 2);
    if (!standing) throw new Error("Expected the station to be above ground.");
    return Math.hypot(front.x - standing.x, front.y - standing.y) < 1e-9;
  }

  /** Returns the world on the frame the train arrives. */
  function brakeIntoStation() {
    const world = createWorld(OPTIONS);
    step(world, PRESS_FRAME, SECONDS);
    if (isAtFirstStation(world)) {
      throw new Error("The press was too late: the train had already arrived.");
    }
    world.toggleStop(true);

    for (let frame = 0; frame < 10; frame += 1) {
      const ridersBefore = ridersOn(world);
      const peopleBefore = new Set(world.people);
      world.update(SECONDS);
      if (isAtFirstStation(world)) {
        return { world, ridersBefore, peopleBefore };
      }
    }
    throw new Error("The press was too early to reach the station.");
  }

  it("lets riders off on the frame it arrives", () => {
    const { world, ridersBefore, peopleBefore } = brakeIntoStation();

    const stayedOn = new Set(ridersOn(world));
    const rodeOff = ridersBefore.filter((rider) => !stayedOn.has(rider));
    const gotOff = world.people.filter(
      (person) => !peopleBefore.has(person) && person.alpha === 1,
    );

    expect(rodeOff.length).toBeGreaterThan(0);
    expect(gotOff).toHaveLength(rodeOff.length);
  });

  it("holds everything from the frame after that", () => {
    const { world } = brakeIntoStation();
    const held = sceneOf(world);

    step(world, LONG_HOLD_FRAMES, SECONDS);

    expect(sceneOf(world)).toEqual(held);
  });

  it("runs the dwell only after the train starts again", () => {
    const { world } = brakeIntoStation();
    step(world, LONG_HOLD_FRAMES, SECONDS);

    world.toggleStop(false);
    const dwellFrames = framesUntilDeparture(world, SECONDS);

    expect(dwellFrames * SECONDS).toBeGreaterThan(SHORTEST_DWELL_SECONDS);
  });

  it("takes on those waiting only once the train starts again", () => {
    const { world } = brakeIntoStation();
    const seatedOnArrival = ridersOn(world).length;
    step(world, LONG_HOLD_FRAMES, SECONDS);
    expect(ridersOn(world)).toHaveLength(seatedOnArrival);

    world.toggleStop(false);
    framesUntilDeparture(world, SECONDS);

    expect(ridersOn(world).length).toBeGreaterThan(seatedOnArrival);
  });
});
