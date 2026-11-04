/** The four stations. Shared by every world, so they hold no per-world state. */
import { TAU } from "./geometry";
import type { Random } from "./random";
import { pointAt, ROUTE_SEGMENT, routeDistance } from "./route";
import type { Platform, Station, WorldPoint } from "./types";

// How far along its segment each station puts the front of the train, which
// leaves the train alongside the platform.
const H_STEM_HALT_DISTANCE = 154;
const BRIDGE_SPAN_HALT_DISTANCE = 300;
const BOWL_RADIUS = 50;
const HALF_WAY_ROUND_BOWL = Math.PI * BOWL_RADIUS;

interface StationPlan {
  readonly id: string;
  readonly s: number;
  readonly platform: Platform;
  readonly elevated?: boolean;
}

const STATION_PLANS: readonly StationPlan[] = [
  {
    id: "stem",
    s: routeDistance(ROUTE_SEGMENT.hStem, H_STEM_HALT_DISTANCE),
    platform: { type: "rect", x: 113, y: 52, w: 18, h: 78 },
  },
  {
    id: "sky",
    s: routeDistance(ROUTE_SEGMENT.bridgeSpan, BRIDGE_SPAN_HALT_DISTANCE),
    platform: { type: "rect", x: 372, y: 7, w: 100, h: 11 },
    elevated: true,
  },
  {
    id: "dbowl",
    s: routeDistance(ROUTE_SEGMENT.dBowl, HALF_WAY_ROUND_BOWL),
    platform: { type: "circle", cx: 670, cy: 150, r: 29 },
  },
  {
    id: "abowl",
    s: routeDistance(ROUTE_SEGMENT.secondABowl, HALF_WAY_ROUND_BOWL),
    platform: { type: "circle", cx: 530, cy: 150, r: 29 },
  },
];

function platformCenter(platform: Platform): WorldPoint {
  return platform.type === "rect"
    ? { x: platform.x + platform.w / 2, y: platform.y + platform.h / 2 }
    : { x: platform.cx, y: platform.cy };
}

export const stations: readonly Station[] = STATION_PLANS.map((plan) => {
  const point = pointAt(plan.s);
  if (!point) throw new Error(`Station ${plan.id} is underground.`);
  const center = platformCenter(plan.platform);
  return {
    ...plan,
    x: point.x,
    y: point.y,
    a: point.a,
    cx: center.x,
    cy: center.y,
  };
});

/** A random spot on a platform, at least `padding` inside its edge. */
export function randomSpotOn(
  platform: Platform,
  random: Random,
  padding: number,
): WorldPoint {
  if (platform.type === "rect") {
    return {
      x: platform.x + padding + random() * (platform.w - padding * 2),
      y: platform.y + padding + random() * (platform.h - padding * 2),
    };
  }
  const angle = random() * TAU;
  const radius = Math.sqrt(random()) * (platform.r - padding);
  return {
    x: platform.cx + Math.cos(angle) * radius,
    y: platform.cy + Math.sin(angle) * radius,
  };
}
