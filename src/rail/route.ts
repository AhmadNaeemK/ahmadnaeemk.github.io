/** The letters as drawn, and the one closed loop the train runs through them. */
import { arc, line, TAU, tunnel, type PortalTunnel } from "./geometry";
import type {
  DrawnSegment,
  Letter,
  PortalClip,
  TrackPoint,
  Tunnel,
  TunnelEnd,
} from "./types";

const PI = Math.PI;
const BRIDGE_HEIGHT = 16;
const BRIDGE_EASED_HEIGHT = 0.55;
const BRIDGE_RAMP_LENGTH = 90;
const BRIDGE_LEFT_X = 160;
const BRIDGE_RIGHT_X = 700;
const BRIDGE_END_RADIUS = 20;
const BRIDGE_FOOT_LEFT_X = BRIDGE_LEFT_X - BRIDGE_END_RADIUS;
const BRIDGE_FOOT_RIGHT_X = BRIDGE_RIGHT_X + BRIDGE_END_RADIUS;
const WORLD_MID_X = 400;

/** A route point. `portal` is set near a tunnel mouth. */
interface RoutePoint extends TrackPoint {
  readonly portal?: PortalClip;
}

export const letters: readonly Letter[] = [
  {
    ch: "a",
    x: 0,
    parts: [line(100, 100, 100, 200), arc(50, 150, 50, 0, TAU)],
  },
  {
    ch: "h",
    x: 140,
    parts: [
      line(140, 20, 140, 200),
      arc(190, 150, 50, PI, TAU),
      line(240, 150, 240, 200),
    ],
  },
  {
    ch: "m",
    x: 280,
    parts: [
      line(280, 140, 280, 200),
      arc(320, 140, 40, PI, TAU),
      line(360, 140, 360, 200),
      arc(400, 140, 40, PI, TAU),
      line(440, 140, 440, 200),
    ],
  },
  {
    ch: "a",
    x: 480,
    parts: [line(580, 100, 580, 200), arc(530, 150, 50, 0, TAU)],
  },
  {
    ch: "d",
    x: 620,
    parts: [line(720, 20, 720, 200), arc(670, 150, 50, 0, TAU)],
  },
];

export const bridge: readonly DrawnSegment[] = [
  arc(
    BRIDGE_LEFT_X,
    BRIDGE_END_RADIUS,
    BRIDGE_END_RADIUS,
    PI,
    PI * 1.5,
    "bridge",
  ),
  line(BRIDGE_LEFT_X, 0, BRIDGE_RIGHT_X, 0, "bridge"),
  arc(
    BRIDGE_RIGHT_X,
    BRIDGE_END_RADIUS,
    BRIDGE_END_RADIUS,
    PI * 1.5,
    TAU,
    "bridge",
  ),
];

const heading = {
  up: (x: number, y: number): TunnelEnd => ({ x, y, dx: 0, dy: -1 }),
  down: (x: number, y: number): TunnelEnd => ({ x, y, dx: 0, dy: 1 }),
};

const route: readonly (DrawnSegment | PortalTunnel)[] = [
  line(100, 200, 100, 150),
  arc(50, 150, 50, 0, -TAU),
  line(100, 150, 100, 100),
  tunnel(heading.up(100, 100), heading.up(140, 200)),
  line(140, 200, 140, 20),
  ...bridge,
  line(720, 20, 720, 150),
  arc(670, 150, 50, 0, TAU),
  line(720, 150, 720, 200),
  tunnel(heading.down(720, 200), heading.up(580, 200)),
  line(580, 200, 580, 150),
  arc(530, 150, 50, 0, -TAU),
  line(580, 150, 580, 100),
  tunnel(heading.up(580, 100), heading.up(440, 200)),
  line(440, 200, 440, 140),
  arc(400, 140, 40, 0, -PI),
  line(360, 140, 360, 200),
  tunnel(heading.down(360, 200), heading.up(280, 200)),
  line(280, 200, 280, 140),
  arc(320, 140, 40, PI, TAU),
  line(360, 140, 360, 200),
  tunnel(heading.down(360, 200), heading.up(240, 200)),
  line(240, 200, 240, 150),
  arc(190, 150, 50, 0, -PI),
  line(140, 150, 140, 200),
  tunnel(heading.down(140, 200), heading.up(100, 200)),
];

/** Where in `route` the segments that hold a station are. */
export const ROUTE_SEGMENT = {
  hStem: 4,
  bridgeSpan: 6,
  dBowl: 9,
  secondABowl: 13,
} as const;

const segmentStarts: readonly number[] = route.reduce<number[]>(
  (starts, _segment, i) =>
    i === 0 ? [0] : [...starts, starts[i - 1] + route[i - 1].len],
  [],
);

/** Length of the whole loop. */
export const ROUTE_LENGTH = route.reduce((sum, { len }) => sum + len, 0);

/** Route distance of a point `distance` along the segment at `segmentIndex`. */
export function routeDistance(segmentIndex: number, distance: number): number {
  return segmentStarts[segmentIndex] + distance;
}

function segmentIndexAt(s: number): number {
  let low = 0;
  let high = route.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (segmentStarts[middle] <= s) low = middle;
    else high = middle - 1;
  }
  return low;
}

/** Any distance works, including negative ones. Null while underground. */
export function pointAt(s: number): RoutePoint | null {
  const wrapped = ((s % ROUTE_LENGTH) + ROUTE_LENGTH) % ROUTE_LENGTH;
  const index = segmentIndexAt(wrapped);
  const segment = route[index];
  const point = segment.at(wrapped - segmentStarts[index]);
  return point && { ...point, seg: segment };
}

/** Height above the ground: full along the bridge span, easing on its ends. */
export function elevationAt({ seg, x }: TrackPoint): number {
  if (seg.kind !== "bridge") return 0;
  if (seg.type === "line") {
    const fromEnd = Math.min(x - BRIDGE_LEFT_X, BRIDGE_RIGHT_X - x);
    return (
      BRIDGE_HEIGHT *
      Math.min(1, BRIDGE_EASED_HEIGHT + fromEnd / BRIDGE_RAMP_LENGTH)
    );
  }
  const fromFoot =
    (x < WORLD_MID_X ? x - BRIDGE_FOOT_LEFT_X : BRIDGE_FOOT_RIGHT_X - x) /
    BRIDGE_END_RADIUS;
  return (
    BRIDGE_HEIGHT * BRIDGE_EASED_HEIGHT * Math.max(0, Math.min(1, fromFoot))
  );
}

export const tunnels: readonly Tunnel[] = route.flatMap((segment) =>
  segment.type === "tunnel" ? [{ from: segment.from, to: segment.to }] : [],
);

/** Each tunnel mouth once, with its direction pointing into the tunnel. */
export const portals: readonly TunnelEnd[] = tunnels
  .flatMap(({ from, to }): TunnelEnd[] => [
    from,
    { x: to.x, y: to.y, dx: -to.dx, dy: -to.dy },
  ])
  .filter(
    (portal, i, all) =>
      all.findIndex(({ x, y }) => x === portal.x && y === portal.y) === i,
  );
