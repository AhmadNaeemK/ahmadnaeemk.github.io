import { describe, expect, it } from "vitest";
import {
  placeThemeList,
  type ListPlacementInput,
} from "./theme-list-placement";

const GAP = 8;
const MARGIN = 16;

const LIST = { width: 260, height: 200 };
const VIEWPORT = { width: 1280, height: 720 };

/** A toggle in a header at the top of a desktop viewport. */
function input(overrides: Partial<ListPlacementInput>): ListPlacementInput {
  return {
    toggle: { top: 12, bottom: 50, right: 1000 },
    list: LIST,
    viewport: VIEWPORT,
    ...overrides,
  };
}

/** A toggle whose top edge sits at `top`, as tall as a real one. */
function toggleAt(top: number) {
  return { top, bottom: top + 38, right: 1000 };
}

describe("placeThemeList", () => {
  it("sits below the toggle with their right edges lined up", () => {
    const { top, left } = placeThemeList(input({}));

    expect(top).toBe(50 + GAP);
    expect(left + LIST.width).toBe(1000);
  });

  it("gives the list the room left below it", () => {
    const { maxHeight } = placeThemeList(input({}));

    expect(maxHeight).toBe(VIEWPORT.height - 50 - GAP);
  });

  describe("sideways", () => {
    it("keeps its margin from the right edge when the toggle reaches past it", () => {
      const { left } = placeThemeList(
        input({ toggle: { top: 12, bottom: 50, right: VIEWPORT.width } }),
      );

      expect(left + LIST.width).toBe(VIEWPORT.width - MARGIN);
    });

    it("keeps its margin from the left edge when the toggle is too far left to line up", () => {
      const { left } = placeThemeList(
        input({ toggle: { top: 12, bottom: 50, right: 100 } }),
      );

      expect(left).toBe(MARGIN);
    });

    it("keeps the left margin when the viewport is narrower than the list", () => {
      const { left } = placeThemeList(
        input({
          toggle: { top: 12, bottom: 50, right: 150 },
          viewport: { width: 200, height: 720 },
        }),
      );

      expect(left).toBe(MARGIN);
    });
  });

  describe("above or below", () => {
    it("stays below when it fits there, however much room is above", () => {
      const { top } = placeThemeList(input({ toggle: toggleAt(400) }));

      expect(top).toBe(438 + GAP);
    });

    it("stays below when it exactly fits there", () => {
      const viewport = {
        width: 1280,
        height: 438 + GAP + LIST.height,
      };

      const { top } = placeThemeList(
        input({ toggle: toggleAt(400), viewport }),
      );

      expect(top).toBe(438 + GAP);
    });

    it("goes above when below is too short and above has more room", () => {
      const { top, maxHeight } = placeThemeList(
        input({ toggle: toggleAt(600) }),
      );

      expect(top + LIST.height + GAP).toBe(600);
      expect(maxHeight).toBe(600 - GAP);
    });

    it("stays below when below is too short but above has less room", () => {
      const viewport = { width: 1280, height: 180 };

      const { top, maxHeight } = placeThemeList(
        input({ toggle: toggleAt(50), viewport }),
      );

      expect(top).toBe(88 + GAP);
      expect(maxHeight).toBe(180 - 88 - GAP);
    });

    it("stays below when the room is equal and too short for the list", () => {
      // 62 px above the toggle's gap and 62 px below it.
      const viewport = { width: 320, height: 178 };

      const { top } = placeThemeList(input({ toggle: toggleAt(70), viewport }));

      expect(top).toBe(108 + GAP);
    });

    it("starts at the viewport's top when above is shorter than the list too", () => {
      const viewport = { width: 320, height: 300 };

      const { top, maxHeight } = placeThemeList(
        input({ toggle: toggleAt(180), viewport }),
      );

      expect(top).toBe(0);
      expect(maxHeight).toBe(180 - GAP);
    });

    it("moves with a toggle scrolled off the top, so the two scroll together", () => {
      const { top } = placeThemeList(input({ toggle: toggleAt(-90) }));

      expect(top).toBe(-52 + GAP);
    });
  });

  describe("maxHeight", () => {
    it.each([
      ["taller than the viewport", { top: -20, bottom: 800, right: 1000 }],
      ["filling it exactly", { top: 0, bottom: 720, right: 1000 }],
      ["scrolled past the bottom", toggleAt(900)],
      ["scrolled past the top", toggleAt(-500)],
    ])("is never negative with a toggle %s", (_case, toggle) => {
      expect(
        placeThemeList(input({ toggle })).maxHeight,
      ).toBeGreaterThanOrEqual(0);
    });

    it("is zero when neither side has any room", () => {
      const { maxHeight } = placeThemeList(
        input({ toggle: { top: 2, bottom: 718, right: 1000 } }),
      );

      expect(maxHeight).toBe(0);
    });
  });
});
