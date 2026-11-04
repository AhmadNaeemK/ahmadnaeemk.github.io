import type { ColorScheme, SceneContext } from "../../scene/contract";
import type { WorldView } from "../../rail";
import { LINES } from "./lines";

/** Everything the scene paints with, all read from the theme's tokens. */
export interface SceneTokens {
  readonly dark: boolean;
  readonly fontFamily: string;
  readonly lines: readonly string[];
  readonly bg: string;
  readonly surface: string;
  readonly ink: string;
  readonly muted: string;
  readonly rule: string;
  readonly tomato: string;
  readonly cobalt: string;
  readonly marigold: string;
  readonly trackUnder: string;
  readonly platform: string;
  readonly shadow: string;
  readonly lit: string;
  readonly puff: string;
  readonly coal: string;
  readonly coalFleck: string;
  readonly board: string;
  readonly boardKey: string;
  readonly boardValue: string;
  readonly boardSeparator: string;
  readonly boardGlow: string;
  readonly boardScanline: string;
  readonly boardLabelBg: string;
  readonly boardLabelInk: string;
}

export function readSceneTokens(
  readToken: SceneContext["readToken"],
  scheme: ColorScheme,
): SceneTokens {
  return {
    dark: scheme === "dark",
    fontFamily: readToken("--f"),
    lines: LINES.map(({ color }) => readToken(`--${color}`)),
    bg: readToken("--bg"),
    surface: readToken("--surface"),
    ink: readToken("--ink"),
    muted: readToken("--muted"),
    rule: readToken("--rule"),
    tomato: readToken("--tomato"),
    cobalt: readToken("--cobalt"),
    marigold: readToken("--marigold"),
    trackUnder: readToken("--track-under"),
    platform: readToken("--platform"),
    shadow: readToken("--shadow"),
    lit: readToken("--lit"),
    puff: readToken("--puff"),
    coal: readToken("--coal"),
    coalFleck: readToken("--coal-fleck"),
    board: readToken("--board"),
    boardKey: readToken("--now-key"),
    boardValue: readToken("--now-ink"),
    boardSeparator: readToken("--board-separator"),
    boardGlow: readToken("--board-glow"),
    boardScanline: readToken("--board-scanline"),
    boardLabelBg: readToken("--now-label-bg"),
    boardLabelInk: readToken("--now-label-ink"),
  };
}

/** What every drawing helper needs. */
export interface Paint {
  readonly ctx: CanvasRenderingContext2D;
  readonly world: WorldView;
  readonly tokens: SceneTokens;
}
