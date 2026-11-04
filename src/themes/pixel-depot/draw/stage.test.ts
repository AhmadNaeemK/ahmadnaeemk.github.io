import { describe, expect, it } from "vitest";
import {
  canvasToWorld,
  viewForSize,
  worldToBufferX,
  worldToBufferY,
} from "./stage";

const WORLD_WIDTH = 768;

const sizeOf = (width: number, compact: boolean, devicePixelRatio = 1) => ({
  width,
  compact,
  devicePixelRatio,
});

describe("viewForSize", () => {
  it.each([
    { width: 519, pixelSize: 1 },
    { width: 520, pixelSize: 2 },
    { width: 899, pixelSize: 2 },
    { width: 900, pixelSize: 3 },
  ])("draws $pixelSize CSS px per buffer pixel at $width px", (expected) => {
    const view = viewForSize(sizeOf(expected.width, false));
    expect(view.pixelSize).toBe(expected.pixelSize);
  });

  it("never draws wider than the space it was given, by less than one buffer pixel", () => {
    for (let width = 200; width <= 1400; width += 1) {
      const { bufferWidth, pixelSize } = viewForSize(sizeOf(width, false));
      const cssWidth = bufferWidth * pixelSize;
      expect(cssWidth).toBeLessThanOrEqual(width);
      expect(width - cssWidth).toBeLessThan(pixelSize);
    }
  });

  it("does not change with the device pixel ratio, so a buffer pixel stays whole", () => {
    expect(viewForSize(sizeOf(1124, false, 2))).toEqual(
      viewForSize(sizeOf(1124, false, 1)),
    );
  });

  it("always shows the same world width, however many pixels it has", () => {
    for (const width of [320, 700, 1124]) {
      const { bufferWidth, scale } = viewForSize(sizeOf(width, false));
      expect(bufferWidth / scale).toBeCloseTo(WORLD_WIDTH);
    }
  });

  it("gives a full view more height than a compact one, for the billboard", () => {
    const full = viewForSize(sizeOf(800, false));
    const compact = viewForSize(sizeOf(800, true));
    expect(full.bufferHeight).toBeGreaterThan(compact.bufferHeight);
    expect(full.worldTop).toBeLessThan(compact.worldTop);
  });
});

describe("canvasToWorld", () => {
  /** A CSS point on the canvas back from the world point it maps to. */
  const roundTrip = (
    size: { width: number; compact: boolean },
    point: { x: number; y: number },
  ) => {
    const view = viewForSize(sizeOf(size.width, size.compact));
    const world = canvasToWorld(view, point);
    return {
      x: worldToBufferX(view, world.x) * view.pixelSize,
      y: worldToBufferY(view, world.y) * view.pixelSize,
    };
  };

  it.each([
    { width: 264, compact: true },
    { width: 519, compact: true },
    { width: 644, compact: false },
    { width: 1124, compact: false },
  ])("lands back on the same CSS point at $width px", (size) => {
    const point = { x: 123.5, y: 47.25 };
    const back = roundTrip(size, point);
    expect(back.x).toBeCloseTo(point.x);
    expect(back.y).toBeCloseTo(point.y);
  });

  it("maps the canvas's corners to the ends of the view", () => {
    const view = viewForSize(sizeOf(1124, false));
    const topLeft = canvasToWorld(view, { x: 0, y: 0 });
    const right = canvasToWorld(view, {
      x: view.bufferWidth * view.pixelSize,
      y: 0,
    });
    expect(topLeft.y).toBe(view.worldTop);
    expect(right.x - topLeft.x).toBeCloseTo(WORLD_WIDTH);
  });
});
