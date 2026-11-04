/**
 * The theme contract, as code. docs/rfcs/theme-contract.md explains it, and
 * changing anything here follows the change procedure written there.
 */
import type { WorldView } from "../rail";

export const THEME_NAMES = ["interchange", "diorama", "pixel-depot"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

/** Shown with no attribute, no JavaScript, or an unknown name. */
export const DEFAULT_THEME: ThemeName = "interchange";

/** On `<html>`: which theme shows. The only link from selection to scenes. */
export const THEME_ATTRIBUTE = "data-rail-theme";
/** On each theme's outermost element, naming that theme. */
export const THEME_ROOT_ATTRIBUTE = "data-rail-theme-root";
/** On `<html>`: `light` or `dark` once the visitor picks; absent means system. */
export const COLOR_SCHEME_ATTRIBUTE = "data-theme";
/** On a theme root, written by the scene runtime only. */
export const SCENE_STATE_ATTRIBUTE = "data-scene-state";
/** On a theme's hero, written by the scene runtime only. */
export const NOW_ATTRIBUTE = "data-now";

export type ColorScheme = "light" | "dark";
export type SceneState = "loading" | "running" | "paused" | "failed";
export type NowMode = "board" | "html";

/** Selectors for the hooks a theme's static part must put in its markup. */
export const THEME_HOOKS = {
  hero: "[data-rail-hero]",
  canvas: "[data-rail-canvas]",
  staticHero: "[data-rail-static]",
  controls: "[data-rail-controls]",
  toggle: "[data-rail-toggle]",
  toggleLabel: "[data-rail-label]",
  speed: "[data-rail-speed]",
  livery: "[data-rail-livery]",
  colorSchemeToggle: "[data-theme-toggle]",
  copy: "[data-copy]",
  copyLabel: "[data-copy-label]",
  copyTarget: "[data-copy-target]",
  cvLink: "[data-cv]",
  year: "[data-year]",
  /** On `ThemeSwitcher.astro`'s outer element, whatever Task 10 renders inside. */
  themeSwitcher: "[data-theme-switcher]",
} as const;

/** Selectors for what `RightNow.astro` renders, so no theme writes these. */
export const RIGHT_NOW_PARTS = {
  item: ".now__list li",
  label: ".now__k",
  value: ".now__v",
} as const;

/** Below this scene width the billboard is not drawn and the HTML line shows. */
export const COMPACT_SCENE_WIDTH = 600;

/** `Scene.hitTrain` radii, in world units, from the prototype's canvas input. */
export const HIT_RADIUS = { hover: 16, click: 20 } as const;

export const STORAGE_KEYS = {
  theme: "rail-selected-theme",
  colorScheme: "rail-color-scheme",
  livery: "rail-livery",
} as const;

export const SECTION_KEYS = [
  "top",
  "about",
  "work",
  "projects",
  "skills",
  "contact",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

const THEME_SECTION_PREFIX: Readonly<Record<ThemeName, string>> = {
  interchange: "a-",
  diorama: "b-",
  "pixel-depot": "c-",
};

/** The header links, in order. `top` is reached from the site mark instead. */
export const NAV_SECTIONS: readonly {
  readonly key: Exclude<SectionKey, "top">;
  readonly label: string;
}[] = [
  { key: "about", label: "About" },
  { key: "work", label: "Work" },
  { key: "projects", label: "Projects" },
  { key: "skills", label: "Skills" },
  { key: "contact", label: "Contact" },
];

export function isThemeName(value: unknown): value is ThemeName {
  return THEME_NAMES.some((name) => name === value);
}

/**
 * A bare attribute or saved value to the theme to show. Not for hash text, which
 * starts with `#` and would always resolve to the default: use `themeFromHash`.
 */
export function resolveThemeName(value: unknown): ThemeName {
  return isThemeName(value) ? value : DEFAULT_THEME;
}

/** The DOM id of a section in a theme, such as `b-about`. */
export function sectionId(theme: ThemeName, key: SectionKey): string {
  return `${THEME_SECTION_PREFIX[theme]}${key}`;
}

/** The link that selects a theme, such as `#pixel-depot`. */
export function themeHash(theme: ThemeName): string {
  return `#${theme}`;
}

/**
 * Every hash that names a theme, as plain data. The no-flash head script must be
 * inline and cannot import this module, so it gets this table at build time
 * through `define:vars`.
 */
export const THEME_BY_HASH: Readonly<Record<string, ThemeName>> =
  Object.fromEntries(
    THEME_NAMES.flatMap((theme): [string, ThemeName][] => [
      [themeHash(theme), theme],
      ...SECTION_KEYS.map((key): [string, ThemeName] => [
        `#${sectionId(theme, key)}`,
        theme,
      ]),
    ]),
  );

/**
 * The theme a `location.hash` names, through a theme hash (`#diorama`) or a
 * section hash (`#b-about`), or null when it names none.
 */
export function themeFromHash(hash: string): ThemeName | null {
  return Object.hasOwn(THEME_BY_HASH, hash) ? THEME_BY_HASH[hash] : null;
}

/**
 * How many web fonts have finished loading. Sample it to see a font arrive: no
 * font event or promise was reliable in both browsers, and a failed font does
 * not count, so there is nothing to redo for one.
 */
export function loadedFontFaceCount(): number {
  let count = 0;
  document.fonts.forEach((face) => {
    if (face.status === "loaded") count += 1;
  });
  return count;
}

/** What each theme's `meta.ts` exports as `meta`. */
export interface ThemeMeta {
  readonly label: string;
  readonly description: string;
  /** Google Fonts stylesheet, requested only once this theme is shown. */
  readonly fontStylesheet: string;
}

export interface NowItem {
  readonly label: string;
  readonly value: string;
}

/** Position relative to the canvas's top-left corner, in CSS pixels. */
export interface CanvasPoint {
  readonly x: number;
  readonly y: number;
}

export interface SceneSize {
  /** The canvas parent's `clientWidth`, in CSS pixels. Never zero. */
  readonly width: number;
  /** `width < COMPACT_SCENE_WIDTH`: skip the billboard. */
  readonly compact: boolean;
  /** Capped at 2. */
  readonly devicePixelRatio: number;
}

export interface SceneContext {
  readonly canvas: HTMLCanvasElement;
  /** The one shared world, read-only. Updates between `draw` calls. */
  readonly world: WorldView;
  /** The "Right now" items, read from this theme's HTML line. */
  readonly nowItems: readonly NowItem[];
  /** A custom property's current value on the theme root. */
  readToken(name: `--${string}`): string;
}

/**
 * A theme's drawing code. The runtime makes every call, only while this theme
 * is the one showing, and `resize` always comes before the first `draw`. A
 * throw from any method, or from `createScene`, counts as a failed load.
 */
export interface Scene {
  /** Set the canvas's own size. Also called on being shown again. */
  resize(size: SceneSize): void;
  /** Draw one frame. Must not change the world. Animate from `world.time`. */
  draw(): void;
  /**
   * Does this canvas point touch the train, as this theme projects it? `point`
   * is in CSS pixels and `radius` in world units (`HIT_RADIUS`).
   */
  hitTrain(point: CanvasPoint, radius: number): boolean;
  /**
   * Re-read tokens, which are already correct when this is called. Always called
   * before the first `draw`.
   */
  applyColorScheme(scheme: ColorScheme): void;
  /**
   * A web font loaded since this scene last heard: drop anything measured with
   * a fallback. A hidden scene hears about it on being shown.
   */
  onFontsReady(): void;
}

export type CreateScene = (context: SceneContext) => Scene;

/** What each theme's `scene.ts` exports. */
export interface SceneModule {
  readonly createScene: CreateScene;
}
