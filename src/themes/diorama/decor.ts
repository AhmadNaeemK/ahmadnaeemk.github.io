/** The scenery that stands among the train: curated positions, seeded details. */
import type { TunnelEnd, WorldView } from "../../rail";
import { TREE_COLOR_COUNT, type RoofColor } from "./palette";
import { GROUND_PLATFORM_HEIGHT, seededRandom } from "./view";

export interface Planted {
  readonly type: "tree" | "bush";
  readonly x: number;
  readonly y: number;
  readonly size: number;
  /** Indexes into `palette.trees`, so a change of scheme reaches them. */
  readonly color: number;
  readonly crown: number;
}
export interface House {
  readonly type: "house";
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly roof: RoofColor;
}
export interface Lamp {
  readonly type: "lamp";
  readonly x: number;
  readonly y: number;
}
export interface Canopy {
  readonly type: "canopy";
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly d: number;
  readonly z: number;
  readonly h: number;
}
export interface Kiosk {
  readonly type: "kiosk";
  readonly x: number;
  readonly y: number;
}
interface Hill {
  readonly type: "hill";
  /** Where it sorts among the other scenery. */
  readonly y: number;
  readonly portal: TunnelEnd;
}
export type Decor = Planted | House | Lamp | Canopy | Kiosk | Hill;

const PLANT_SPOTS = [
  [188, 52], [236, 78], [340, 36], [462, 72], [516, 42], [552, 84], [640, 52],
  [684, 86], [-28, 120], [-22, 196], [752, 150], [748, 208], [200, 232],
  [322, 236], [408, 228], [498, 234], [538, 224], [652, 234], [-10, 30], [760, 40],
] as const; // prettier-ignore
const BUSH_SPOTS = { from: 12, to: 18 } as const;
const PLANT_SEED = 99;

const HOUSES: readonly House[] = [
  { type: "house", x: 298, y: 66, w: 26, d: 14, h: 11, roof: "brick" },
  { type: "house", x: 404, y: 58, w: 20, d: 13, h: 9, roof: "plum" },
  { type: "house", x: 600, y: 64, w: 22, d: 13, h: 10, roof: "cobalt" },
];
const STATION_FURNITURE: readonly (Lamp | Canopy | Kiosk)[] = [
  { type: "lamp", x: 107, y: 46 },
  { type: "lamp", x: 366, y: 16 },
  { type: "lamp", x: 106, y: 140 },
  {
    type: "canopy",
    x: 116,
    y: 88,
    w: 13,
    d: 13,
    z: GROUND_PLATFORM_HEIGHT,
    h: 11,
  },
  { type: "kiosk", x: 670, y: 150 },
  { type: "kiosk", x: 530, y: 150 },
];

/** Portals facing the viewer: their hills go in front of everything else. */
export const topPortalsOf = (world: WorldView) =>
  world.portals.filter((portal) => portal.dy < -0.5);

export function buildDecor(world: WorldView): readonly Decor[] {
  const random = seededRandom(PLANT_SEED);
  const pickColor = () => Math.floor(random() * TREE_COLOR_COUNT);
  const plants = PLANT_SPOTS.map(([x, y], index): Planted => {
    const isBush = index >= BUSH_SPOTS.from && index < BUSH_SPOTS.to;
    return {
      type: isBush ? "bush" : "tree",
      x,
      y,
      size: 0.85 + random() * 0.4,
      color: pickColor(),
      crown: pickColor(),
    };
  });
  const hills = world.portals
    .filter((portal) => portal.dy > 0.5)
    .map((portal): Hill => ({ type: "hill", y: portal.y + 40, portal }));
  return [...plants, ...HOUSES, ...STATION_FURNITURE, ...hills];
}
