import { describe, expect, it } from "vitest";
import {
  createWorld,
  DEFAULT_LIVERY,
  isLiveryId,
  LIVERY_LABELS,
  LIVERY_ORDER,
  type WorldView,
} from "./index";
import { LIVERIES } from "./liveries";

const LIVERY_IDS = Object.keys(LIVERIES);

describe("isLiveryId", () => {
  it.each(LIVERY_IDS)("accepts %s", (id) => {
    expect(isLiveryId(id)).toBe(true);
  });

  it.each([
    ["an empty string", ""],
    ["an unknown livery", "monorail"],
    ["the wrong case", "Metro"],
    ["a property every object inherits", "constructor"],
    ["another inherited property", "toString"],
    ["the prototype key", "__proto__"],
    ["what storage returns for a missing key", null],
    ["a missing value", undefined],
    ["a number", 0],
    ["an object", { id: "metro" }],
  ])("rejects %s", (_label, value) => {
    expect(isLiveryId(value)).toBe(false);
  });
});

describe("LIVERY_ORDER", () => {
  it("offers a control for every livery, exactly once", () => {
    expect([...LIVERY_ORDER].sort()).toEqual([...LIVERY_IDS].sort());
  });
});

describe("LIVERY_LABELS", () => {
  it("names every livery and nothing else", () => {
    expect(Object.keys(LIVERY_LABELS).sort()).toEqual([...LIVERY_IDS].sort());
  });

  it("gives each control its own accessible name", () => {
    const labels = Object.values(LIVERY_LABELS);

    expect(labels.every((label) => label.trim() !== "")).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("an unknown livery", () => {
  const UNKNOWN_LIVERIES = ["nope", "", "METRO", "constructor", "__proto__"];

  function expectDefaultLivery(world: WorldView): void {
    const { livery: defaultLivery } = createWorld({
      seed: 11,
      livery: DEFAULT_LIVERY,
      startStopped: false,
    });

    expect(world.liveryId).toBe(DEFAULT_LIVERY);
    expect(world.livery).toEqual(defaultLivery);
    expect(world.cars).toHaveLength(defaultLivery.cars.length);
  }

  it.each(UNKNOWN_LIVERIES)(
    "createWorld falls back to the default for %j",
    (livery) => {
      expectDefaultLivery(
        createWorld({ seed: 11, livery, startStopped: false }),
      );
    },
  );

  it.each(UNKNOWN_LIVERIES)(
    "setLivery falls back to the default for %j, not to the current livery",
    (livery) => {
      const otherLivery = LIVERY_ORDER.find((id) => id !== DEFAULT_LIVERY);
      if (!otherLivery) throw new Error("Expected a second livery.");
      const world = createWorld({
        seed: 11,
        livery: otherLivery,
        startStopped: false,
      });

      world.setLivery(livery);

      expectDefaultLivery(world);
    },
  );
});

describe("a smoking livery", () => {
  // The steam code always puts the stack ahead of the car's centre, so a reversed
  // front car would blow its smoke from the wrong end with no error.
  it("never has a reversed front car", () => {
    const smoking = LIVERY_ORDER.map((livery) =>
      createWorld({ seed: 11, livery, startStopped: false }),
    ).filter((world) => world.livery.smoke);
    expect(smoking.length).toBeGreaterThan(0);

    for (const { cars } of smoking) {
      expect(cars[0].rev).toBe(false);
    }
  });
});
