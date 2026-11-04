import type { SceneContext } from "../../scene/contract";

/** Every canvas colour is a token, so a change of scheme reaches all of them. */
const COLOR_TOKENS = {
  grass: "--grass",
  grass2: "--grass2",
  ballast: "--ballast",
  ballast2: "--ballast2",
  sleeper: "--sleeper",
  rail: "--rail",
  railHighlight: "--rail-hi",
  stone: "--stone",
  stone2: "--stone2",
  shadow: "--shadow",
  pond: "--teal",
  pondGlint: "--pond-glint",
  tunnelMouth: "--tunnel-mouth",
  wood: "--wood",
  wood2: "--wood2",
  mustard: "--mustard",
  brick: "--brick",
  trunk: "--trunk",
  houseFront: "--house-front",
  houseSide: "--house-side",
  pane: "--pane",
  lampHead: "--lamp-head",
  lampPost: "--lamp-post",
  canopyPost: "--canopy-post",
  carEdge: "--car-edge",
  tenderTop: "--tender-top",
  locoBase: "--loco-base",
  locoFunnel: "--loco-funnel",
  steam: "--steam",
  glowRgb: "--glow-rgb",
  billboardFace: "--billboard-face",
  billboardPlate: "--brick-fill",
  billboardPlateText: "--cream",
  billboardKey: "--board-soft",
  billboardValue: "--board-ink",
  billboardSeparator: "--billboard-separator",
  displayFont: "--fd",
} as const;

const TREE_TOKENS = [
  "--tree-olive",
  "--tree-amber",
  "--tree-rust",
  "--tree-moss",
  "--tree-gold",
] as const;

const FLOWER_TOKENS = [
  "--flower-gold",
  "--flower-coral",
  "--flower-cream",
  "--flower-pink",
] as const;

const ROOF_TOKENS = {
  brick: "--roof-brick",
  plum: "--roof-plum",
  cobalt: "--roof-cobalt",
} as const;

export const TREE_COLOR_COUNT = TREE_TOKENS.length;
export type RoofColor = keyof typeof ROOF_TOKENS;

export type Palette = Readonly<Record<keyof typeof COLOR_TOKENS, string>> & {
  readonly trees: readonly string[];
  readonly flowers: readonly string[];
  readonly roofs: Readonly<Record<RoofColor, string>>;
};

export type ReadToken = SceneContext["readToken"];

export function readPalette(readToken: ReadToken): Palette {
  const readAll = <Key extends string>(tokens: Record<Key, `--${string}`>) =>
    Object.fromEntries(
      Object.entries<`--${string}`>(tokens).map(([key, token]) => [
        key,
        readToken(token),
      ]),
    ) as Record<Key, string>;
  return {
    ...readAll(COLOR_TOKENS),
    trees: TREE_TOKENS.map(readToken),
    flowers: FLOWER_TOKENS.map(readToken),
    roofs: readAll(ROOF_TOKENS),
  };
}

/** The current colours and whether it is night, which every painter needs. */
export interface Lighting {
  readonly palette: Palette;
  readonly night: boolean;
}
