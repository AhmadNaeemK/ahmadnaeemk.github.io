/**
 * What the canvas and the static hero's SVG must agree on, or the map jumps when a
 * scene starts. hero.css repeats the two view ratios, because CSS cannot import.
 */
export const VIEW_X0 = -24;
export const VIEW_WIDTH = 768;
/** The compact view drops the empty sky the billboard would hang in. */
export const FULL_VIEW = { y0: -66, height: 300 };
export const COMPACT_VIEW = { y0: -28, height: 262 };

export const TUNNEL_WIDTH = 2;
export const TUNNEL_DASH = [3, 4] as const;
/** How far a tunnel's curve leaves each mouth. */
export const TUNNEL_CONTROL_REACH = 26;
export const LETTER_WIDTH = 11;
export const BRIDGE_CASING_WIDTH = 16;
export const BRIDGE_BED_WIDTH = 12.5;
export const BRIDGE_DECK_WIDTH = 8;
export const BRIDGE_GRADIENT_X = { from: 140, to: 720 };
