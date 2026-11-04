/**
 * Public API of the train engine. Part of the theme contract
 * (docs/rfcs/theme-contract.md): changing anything here follows its change
 * procedure. Nothing in this file may name a DOM type.
 */

export type LiveryId = "metro" | "bullet" | "steam" | "heritage" | "toy";
export type CarKind = "loco" | "cab" | "coach" | "tender" | "nose";

/** `[kind, length, drawnBackwards]`. */
export type CarSpec = readonly [kind: CarKind, length: number, rev?: boolean];

export interface LiveryColors {
  readonly body: string;
  readonly trim: string;
  readonly window: string;
  readonly roof: string;
  readonly accent: string;
  readonly coach?: string;
  readonly coach2?: string;
  readonly coachRoof?: string;
}

export interface Livery {
  readonly cars: readonly CarSpec[];
  readonly gap: number;
  readonly smoke?: boolean;
  readonly colors: LiveryColors;
}

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

/** Tunnel mouth a car is clipped against. `n` points away from the tunnel. */
export interface PortalClip extends WorldPoint {
  readonly nx: number;
  readonly ny: number;
}

/** A point along a segment, with its heading in radians. */
export interface SegmentPoint extends WorldPoint {
  readonly a: number;
}

/** A segment point that knows its segment, which `elevationAt` needs. */
export interface TrackPoint extends SegmentPoint {
  readonly seg: RouteSegment;
}

export type SegmentKind = "track" | "bridge" | "tunnel";

interface SegmentBase {
  readonly kind: SegmentKind;
  readonly len: number;
  /** Point at distance `d` along the segment; null while fully underground. */
  at(d: number): SegmentPoint | null;
}

export interface LineSegment extends SegmentBase {
  readonly type: "line";
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  at(d: number): SegmentPoint;
}

export interface ArcSegment extends SegmentBase {
  readonly type: "arc";
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly t0: number;
  readonly t1: number;
  at(d: number): SegmentPoint;
}

/** A tunnel end: where it is, and the unit direction of travel through it. */
export interface TunnelEnd extends WorldPoint {
  readonly dx: number;
  readonly dy: number;
}

export interface TunnelSegment extends SegmentBase {
  readonly type: "tunnel";
  readonly from: TunnelEnd;
  readonly to: TunnelEnd;
}

/** Segments that are always above ground, so they can be sampled and stroked. */
export type DrawnSegment = LineSegment | ArcSegment;
export type RouteSegment = DrawnSegment | TunnelSegment;

export interface Letter {
  readonly ch: string;
  readonly x: number;
  readonly parts: readonly DrawnSegment[];
}

export interface Tunnel {
  readonly from: TunnelEnd;
  readonly to: TunnelEnd;
}

export type Platform =
  | {
      readonly type: "rect";
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
    }
  | {
      readonly type: "circle";
      readonly cx: number;
      readonly cy: number;
      readonly r: number;
    };

export interface Station extends WorldPoint {
  readonly id: string;
  /** Distance along the route. */
  readonly s: number;
  readonly a: number;
  readonly cx: number;
  readonly cy: number;
  readonly platform: Platform;
  readonly elevated?: boolean;
}

export interface Passenger {
  readonly color: string;
  readonly skin: string;
}

export interface Car extends WorldPoint {
  readonly i: number;
  readonly kind: CarKind;
  readonly len: number;
  readonly rev: boolean;
  readonly a: number;
  readonly hidden: boolean;
  readonly clip: PortalClip | null;
  /** Height above the ground, for the bridge. */
  readonly z: number;
  readonly pitch?: number;
  readonly passengers: readonly Passenger[];
}

export interface Person extends WorldPoint {
  readonly color: string;
  readonly skin: string;
  readonly station: Station;
  readonly alpha: number;
  readonly phase: number;
  readonly moving?: boolean;
}

export interface Puff extends WorldPoint {
  readonly z: number;
  readonly r: number;
  readonly life: number;
  readonly max: number;
}

