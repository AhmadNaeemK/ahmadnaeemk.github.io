import { describe, expect, it } from "vitest";
import { seededRandom, shade } from "./view";

describe("shade", () => {
  it("scales a colour's channels, so night dims a token", () => {
    expect(shade("#804020", 0.5)).toBe("rgb(64,32,16)");
  });

  it("keeps channels in range when brightening", () => {
    expect(shade("#ff8000", 2)).toBe("rgb(255,255,0)");
  });

  it("leaves a colour it cannot scale as it was, rather than painting black", () => {
    expect(shade("rgb(1, 2, 3)", 0.5)).toBe("rgb(1, 2, 3)");
  });
});

describe("seededRandom", () => {
  it("gives the same scenery from the same seed, every visit", () => {
    const first = seededRandom(99);
    const second = seededRandom(99);
    const draws = (random: () => number) =>
      Array.from({ length: 8 }, () => random());
    expect(draws(first)).toEqual(draws(second));
    expect(draws(seededRandom(5))).not.toEqual(draws(seededRandom(99)));
  });

  it("stays below 1, because it is used to index the colour lists", () => {
    for (const seed of [5, 99]) {
      const random = seededRandom(seed);
      for (let draw = 0; draw < 5000; draw += 1) {
        const value = random();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    }
  });
});
