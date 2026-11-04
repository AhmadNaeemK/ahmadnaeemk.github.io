import { describe, expect, it } from "vitest";
import { isLiveryId, LIVERIES, LIVERY_LABELS, LIVERY_ORDER } from "./liveries";

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
