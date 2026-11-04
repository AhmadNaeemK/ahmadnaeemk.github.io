/**
 * STUB, replaced by Task 4. A ring of track and a train that goes round it,
 * behind the real engine types, so the shell and themes can run before the
 * engine exists. It has no stations, passengers, tunnels or letters.
 */
import { DEFAULT_LIVERY, isLiveryId, LIVERIES } from "./liveries";
import type {
  ArcSegment,
  Car,
  CreateWorld,
  CreateWorldOptions,
  Livery,
  LiveryId,
  Marquee,
  MarqueeSegments,
  NowCycle,
  Sample,
  Letter,
  SegmentPoint,
  TrackPoint,
  World,
} from "./types";

export const TAU = Math.PI * 2;
export const SPEEDS: readonly number[] = [0.5, 1, 1.6, 2.3];

const CENTER_X = 360;
const CENTER_Y = 100;
const RADIUS = 90;
const CRUISE = 52;
const ACCELERATION = 26;
const MAX_FRAME_SECONDS = 0.05;
const DEFAULT_SAMPLE_STEP = 2;
const CAR_HEIGHT_NONE = 0;

function pointOnRing(distance: number): SegmentPoint {
  const angle = distance / RADIUS;
  return {
    x: CENTER_X + RADIUS * Math.cos(angle),
    y: CENTER_Y + RADIUS * Math.sin(angle),
    a: angle + Math.PI / 2,
  };
}

const ring: ArcSegment = {
  type: "arc",
  kind: "track",
  cx: CENTER_X,
  cy: CENTER_Y,
  r: RADIUS,
  t0: 0,
  t1: TAU,
  len: TAU * RADIUS,
  at: pointOnRing,
};

const ringLetter: Letter = { ch: "o", x: CENTER_X - RADIUS, parts: [ring] };

class StubWorld implements World {
  readonly letters = [ringLetter];
  readonly bridge = [];
  readonly portals = [];
  readonly tunnels = [];
  readonly stations = [];
  readonly people = [];
  readonly puffs = [];

  speedIndex = 1;
  userStopped: boolean;
  time = 0;
  textTime = 0;
  textPaused = false;
  cars: Car[] = [];
  liveryId: LiveryId = DEFAULT_LIVERY;
  livery: Livery = LIVERIES[DEFAULT_LIVERY];
  trainLength = 0;

  #speed: number;
  #head = 0;

  constructor(options: CreateWorldOptions) {
    this.userStopped = options.startStopped;
    this.#speed = options.startStopped ? 0 : CRUISE;
    this.setLivery(options.livery);
  }

  pointAt(s: number): TrackPoint {
    return { ...pointOnRing(s), seg: ring };
  }

  elevationAt(): number {
    return CAR_HEIGHT_NONE;
  }

  hitTrain(x: number, y: number, radius: number): boolean {
    return this.cars.some((car) => Math.hypot(car.x - x, car.y - y) < radius);
  }

  toggleStop(force?: boolean): void {
    const stopped = force ?? !this.textPaused;
    this.userStopped = stopped;
    this.textPaused = stopped;
  }

  setSpeed(index: number): void {
    this.speedIndex = Math.max(0, Math.min(SPEEDS.length - 1, index));
    this.userStopped = false;
    this.textPaused = false;
  }

  setLivery(id: string): void {
    this.liveryId = isLiveryId(id) ? id : DEFAULT_LIVERY;
    this.livery = LIVERIES[this.liveryId];
    this.trainLength =
      this.livery.cars.reduce((sum, [, length]) => sum + length, 0) +
      this.livery.gap * (this.livery.cars.length - 1);
    this.#layOutCars();
  }

  update(dtSeconds: number): void {
    const dt = Math.max(0, Math.min(dtSeconds, MAX_FRAME_SECONDS));
    this.time += dt;
    if (!this.textPaused) this.textTime += dt;
    const target = this.userStopped ? 0 : CRUISE * SPEEDS[this.speedIndex];
    const change = ACCELERATION * dt;
    this.#speed =
      this.#speed < target
        ? Math.min(target, this.#speed + change)
        : Math.max(target, this.#speed - change);
    this.#head = (this.#head + this.#speed * dt) % ring.len;
    this.#layOutCars();
  }

  #layOutCars(): void {
    let front = this.#head;
    this.cars = this.livery.cars.map(([kind, len, rev], i) => {
      const center = pointOnRing(front - len / 2);
      front -= len + this.livery.gap;
      return {
        i,
        kind,
        len,
        rev: Boolean(rev),
        x: center.x,
        y: center.y,
        a: center.a,
        hidden: false,
        clip: null,
        z: CAR_HEIGHT_NONE,
        passengers: [],
      };
    });
  }
}

export const createWorld: CreateWorld = (options) => new StubWorld(options);

export const sample: Sample = (segment, step = DEFAULT_SAMPLE_STEP) => {
  const count = Math.max(2, Math.ceil(segment.len / step));
  return Array.from({ length: count + 1 }, (_, i) => ({
    ...segment.at((segment.len * i) / count),
    seg: segment,
  }));
};

export const marqueeSegments: MarqueeSegments = (canvas, segments, options) => {
  const { x, baseline, width, time, speed } = options;
  const widths = segments.map((segment) => {
    canvas.font = segment.font;
    return canvas.measureText(segment.text).width;
  });
  const span = widths.reduce((sum, segmentWidth) => sum + segmentWidth, 0);
  if (span <= 0) return;
  for (let start = -((time * speed) % span); start < width; start += span) {
    let cursor = x + start;
    segments.forEach((segment, i) => {
      canvas.font = segment.font;
      canvas.fillStyle = segment.color;
      canvas.fillText(segment.text, cursor, baseline);
      cursor += widths[i];
    });
  }
};

export const marquee: Marquee = (canvas, text, options) => {
  const { x, baseline, width, time, speed } = options;
  const span = canvas.measureText(`${text}      `).width;
  if (span <= 0) return;
  for (let start = -((time * speed) % span); start < width; start += span) {
    canvas.fillText(text, x + start, baseline);
  }
};

export const nowCycle: NowCycle = (time, count, period = 5) => {
  const phase = Math.max(0, time) / period;
  const fraction = phase - Math.floor(phase);
  const edge = 0.1;
  const fade =
    fraction < edge
      ? fraction / edge
      : fraction > 1 - edge
        ? (1 - fraction) / edge
        : 1;
  return {
    index: Math.floor(phase) % Math.max(1, count),
    alpha: count > 1 ? fade : 1,
  };
};
