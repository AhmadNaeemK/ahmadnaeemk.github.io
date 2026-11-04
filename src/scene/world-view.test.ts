import { describe, expect, it } from "vitest";
import { createWorld, type World, type WorldView } from "../rail";
import { createWorldView } from "./world-view";

const startWorld = () =>
  createWorld({ seed: 11, livery: "metro", startStopped: false });

const FRAME_SECONDS = 0.05;

function stepWorld(world: World, frames: number): void {
  for (let frame = 0; frame < frames; frame += 1) world.update(FRAME_SECONDS);
}

describe("createWorldView", () => {
  it.each([
    "speedIndex",
    "userStopped",
    "textPaused",
    "update",
    "toggleStop",
    "setSpeed",
    "setLivery",
  ])("throws when a scene reaches for world.%s through a cast", (key) => {
    const view = createWorldView(startWorld()) as unknown as Record<
      string,
      unknown
    >;

    expect(() => view[key]).toThrow(key);
  });

  it("rejects replacing a member, as the Diorama prototype does with hitTrain", () => {
    const view = createWorldView(startWorld()) as {
      -readonly [K in keyof WorldView]: WorldView[K];
    };

    expect(() => {
      view.hitTrain = () => true;
    }).toThrow(TypeError);
  });

  it("shows the world's values as they change, not a copy from the start", () => {
    const world = startWorld();
    const view = createWorldView(world);

    stepWorld(world, 10);
    expect(world.time).toBeGreaterThan(0);
    expect(view.time).toBe(world.time);
    expect(view.textTime).toBe(world.textTime);
    expect(view.cars).toBe(world.cars);
    expect(view.people).toBe(world.people);
    expect(view.puffs).toBe(world.puffs);

    world.setLivery("toy");
    expect(view.liveryId).toBe("toy");
    expect(view.livery).toBe(world.livery);
    expect(view.trainLength).toBe(world.trainLength);
  });

  it("shows the track the world holds", () => {
    const world = startWorld();
    const view = createWorldView(world);

    expect(view.letters).toBe(world.letters);
    expect(view.bridge).toBe(world.bridge);
    expect(view.portals).toBe(world.portals);
    expect(view.tunnels).toBe(world.tunnels);
    expect(view.stations).toBe(world.stations);
  });

  it("answers position and hit questions from the world", () => {
    const world = startWorld();
    const view = createWorldView(world);
    stepWorld(world, 10);
    const lead = world.cars.find((car) => !car.hidden);
    if (!lead) throw new Error("The train starts out of view.");
    const point = world.pointAt(10);
    if (!point) throw new Error("No track at this distance.");

    expect(view.pointAt(10)).toEqual(point);
    expect(view.elevationAt(point)).toBe(world.elevationAt(point));
    expect(view.hitTrain(lead.x, lead.y, 1)).toBe(true);
    expect(view.hitTrain(lead.x + 5000, lead.y, 1)).toBe(false);
  });
});
