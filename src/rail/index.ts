/**
 * The engine's public entry point. Everything outside `src/rail/` imports from
 * here. Task 4 replaces `./stub` behind these same names and types.
 */
export {
  createWorld,
  marquee,
  marqueeSegments,
  nowCycle,
  sample,
  SPEEDS,
  TAU,
} from "./stub";
export {
  DEFAULT_LIVERY,
  isLiveryId,
  LIVERY_LABELS,
  LIVERY_ORDER,
} from "./liveries";
export type * from "./types";
