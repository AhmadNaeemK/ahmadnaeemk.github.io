import type { ColorScheme, SceneContext } from "../../../scene/contract";
import type { Palette } from "./stage";

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

type ReadToken = SceneContext["readToken"];

/**
 * The painters unpack colours from `#rrggbb` alone, so anything else in a token
 * throws here, which fails the load and shows the static hero, rather than
 * painting the scene wrong without a word.
 */
function readHex(readToken: ReadToken, name: `--${string}`): string {
  const value = readToken(name);
  if (!HEX_COLOUR.test(value)) {
    throw new Error(`Token ${name} must be #rrggbb, got "${value}".`);
  }
  return value;
}

export function readPalette(
  readToken: ReadToken,
  scheme: ColorScheme,
): Palette {
  const hex = (name: `--${string}`) => readHex(readToken, name);
  return {
    night: scheme === "dark",
    grass: hex("--scene-grass"),
    grassDark: hex("--scene-grass-dark"),
    grassLight: hex("--scene-grass-light"),
    water: hex("--scene-water"),
    waterLight: hex("--scene-water-light"),
    ballast: hex("--scene-ballast"),
    ballastDark: hex("--scene-ballast-dark"),
    sleeper: hex("--scene-sleeper"),
    rail: hex("--scene-rail"),
    stone: hex("--scene-stone"),
    stoneDark: hex("--scene-stone-dark"),
    plank: hex("--scene-plank"),
    plankDark: hex("--scene-plank-dark"),
    seam: hex("--scene-seam"),
    edge: hex("--scene-edge"),
    hill: hex("--scene-hill"),
    hillDark: hex("--scene-hill-dark"),
    mouth: hex("--scene-mouth"),
    shoulder: hex("--scene-shoulder"),
    outline: hex("--scene-outline"),
    glass: hex("--scene-glass"),
    smoke: hex("--scene-smoke"),
    lamp: hex("--scene-lamp"),
    roofs: [
      hex("--scene-roof-1"),
      hex("--scene-roof-2"),
      hex("--scene-roof-3"),
    ],
    trees: [
      hex("--scene-tree-1"),
      hex("--scene-tree-2"),
      hex("--scene-tree-3"),
      hex("--scene-tree-4"),
      hex("--scene-tree-5"),
    ],
    flowers: [
      hex("--scene-flower-1"),
      hex("--scene-flower-2"),
      hex("--scene-flower-3"),
      hex("--scene-flower-4"),
    ],
    board: hex("--scene-board"),
    boardLabel: hex("--scene-board-label"),
    boardLabelInk: hex("--scene-board-label-ink"),
    boardKey: hex("--scene-board-key"),
    boardValue: hex("--scene-board-value"),
    boardSeparator: hex("--scene-board-separator"),
    stack: hex("--scene-stack"),
    skirt: hex("--scene-skirt"),
    coal: hex("--scene-coal"),
    coalLump: hex("--scene-coal-lump"),
    lampGlow: hex("--scene-lamp-glow"),
    headlightGlow: hex("--scene-headlight-glow"),
  };
}
