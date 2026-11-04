import {
  RIGHT_NOW_PARTS,
  THEME_HOOKS,
  themeRootElement,
  type NowItem,
  type ThemeName,
} from "./contract";

/** Everything a scene needs from the page. */
export interface ThemeElements {
  readonly hero: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  /** Observed and measured instead of the canvas, which scenes resize. */
  readonly sizer: HTMLElement;
}

export interface ThemeDom {
  readonly root: HTMLElement | null;
  /** Null when a hook is missing, which fails that theme's load and no other. */
  readonly elements: ThemeElements | null;
}

export function findThemeDom(theme: ThemeName): ThemeDom {
  const root = themeRootElement(theme);
  const hero = root?.querySelector<HTMLElement>(THEME_HOOKS.hero);
  const canvas = root?.querySelector<HTMLCanvasElement>(THEME_HOOKS.canvas);
  const sizer = canvas?.parentElement;
  return {
    root,
    elements: hero && canvas && sizer ? { hero, canvas, sizer } : null,
  };
}

export function readNowItems(root: HTMLElement): NowItem[] {
  return [...root.querySelectorAll(RIGHT_NOW_PARTS.item)].map((item) => ({
    label: item.querySelector(RIGHT_NOW_PARTS.label)?.textContent?.trim() ?? "",
    value: item.querySelector(RIGHT_NOW_PARTS.value)?.textContent?.trim() ?? "",
  }));
}
