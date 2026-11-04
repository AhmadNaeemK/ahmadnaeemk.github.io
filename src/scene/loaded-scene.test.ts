import { describe, expect, it } from "vitest";
import { isSameSize } from "./loaded-scene";

const SIZE = { width: 800, compact: false, devicePixelRatio: 2 };

describe("isSameSize", () => {
  it("treats an equal size as no change, so a show is not followed by a second resize", () => {
    expect(isSameSize({ ...SIZE }, SIZE)).toBe(true);
  });

  it("counts a scene with no size yet as a change", () => {
    expect(isSameSize(SIZE, null)).toBe(false);
  });

  it("counts a new width as a change", () => {
    expect(isSameSize(SIZE, { ...SIZE, width: 801 })).toBe(false);
  });

  it("counts a new pixel ratio as a change, as when a window moves to another screen", () => {
    expect(isSameSize(SIZE, { ...SIZE, devicePixelRatio: 1 })).toBe(false);
  });
});
