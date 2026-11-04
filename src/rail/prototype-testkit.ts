/**
 * The prototype, for the suites that compare the engine with it. Importing this
 * reads `design/`, so keep it out of anything that does not need the prototype.
 */
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import type { CreateWorldOptions, LiveryId, World, WorldView } from "./index";

/** The controls the engine and the prototype share, with forced toggles only. */
export type SharedControls = Pick<
  World,
  "toggleStop" | "setSpeed" | "setLivery"
>;

interface PrototypeStation {
  readonly id: string;
  readonly s: number;
}

/** The prototype world, as much of it as the tests read. */
export interface PrototypeWorld extends SharedControls {
  readonly time: number;
  readonly speedIndex: number;
  readonly userStopped: boolean;
  readonly liveryId: string;
  readonly trainLength: number;
  readonly head: number;
  readonly total: number;
  readonly v: number;
  readonly mode: "run" | "dwell";
  readonly dwell: number;
  readonly lastStation: PrototypeStation | null;
  readonly stations: readonly PrototypeStation[];
  readonly letters: WorldView["letters"];
  readonly bridge: WorldView["bridge"];
  readonly tunnels: WorldView["tunnels"];
  readonly portals: WorldView["portals"];
  readonly livery: WorldView["livery"];
  readonly cars: WorldView["cars"];
  readonly people: WorldView["people"];
  readonly puffs: WorldView["puffs"];
  pointAt: WorldView["pointAt"];
  elevationAt: WorldView["elevationAt"];
  update(dtSeconds: number): void;
}

export interface PrototypeEngine {
  createWorld(options: CreateWorldOptions): PrototypeWorld;
  sample(
    segment: WorldView["bridge"][number],
    step?: number,
  ): readonly { x: number; y: number; a: number }[];
  LIVERIES: Readonly<Record<LiveryId, WorldView["livery"]>>;
}

const prototypeScript = new Script(
  readFileSync(
    new URL("../../design/train-concepts/shared/engine.js", import.meta.url),
    "utf8",
  ),
  { filename: "design/train-concepts/shared/engine.js" },
);

/**
 * A fresh copy each time, because the prototype keeps spawn timers on stations
 * it shares between its worlds.
 */
export function loadPrototype(): PrototypeEngine {
  const sandbox = {
    window: {} as { RailWorld?: PrototypeEngine },
    matchMedia: () => ({ matches: false }),
  };
  prototypeScript.runInNewContext(sandbox);
  const engine = sandbox.window.RailWorld;
  if (!engine) throw new Error("The prototype did not load.");
  return engine;
}

/**
 * The contract's change from the prototype: a stopped train at rest holds the
 * whole scene, so the prototype's update has to be skipped to compare them.
 */
export function stepPrototype(world: PrototypeWorld, seconds: number): void {
  if (world.userStopped && world.v === 0) return;
  world.update(seconds);
}

/** How far ahead the next station is, which the engine keeps private. */
export function distanceToNextStation(world: PrototypeWorld): number {
  const distances = world.stations
    .filter((station) => station !== world.lastStation)
    .map(({ s }) => (s - world.head + world.total) % world.total);
  return Math.min(...distances);
}

/**
 * A press this close stops the train at the station rather than short of it.
 * Anywhere further, user braking outruns the approach curve.
 */
export const BRAKING_ARRIVAL_DISTANCE = 0.07;

function differenceInFields(
  path: string,
  engine: object,
  prototype: object,
  names: readonly string[],
): string | null {
  const engineFields = engine as Record<string, unknown>;
  const prototypeFields = prototype as Record<string, unknown>;
  for (const name of names) {
    if (engineFields[name] !== prototypeFields[name]) {
      return `${path}.${name}: engine ${engineFields[name]}, prototype ${prototypeFields[name]}`;
    }
  }
  return null;
}

function differenceInLists<Item extends object>(
  path: string,
  engine: readonly Item[],
  prototype: readonly Item[],
  differenceInItem: (path: string, e: Item, p: Item) => string | null,
): string | null {
  if (engine.length !== prototype.length) {
    return `${path}.length: engine ${engine.length}, prototype ${prototype.length}`;
  }
  for (let i = 0; i < engine.length; i += 1) {
    const difference = differenceInItem(
      `${path}[${i}]`,
      engine[i],
      prototype[i],
    );
    if (difference) return difference;
  }
  return null;
}

const CAR_FIELDS = "i kind len rev x y a hidden z pitch".split(" ");
const CLIP_FIELDS = "x y nx ny".split(" ");
const RIDER_FIELDS = ["color", "skin"];
const PERSON_FIELDS = "x y color skin alpha phase moving".split(" ");
const PUFF_FIELDS = "x y z r life max".split(" ");
const WORLD_FIELDS = "time speedIndex userStopped liveryId trainLength".split(
  " ",
);

/** What a renderer could tell apart, by name. Null when there is nothing. */
export function firstDifference(
  engine: WorldView,
  prototype: PrototypeWorld,
): string | null {
  return (
    differenceInFields("world", engine, prototype, WORLD_FIELDS) ??
    differenceInLists("cars", engine.cars, prototype.cars, (path, e, p) => {
      const clipsMatch = !e.clip && !p.clip;
      return (
        differenceInFields(path, e, p, CAR_FIELDS) ??
        (clipsMatch
          ? null
          : differenceInFields(
              `${path}.clip`,
              e.clip ?? {},
              p.clip ?? {},
              CLIP_FIELDS,
            )) ??
        differenceInLists(
          `${path}.passengers`,
          e.passengers,
          p.passengers,
          (riderPath, er, pr) =>
            differenceInFields(riderPath, er, pr, RIDER_FIELDS),
        )
      );
    }) ??
    differenceInLists(
      "people",
      engine.people,
      prototype.people,
      (path, e, p) =>
        differenceInFields(path, e, p, PERSON_FIELDS) ??
        (e.station.id === p.station.id
          ? null
          : `${path}.station: engine ${e.station.id}, prototype ${p.station.id}`),
    ) ??
    differenceInLists("puffs", engine.puffs, prototype.puffs, (path, e, p) =>
      differenceInFields(path, e, p, PUFF_FIELDS),
    )
  );
}
