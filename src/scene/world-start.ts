import type { CreateWorldOptions, LiveryId } from "../rail";
import { isLiveryId } from "../rail";
import type { ThemeName } from "./contract";

/**
 * Where the shared world starts. Work proceeds on this default, the planner's
 * recommendation, and the user confirms it on return. This constant is the only
 * thing to change: one seed for everyone, a saved livery
 * wins, otherwise a first visit gets the default of the theme shown first.
 * The prototypes used seeds 11, 23 and 31; 11 is the default theme's.
 */
export const WORLD_START: {
  readonly seed: number;
  readonly firstVisitLivery: Readonly<Record<ThemeName, LiveryId>>;
} = {
  seed: 11,
  firstVisitLivery: {
    interchange: "metro",
    diorama: "steam",
    "pixel-depot": "toy",
  },
};

interface WorldStartInputs {
  readonly firstTheme: ThemeName;
  /** Whatever storage held, or null. Invalid values count as absent. */
  readonly savedLivery: string | null;
  readonly reducedMotion: boolean;
}

export function worldStartOptions(
  inputs: WorldStartInputs,
): CreateWorldOptions {
  const { firstTheme, savedLivery, reducedMotion } = inputs;
  return {
    seed: WORLD_START.seed,
    livery: isLiveryId(savedLivery)
      ? savedLivery
      : WORLD_START.firstVisitLivery[firstTheme],
    startStopped: reducedMotion,
  };
}
