// The fixed parts of the world, which a frame-by-frame ride only partly reaches:
// the train never reads the letters, and renderers read little else.
import { describe, expect, it } from "vitest";
import { createWorld, LIVERY_ORDER, sample } from "./index";
import { loadPrototype } from "./prototype-testkit";

/** Plain data, because the prototype's objects come from another realm. */
function plain<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value));
}

function headingOf({ x, y, a }: { x: number; y: number; a: number }) {
  return { x, y, a };
}

describe("the engine's fixed world matches the prototype's", () => {
  const prototypeEngine = loadPrototype();
  const options = { seed: 11, livery: "metro", startStopped: false };
  const prototype = prototypeEngine.createWorld(options);
  const engine = createWorld(options);

  it.each(["letters", "bridge", "tunnels", "portals", "stations"] as const)(
    "has the same %s",
    (name) => {
      expect(plain(engine[name])).toEqual(plain(prototype[name]));
    },
  );

  it("has the same point at every distance along the route, off both ends", () => {
    const { total } = prototype;
    for (let s = -total / 2; s < total * 1.5; s += 0.37) {
      const enginePoint = engine.pointAt(s);
      const prototypePoint = prototype.pointAt(s);
      expect(enginePoint && headingOf(enginePoint)).toEqual(
        prototypePoint && headingOf(prototypePoint),
      );
      expect(enginePoint?.seg.kind).toBe(prototypePoint?.seg.kind);
    }
  });

  it("has the same height along the bridge", () => {
    for (const segment of engine.bridge) {
      const prototypeSegment = prototype.bridge[engine.bridge.indexOf(segment)];
      for (const point of sample(segment)) {
        expect(engine.elevationAt(point)).toBe(
          prototype.elevationAt({ ...point, seg: prototypeSegment }),
        );
      }
    }
  });

  it("samples every drawn segment at the same points", () => {
    const segments = engine.letters.flatMap(({ parts }) => parts);
    const prototypeSegments = prototype.letters.flatMap(({ parts }) => parts);
    segments.forEach((segment, i) => {
      expect(sample(segment, 3).map(headingOf)).toEqual(
        prototypeEngine.sample(prototypeSegments[i], 3).map(headingOf),
      );
    });
  });

  it.each(LIVERY_ORDER)("has the same %s livery", (id) => {
    const { livery } = createWorld({ ...options, livery: id });

    expect(plain(livery)).toEqual(
      plain({ ...prototypeEngine.LIVERIES[id], name: undefined }),
    );
  });
});
