import { describe, expect, it } from "vitest";
import { createWorld, LIVERY_ORDER } from "../rail";
import { HIT_RADIUS, THEME_NAMES } from "./contract";
import { WORLD_START, worldStartOptions } from "./world-start";

const FRAME_SECONDS = 0.05;

function startOptions(
  overrides: Partial<Parameters<typeof worldStartOptions>[0]> = {},
) {
  return worldStartOptions({
    firstTheme: "interchange",
    savedLivery: null,
    reducedMotion: false,
    ...overrides,
  });
}

// These read WORLD_START instead of repeating its values, so that constant stays the
// only thing to change if the starting world is ever decided differently.
describe("worldStartOptions", () => {
  describe("livery", () => {
    it.each(THEME_NAMES)(
      "gives a first visit starting on %s that theme's default",
      (firstTheme) => {
        expect(startOptions({ firstTheme }).livery).toBe(
          WORLD_START.firstVisitLivery[firstTheme],
        );
      },
    );

    it.each(THEME_NAMES)(
      "lets a saved livery win over the default of %s",
      (firstTheme) => {
        for (const savedLivery of LIVERY_ORDER) {
          expect(startOptions({ firstTheme, savedLivery }).livery).toBe(
            savedLivery,
          );
        }
      },
    );

    it.each(["", "monorail", "METRO", "constructor", "__proto__"])(
      "treats the invalid saved livery %j as no saved livery",
      (savedLivery) => {
        for (const firstTheme of THEME_NAMES) {
          expect(startOptions({ firstTheme, savedLivery }).livery).toBe(
            WORLD_START.firstVisitLivery[firstTheme],
          );
        }
      },
    );
  });

  describe("reduced motion", () => {
    it("starts the train stopped when the visitor prefers reduced motion", () => {
      expect(startOptions({ reducedMotion: true }).startStopped).toBe(true);
    });

    it("starts the train running otherwise", () => {
      expect(startOptions({ reducedMotion: false }).startStopped).toBe(false);
    });

    it("leaves the saved livery alone", () => {
      const savedLivery = LIVERY_ORDER[LIVERY_ORDER.length - 1];

      expect(startOptions({ savedLivery, reducedMotion: true }).livery).toBe(
        savedLivery,
      );
    });
  });

  it("uses one seed whichever theme shows first, so all themes share a world", () => {
    const seeds = THEME_NAMES.map(
      (firstTheme) => startOptions({ firstTheme }).seed,
    );

    expect(new Set(seeds)).toEqual(new Set([WORLD_START.seed]));
  });
});

// Goes through the public engine entry point, so it guards this seam however the
// engine is arranged behind it.
describe("the world those options start", () => {
  it("has the saved livery's train laid out before the first step, for draw(0)", () => {
    for (const savedLivery of LIVERY_ORDER) {
      const world = createWorld(startOptions({ savedLivery }));

      expect(world.liveryId).toBe(savedLivery);
      expect(world.cars).toHaveLength(world.livery.cars.length);
    }
  });

  it("keeps a reduced-motion train still while its text rolls", () => {
    const world = createWorld(startOptions({ reducedMotion: true }));
    const { x: startX, y: startY } = world.cars[0];
    const startTextTime = world.textTime;

    world.update(FRAME_SECONDS);
    world.update(FRAME_SECONDS);

    expect(world.userStopped).toBe(true);
    expect(world.cars[0]).toMatchObject({ x: startX, y: startY });
    expect(world.textPaused).toBe(false);
    expect(world.textTime).toBeGreaterThan(startTextTime);
  });

  it("moves the train without reduced motion", () => {
    const world = createWorld(startOptions({ reducedMotion: false }));
    const { x: startX, y: startY } = world.cars[0];

    world.update(FRAME_SECONDS);

    expect(world.cars[0]).not.toMatchObject({ x: startX, y: startY });
  });

  it("hit-tests the train where its cars are, and not far from them", () => {
    const world = createWorld(startOptions());
    const car = world.cars.find(({ hidden }) => !hidden);
    if (!car) throw new Error("Expected a visible car at the start.");

    const { hover } = HIT_RADIUS;

    expect(world.hitTrain(car.x, car.y, hover)).toBe(true);
    expect(world.hitTrain(car.x + 100_000, car.y + 100_000, hover)).toBe(false);
  });

  it("reaches further on a click than on a hover, measured in world units", () => {
    const world = createWorld(startOptions());
    const frontCar = world.cars[0];
    const distanceAhead = (HIT_RADIUS.hover + HIT_RADIUS.click) / 2;
    const x = frontCar.x + Math.cos(frontCar.a) * distanceAhead;
    const y = frontCar.y + Math.sin(frontCar.a) * distanceAhead;

    expect(world.hitTrain(x, y, HIT_RADIUS.hover)).toBe(false);
    expect(world.hitTrain(x, y, HIT_RADIUS.click)).toBe(true);
  });
});
