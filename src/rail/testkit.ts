/**
 * Shared by the engine's tests, and imported by nothing else. It reads the world
 * only through the public entry point, so the tests keep guarding the contract
 * however the engine is arranged behind it.
 */
import {
  createWorld,
  type CreateWorldOptions,
  type Passenger,
  type World,
  type WorldView,
} from "./index";

export const FRAME_SECONDS = 0.05;
const MAX_FRAMES = 20_000;

export function startWorld(overrides: Partial<CreateWorldOptions> = {}): World {
  return createWorld({
    seed: 11,
    livery: "metro",
    startStopped: false,
    ...overrides,
  });
}

export function step(
  world: World,
  frames: number,
  seconds = FRAME_SECONDS,
): void {
  for (let frame = 0; frame < frames; frame += 1) world.update(seconds);
}

export function ridersOn({ cars }: WorldView): readonly Passenger[] {
  return cars.flatMap(({ passengers }) => passengers);
}

/** Everything a scene can read that changes, except the text clock. */
export function sceneOf(world: WorldView) {
  return {
    time: world.time,
    liveryId: world.liveryId,
    cars: world.cars.map(({ passengers, ...car }) => ({
      ...car,
      passengers: passengers.map(({ color, skin }) => ({ color, skin })),
    })),
    people: world.people.map(({ station, ...person }) => ({
      ...person,
      station: station.id,
    })),
    puffs: world.puffs.map((puff) => ({ ...puff })),
  };
}

export function stateOf(world: WorldView) {
  return { ...sceneOf(world), textTime: world.textTime };
}

/** Steps a running train until a frame in which it stood at a station. */
export function driveToDwell(world: World, seconds = FRAME_SECONDS): void {
  for (let frame = 0; frame < MAX_FRAMES; frame += 1) {
    const { x, y } = world.cars[0];
    world.update(seconds);
    const front = world.cars[0];
    // A hidden car keeps its last position, so only a visible one says anything.
    if (!front.hidden && front.x === x && front.y === y) return;
  }
  throw new Error("The train never stopped at a station.");
}

/** How many more frames a dwelling train stands, up to the one it moves on. */
export function framesUntilDeparture(
  world: World,
  seconds = FRAME_SECONDS,
): number {
  for (let frame = 0; frame < MAX_FRAMES; frame += 1) {
    const { x, y } = world.cars[0];
    world.update(seconds);
    if (world.cars[0].x !== x || world.cars[0].y !== y) return frame;
  }
  throw new Error("The train never left the station.");
}

/** Steps a stopped train until the scene clock stands still. */
export function driveToRest(world: World): void {
  for (let frame = 0; frame < MAX_FRAMES; frame += 1) {
    const { time } = world;
    world.update(FRAME_SECONDS);
    if (world.time === time) return;
  }
  throw new Error("The scene never went still.");
}

/** Small enough frames for a press to land just short of a station. */
export const BRAKING_ARRIVAL_FRAME_SECONDS = 1 / 60;
