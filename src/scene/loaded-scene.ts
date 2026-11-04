import type { WorldView } from "../rail";
import {
  COMPACT_SCENE_WIDTH,
  loadedFontFaceCount,
  type ColorScheme,
  type CreateScene,
  type Scene,
  type SceneSize,
  type ThemeName,
} from "./contract";
import {
  readNowItems,
  type ThemeDom,
  type ThemeElements,
} from "./theme-elements";

const MAX_DEVICE_PIXEL_RATIO = 2;

/** A scene and what the runtime has already told it. */
export interface LoadedScene {
  readonly theme: ThemeName;
  readonly elements: ThemeElements;
  readonly scene: Scene;
  /** Null until the first resize, and nothing draws before that. */
  size: SceneSize | null;
  appliedScheme: ColorScheme | null;
  fontFacesSeen: number;
}

interface LoadSceneOptions {
  readonly theme: ThemeName;
  readonly dom: ThemeDom;
  readonly world: WorldView;
  readonly createScene: CreateScene;
}

/** Throws on a missing hook, which counts as a failed load like any other. */
export function loadScene(options: LoadSceneOptions): LoadedScene {
  const { theme, dom, world, createScene } = options;
  const { root, elements } = dom;
  if (!root || !elements) {
    throw new Error(`Theme "${theme}" is missing a contract hook.`);
  }
  return {
    theme,
    elements,
    size: null,
    appliedScheme: null,
    fontFacesSeen: loadedFontFaceCount(),
    scene: createScene({
      canvas: elements.canvas,
      world,
      nowItems: readNowItems(root),
      readToken: (name) => getComputedStyle(root).getPropertyValue(name).trim(),
    }),
  };
}

export const currentPixelRatio = () =>
  Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);

/** Null at zero width, where a scene must not be resized (E13). */
export function measureScene({ elements }: LoadedScene): SceneSize | null {
  const width = elements.sizer.clientWidth;
  if (width === 0) return null;
  return {
    width,
    compact: width < COMPACT_SCENE_WIDTH,
    devicePixelRatio: currentPixelRatio(),
  };
}

export function isSameSize(size: SceneSize, other: SceneSize | null): boolean {
  return (
    size.width === other?.width &&
    size.devicePixelRatio === other.devicePixelRatio
  );
}

/** Sampled, because `loadingdone` never fired in Playwright's WebKit. */
export function tellSceneAboutFonts(entry: LoadedScene): void {
  const count = loadedFontFaceCount();
  if (count <= entry.fontFacesSeen) return;
  entry.fontFacesSeen = count;
  entry.scene.onFontsReady();
}
