import { describe, expect, it } from "vitest";
import { bridge, letters, tunnels } from "../../rail/route";
import type { DrawnSegment } from "../../rail/types";
import { TUNNEL_CONTROL_REACH } from "./map-view";
import { STATIC_MAP_PATHS } from "./static-map";

/** The paths are written to two decimal places. */
const WRITTEN_PRECISION = 0.01;
const FULL_TURN = Math.PI * 2;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface PathCommand {
  readonly letter: string;
  readonly numbers: readonly number[];
}

/** Each `M` starts a new stroke, as `tracePath` starts one for each track segment. */
function parseStrokes(path: string): PathCommand[][] {
  const commands = [...path.matchAll(/([MLAC])([^MLAC]*)/g)].map(
    ([, letter, numbers]) => ({
      letter,
      numbers: numbers.trim().split(/\s+/).map(Number),
    }),
  );
  return commands.reduce<PathCommand[][]>((strokes, command) => {
    if (command.letter === "M") strokes.push([command]);
    else strokes.at(-1)?.push(command);
    return strokes;
  }, []);
}

function expectAt(actual: Point, expected: Point, what: string): void {
  expect(
    Math.hypot(actual.x - expected.x, actual.y - expected.y),
    `${what}: (${actual.x}, ${actual.y}) should be (${expected.x}, ${expected.y})`,
  ).toBeLessThanOrEqual(WRITTEN_PRECISION);
}

const pointOf = ([x, y]: readonly number[]): Point => ({ x, y });

function expectStrokeFollowsLine(
  stroke: readonly PathCommand[],
  segment: Extract<DrawnSegment, { type: "line" }>,
  what: string,
): void {
  expect(stroke.map(({ letter }) => letter)).toEqual(["M", "L"]);
  expectAt(pointOf(stroke[0].numbers), { x: segment.x0, y: segment.y0 }, what);
  expectAt(pointOf(stroke[1].numbers), { x: segment.x1, y: segment.y1 }, what);
}

/** A long arc is written as several, because one SVG arc cannot close a circle. */
function expectStrokeFollowsArc(
  stroke: readonly PathCommand[],
  { cx, cy, r, t0, t1 }: Extract<DrawnSegment, { type: "arc" }>,
  what: string,
): void {
  const onCircle = (angle: number): Point => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });
  const angleOf = ({ x, y }: Point) => Math.atan2(y - cy, x - cx);
  const clockwise = t1 > t0;
  const [move, ...arcs] = stroke;
  let from = pointOf(move.numbers);
  let turned = 0;

  expectAt(from, onCircle(t0), `${what} start`);
  for (const { letter, numbers } of arcs) {
    const [radiusX, radiusY, , largeArc, sweep, x, y] = numbers;
    const to = { x, y };
    expect(letter).toBe("A");
    expect([radiusX, radiusY]).toEqual([r, r]);
    expect(largeArc).toBe(0);
    expect(sweep).toBe(clockwise ? 1 : 0);
    expect(Math.abs(Math.hypot(x - cx, y - cy) - r)).toBeLessThanOrEqual(
      WRITTEN_PRECISION,
    );
    const step = clockwise
      ? angleOf(to) - angleOf(from)
      : angleOf(from) - angleOf(to);
    turned += ((step % FULL_TURN) + FULL_TURN) % FULL_TURN;
    from = to;
  }
  expectAt(from, onCircle(t1), `${what} end`);
  expect(turned).toBeCloseTo(Math.abs(t1 - t0), 2);
}

function expectPathFollowsSegments(
  path: string,
  segments: readonly DrawnSegment[],
  what: string,
): void {
  const strokes = parseStrokes(path);
  expect(strokes.length, `${what}: one stroke per segment`).toBe(
    segments.length,
  );
  segments.forEach((segment, index) => {
    const label = `${what}, segment ${index}`;
    if (segment.type === "line") {
      expectStrokeFollowsLine(strokes[index], segment, label);
    } else {
      expectStrokeFollowsArc(strokes[index], segment, label);
    }
  });
}

describe("the static hero's map", () => {
  it("draws each letter along the track, in the track's order", () => {
    expect(STATIC_MAP_PATHS.letters.length).toBe(letters.length);
    letters.forEach(({ ch, parts }, index) => {
      expectPathFollowsSegments(
        STATIC_MAP_PATHS.letters[index],
        parts,
        `letter ${index} (${ch})`,
      );
    });
  });

  it("draws the bridge along the track", () => {
    expectPathFollowsSegments(STATIC_MAP_PATHS.bridge, bridge, "the bridge");
  });

  it("draws each tunnel as the scene curves it", () => {
    expect(STATIC_MAP_PATHS.tunnels.length).toBe(tunnels.length);
    tunnels.forEach(({ from, to }, index) => {
      const [stroke] = parseStrokes(STATIC_MAP_PATHS.tunnels[index]);
      const [move, curve] = stroke;
      const what = `tunnel ${index}`;
      expect(stroke.map(({ letter }) => letter)).toEqual(["M", "C"]);
      expectAt(pointOf(move.numbers), from, `${what} start`);
      expectAt(
        pointOf(curve.numbers.slice(0, 2)),
        {
          x: from.x + from.dx * TUNNEL_CONTROL_REACH,
          y: from.y + from.dy * TUNNEL_CONTROL_REACH,
        },
        `${what} first control`,
      );
      expectAt(
        pointOf(curve.numbers.slice(2, 4)),
        {
          x: to.x - to.dx * TUNNEL_CONTROL_REACH,
          y: to.y - to.dy * TUNNEL_CONTROL_REACH,
        },
        `${what} second control`,
      );
      expectAt(pointOf(curve.numbers.slice(4)), to, `${what} end`);
    });
  });
});
