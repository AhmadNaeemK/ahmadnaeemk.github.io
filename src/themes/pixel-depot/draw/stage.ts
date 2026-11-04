import type { WorldView } from "../../../rail";
import type { CanvasPoint, SceneSize } from "../../../scene/contract";

const WORLD_LEFT = -24;
const WORLD_WIDTH = 768;
/** The billboard stands above the town, so a full view starts higher up. */
const FULL_VIEW = { top: -66, height: 302 };
const COMPACT_VIEW = { top: -28, height: 264 };
const LARGE_PIXEL_FROM_WIDTH = 900;
const MEDIUM_PIXEL_FROM_WIDTH = 520;

/** Which part of the world shows, and how big one buffer pixel is. */
export interface View {
  readonly compact: boolean;
  /** CSS pixels per buffer pixel. */
  readonly pixelSize: number;
  readonly bufferWidth: number;
  readonly bufferHeight: number;
  /** Buffer pixels per world unit. */
  readonly scale: number;
  readonly worldTop: number;
}

export function viewForSize({ width, compact }: SceneSize): View {
  const { top, height } = compact ? COMPACT_VIEW : FULL_VIEW;
  const pixelSize =
    width >= LARGE_PIXEL_FROM_WIDTH
      ? 3
      : width >= MEDIUM_PIXEL_FROM_WIDTH
        ? 2
        : 1;
  const bufferWidth = Math.floor(width / pixelSize);
  return {
    compact,
    pixelSize,
    bufferWidth,
    bufferHeight: Math.round((bufferWidth * height) / WORLD_WIDTH),
    scale: bufferWidth / WORLD_WIDTH,
    worldTop: top,
  };
}

export const worldToBufferX = (view: View, x: number) =>
  (x - WORLD_LEFT) * view.scale;
export const worldToBufferY = (view: View, y: number) =>
  (y - view.worldTop) * view.scale;
export const bufferToWorldX = (view: View, x: number) =>
  WORLD_LEFT + x / view.scale;
export const bufferToWorldY = (view: View, y: number) =>
  view.worldTop + y / view.scale;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A point on the canvas, in CSS pixels, as a point in the world. */
export function canvasToWorld(view: View, { x, y }: CanvasPoint): Point {
  return {
    x: bufferToWorldX(view, x / view.pixelSize),
    y: bufferToWorldY(view, y / view.pixelSize),
  };
}

/** The colours the scene paints with, each a `#rrggbb` string. */
export interface Palette {
  /** Windows glow, the train dims and lamps light up. */
  readonly night: boolean;
  readonly grass: string;
  readonly grassDark: string;
  readonly grassLight: string;
  readonly water: string;
  readonly waterLight: string;
  readonly ballast: string;
  readonly ballastDark: string;
  readonly sleeper: string;
  readonly rail: string;
  readonly stone: string;
  readonly stoneDark: string;
  readonly plank: string;
  readonly plankDark: string;
  readonly seam: string;
  readonly edge: string;
  readonly hill: string;
  readonly hillDark: string;
  readonly mouth: string;
  readonly shoulder: string;
  readonly outline: string;
  readonly glass: string;
  readonly smoke: string;
  readonly lamp: string;
  readonly roofs: readonly string[];
  readonly trees: readonly string[];
  readonly flowers: readonly string[];
  readonly board: string;
  readonly boardLabel: string;
  readonly boardLabelInk: string;
  readonly boardKey: string;
  readonly boardValue: string;
  readonly boardSeparator: string;
  readonly stack: string;
  readonly skirt: string;
  readonly coal: string;
  readonly coalLump: string;
  readonly lampGlow: string;
  readonly headlightGlow: string;
}

/** What every painter needs to know. */
export interface Stage {
  readonly world: WorldView;
  readonly view: View;
  readonly palette: Palette;
}
