import type { Livery, LiveryId } from "./types";

export const DEFAULT_LIVERY: LiveryId = "metro";

/** Display order of the livery controls. */
export const LIVERY_ORDER: readonly LiveryId[] = [
  "metro",
  "bullet",
  "steam",
  "heritage",
  "toy",
];

/** Accessible names of the livery controls. */
export const LIVERY_LABELS: Readonly<Record<LiveryId, string>> = {
  metro: "Metro",
  bullet: "Bullet train",
  steam: "Steam engine",
  heritage: "Crimson express",
  toy: "Toy train",
};

/** Private to the engine: scenes read the current one from `world.livery`. */
export const LIVERIES: Readonly<Record<LiveryId, Livery>> = {
  metro: {
    cars: [
      ["cab", 26],
      ["coach", 26],
      ["cab", 26, true],
    ],
    gap: 3,
    colors: {
      body: "#F1E9DC",
      trim: "#D4502F",
      window: "#2B2F38",
      roof: "#D9CFC0",
      accent: "#E8A33D",
    },
  },
  bullet: {
    cars: [
      ["nose", 32],
      ["coach", 26],
      ["coach", 26],
      ["nose", 32, true],
    ],
    gap: 2,
    colors: {
      body: "#FAF7F0",
      trim: "#2F5FA8",
      window: "#1E2A3A",
      roof: "#E9E3D6",
      accent: "#E3B65A",
    },
  },
  steam: {
    cars: [
      ["loco", 30],
      ["tender", 16],
      ["coach", 26],
      ["coach", 26],
    ],
    gap: 3,
    smoke: true,
    colors: {
      body: "#2F4A3A",
      trim: "#C9A24A",
      window: "#F3D9A0",
      roof: "#24382C",
      accent: "#B5402E",
      coach: "#8A5A3C",
      coachRoof: "#6E4630",
    },
  },
  heritage: {
    cars: [
      ["loco", 30],
      ["tender", 16],
      ["coach", 26],
      ["coach", 26],
      ["coach", 26],
    ],
    gap: 3,
    smoke: true,
    colors: {
      body: "#B3262E",
      trim: "#E3B65A",
      window: "#F6DDA6",
      roof: "#2A1A1A",
      accent: "#1C1414",
      coach: "#8E1F2C",
      coachRoof: "#3A2326",
    },
  },
  toy: {
    cars: [
      ["loco", 24],
      ["coach", 22],
      ["coach", 22],
    ],
    gap: 4,
    smoke: false,
    colors: {
      body: "#E0452B",
      trim: "#F4C430",
      window: "#2E86C1",
      roof: "#2E86C1",
      accent: "#3FA34D",
      coach: "#F4C430",
      coach2: "#2E86C1",
      coachRoof: "#E0452B",
    },
  },
};

export function isLiveryId(value: unknown): value is LiveryId {
  return typeof value === "string" && Object.hasOwn(LIVERIES, value);
}