/** What a scene may see of the shared world, which is only what scenes read. */
export interface WorldView {
  readonly letters: readonly Letter[];
  readonly bridge: readonly DrawnSegment[];
  readonly portals: readonly TunnelEnd[];
  readonly tunnels: readonly Tunnel[];
  readonly stations: readonly Station[];

  /** Seconds the world has been stepped. Animate from it, not billboard text. */
  readonly time: number;
  /**
   * The clock billboard text rolls on. It stops only when the visitor pauses the
   * text, so it keeps rolling while a reduced-motion visitor's train starts
   * stopped.
   */
  readonly textTime: number;

  readonly cars: readonly Car[];
  readonly people: readonly Person[];
  readonly puffs: readonly Puff[];
  readonly livery: Livery;
  readonly liveryId: LiveryId;
  readonly trainLength: number;

  /** Null while the point is underground. */
  pointAt(s: number): TrackPoint | null;
  elevationAt(point: TrackPoint): number;
  /**
   * Is the world-space point within `radius` of a visible car? Top-down themes
   * use it from `Scene.hitTrain`; a projected theme writes its own there. A
   * readonly property, so replacing it on the shared world fails to compile.
   */
  readonly hitTrain: (x: number, y: number, radius: number) => boolean;
}

/** The only ways to change the world. Called by the scene runtime. */
export interface WorldControls {
  /**
   * Sets `userStopped` and `textPaused` together, to `force` if given, otherwise
   * to `!textPaused`. So the first press on a `startStopped` world pauses the
   * text and leaves the train stopped.
   */
  toggleStop(force?: boolean): void;
  /** Also starts the train and the text. */
  setSpeed(index: number): void;
  /** An unknown id falls back to `DEFAULT_LIVERY`. */
  setLivery(id: string): void;
}

/** The whole engine object. Only the scene runtime ever holds this type. */
export interface World extends WorldView, WorldControls {
  readonly speedIndex: number;
  readonly userStopped: boolean;
  /** True once the visitor stops things, false once they start them. */
  readonly textPaused: boolean;
  /** Advances the simulation. Bad frame times are clamped to 0 to 0.05 s. */
  update(dtSeconds: number): void;
}

export interface CreateWorldOptions {
  readonly seed: number;
  /** An unknown id falls back to `DEFAULT_LIVERY`. */
  readonly livery: string;
  /** Stops the train but not the text: `textPaused` still starts false. */
  readonly startStopped: boolean;
}

/**
 * The part of a 2D canvas context the billboard helpers use, so text
 * measurement is passed in and `rail/` needs no DOM. A real
 * `CanvasRenderingContext2D` satisfies it.
 */
export interface TextCanvas {
  font: string;
  fillStyle: string | object;
  measureText(text: string): { readonly width: number };
  fillText(text: string, x: number, y: number): void;
}

export interface MarqueeSegment {
  readonly text: string;
  readonly font: string;
  readonly color: string;
}

export interface MarqueeOptions {
  /** Left edge of the window the text rolls through. */
  readonly x: number;
  readonly baseline: number;
  readonly width: number;
  /** Pass `world.textTime`. */
  readonly time: number;
  /** World units per second. */
  readonly speed: number;
}

export interface NowCycleState {
  readonly index: number;
  /** Fades at the item edges; always 1 for a single item. */
  readonly alpha: number;
}

export type CreateWorld = (options: CreateWorldOptions) => World;
/** Points along a segment, each knowing its segment. */
export type Sample = (
  segment: DrawnSegment,
  step?: number,
) => readonly TrackPoint[];
/** Rolls one string. The caller sets font and colour, and clips to the window. */
export type Marquee = (
  canvas: TextCanvas,
  text: string,
  options: MarqueeOptions,
) => void;
/** Rolls mixed-font segments as one loop. The caller clips to the window. */
export type MarqueeSegments = (
  canvas: TextCanvas,
  segments: readonly MarqueeSegment[],
  options: MarqueeOptions,
) => void;
/** Which of `count` items shows at `time`, each lasting `period` seconds. */
export type NowCycle = (
  time: number,
  count: number,
  period?: number,
) => NowCycleState;
