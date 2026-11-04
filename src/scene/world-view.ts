import type { World, WorldView } from "../rail";

type WorldOnlyKey = Exclude<keyof World, keyof WorldView>;

/** A record, not a list, so a new `World` member fails to compile until added. */
const WORLD_ONLY_KEYS: Readonly<Record<WorldOnlyKey, true>> = {
  speedIndex: true,
  userStopped: true,
  textPaused: true,
  update: true,
  toggleStop: true,
  setSpeed: true,
  setLivery: true,
};

/**
 * What scenes get instead of the world. A cast compiles but finds nothing to
 * reach: `World`'s own members throw, which counts as a failed load, and the
 * frozen object rejects the `world.hitTrain = …` that `concepts/b/render.js` does.
 */
export function createWorldView(world: World): WorldView {
  const view: WorldView = {
    get letters() {
      return world.letters;
    },
    get bridge() {
      return world.bridge;
    },
    get portals() {
      return world.portals;
    },
    get tunnels() {
      return world.tunnels;
    },
    get stations() {
      return world.stations;
    },
    get time() {
      return world.time;
    },
    get textTime() {
      return world.textTime;
    },
    get cars() {
      return world.cars;
    },
    get people() {
      return world.people;
    },
    get puffs() {
      return world.puffs;
    },
    get livery() {
      return world.livery;
    },
    get liveryId() {
      return world.liveryId;
    },
    get trainLength() {
      return world.trainLength;
    },
    pointAt: (s) => world.pointAt(s),
    elevationAt: (point) => world.elevationAt(point),
    hitTrain: (x, y, radius) => world.hitTrain(x, y, radius),
  };

  for (const key of Object.keys(WORLD_ONLY_KEYS)) {
    Object.defineProperty(view, key, {
      get() {
        throw new Error(
          `A scene used world.${key}, which is not in WorldView.`,
        );
      },
    });
  }
  return Object.freeze(view);
}
