import { describe, expect, it } from "vitest";
import { readPalette } from "./palette";

const everyTokenAs = (value: string) => (): string => value;

describe("readPalette", () => {
  it("throws, naming the token, when one is not #rrggbb", () => {
    const readToken = (name: string) =>
      name === "--scene-water" ? "rgb(0 0 255)" : "#112233";
    expect(() => readPalette(readToken, "light")).toThrow(/--scene-water/);
  });

  it.each(["", "#123", "#12345678", "red", "var(--x)", " #112233"])(
    "refuses %j, which the painters could not unpack",
    (value) => {
      expect(() => readPalette(everyTokenAs(value), "light")).toThrow();
    },
  );

  it("accepts either case of hex", () => {
    const palette = readPalette(everyTokenAs("#AbCdEf"), "light");
    expect(palette.grass).toBe("#AbCdEf");
  });

  it("fills every slot from its own token, so no colour silently repeats another", () => {
    let nextColour = 0;
    const tokens = new Map<string, string>();
    const palette = readPalette((name) => {
      nextColour += 1;
      const colour = `#${nextColour.toString(16).padStart(6, "0")}`;
      tokens.set(name, colour);
      return colour;
    }, "light");
    const colours = Object.values(palette)
      .flat()
      .filter((value) => typeof value === "string");
    expect(new Set(colours).size).toBe(colours.length);
    expect(new Set(tokens.keys()).size).toBe(colours.length);
  });

  it("lights the lamps only in the dark scheme", () => {
    expect(readPalette(everyTokenAs("#112233"), "dark").night).toBe(true);
    expect(readPalette(everyTokenAs("#112233"), "light").night).toBe(false);
  });
});
