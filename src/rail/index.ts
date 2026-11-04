/**
 * The engine's public entry point. Everything outside `src/rail/` imports from
 * here.
 */
export { marquee, marqueeSegments, nowCycle } from "./billboard";
export { sample, TAU } from "./geometry";
export {
  DEFAULT_LIVERY,
  isLiveryId,
  LIVERY_LABELS,
  LIVERY_ORDER,
} from "./liveries";
export { createWorld, SPEEDS } from "./world";
export type * from "./types";
