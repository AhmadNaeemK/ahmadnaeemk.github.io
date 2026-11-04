/**
 * STUB, replaced by Task 6 behind the same `startSceneRuntime` export. It shows
 * the shape the contract requires: one world, one stepper, the showing scene
 * only, lazy scene modules, last selection wins. Task 6 adds controls, pointer
 * and keyboard input, and pausing while off-screen.
 */
import { createWorld } from "../rail";
import { SCENE_LOADERS } from "../themes/registry";
import {
  COLOR_SCHEME_ATTRIBUTE,
  COMPACT_SCENE_WIDTH,
  loadedFontFaceCount,
  NOW_ATTRIBUTE,
  resolveThemeName,
  RIGHT_NOW_PARTS,
  SCENE_STATE_ATTRIBUTE,
  STORAGE_KEYS,
  THEME_ATTRIBUTE,
  THEME_HOOKS,
  THEME_ROOT_ATTRIBUTE,
  type ColorScheme,
  type NowItem,
  type NowMode,
  type Scene,
  type SceneState,
  type ThemeName,
} from "./contract";
import { worldStartOptions } from "./world-start";

const MAX_DEVICE_PIXEL_RATIO = 2;

interface ThemeElements {
  readonly root: HTMLElement;
  readonly hero: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  /** Observed and measured instead of the canvas, which scenes resize. */
  readonly sizer: HTMLElement;
}

interface LoadedScene {
  readonly scene: Scene;
  appliedScheme: ColorScheme | null;
  fontFacesSeen: number;
}

function findElements(theme: ThemeName): ThemeElements {
  const root = document.querySelector<HTMLElement>(
    `[${THEME_ROOT_ATTRIBUTE}="${theme}"]`,
  );
  const hero = root?.querySelector<HTMLElement>(THEME_HOOKS.hero);
  const canvas = root?.querySelector<HTMLCanvasElement>(THEME_HOOKS.canvas);
  const sizer = canvas?.parentElement;
  if (!root || !hero || !canvas || !sizer) {
    throw new Error(`Theme "${theme}" is missing a contract hook.`);
  }
  return { root, hero, canvas, sizer };
}

function readNowItems(root: HTMLElement): NowItem[] {
  return [...root.querySelectorAll(RIGHT_NOW_PARTS.item)].map((item) => ({
    label: item.querySelector(RIGHT_NOW_PARTS.label)?.textContent?.trim() ?? "",
    value: item.querySelector(RIGHT_NOW_PARTS.value)?.textContent?.trim() ?? "",
  }));
}

function readSavedLivery(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.livery);
  } catch {
    return null;
  }
}

export function startSceneRuntime(): void {
  const html = document.documentElement;
  const systemDark = matchMedia("(prefers-color-scheme: dark)");
  const showingTheme = () =>
    resolveThemeName(html.getAttribute(THEME_ATTRIBUTE));
  const colorScheme = (): ColorScheme => {
    const picked = html.getAttribute(COLOR_SCHEME_ATTRIBUTE);
    if (picked === "light" || picked === "dark") return picked;
    return systemDark.matches ? "dark" : "light";
  };

  const world = createWorld(
    worldStartOptions({
      firstTheme: showingTheme(),
      savedLivery: readSavedLivery(),
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    }),
  );
  const loaded = new Map<ThemeName, LoadedScene>();
  // `selected` is what was asked for; `current` is the scene actually showing.
  let selected: ThemeName | null = null;
  let current: ThemeName | null = null;
  // Each selection takes a ticket, so a late import cannot start a stale theme.
  let selectionTicket = 0;
  let sizeChanged = false;
  let lastFrameTime = performance.now();

  // A scene's resize changes the height of the observed element, so running it
  // inside the callback makes WebKit report a ResizeObserver loop error.
  const sizeObserver = new ResizeObserver(() => {
    sizeChanged = true;
  });

  const setState = (theme: ThemeName, state: SceneState) =>
    findElements(theme).root.setAttribute(SCENE_STATE_ATTRIBUTE, state);

  const setNowMode = (theme: ThemeName, mode: NowMode) =>
    findElements(theme).hero.setAttribute(NOW_ATTRIBUTE, mode);

  function fail(theme: ThemeName, cause: unknown): void {
    console.error(`Scene for theme "${theme}" failed.`, cause);
    loaded.delete(theme);
    if (current === theme) current = null;
    setState(theme, "failed");
    setNowMode(theme, "html");
  }

  /** Any throw from a scene counts as a failed load. */
  function withShowingScene(action: (entry: LoadedScene) => void): void {
    const theme = current;
    const entry = theme && loaded.get(theme);
    if (!theme || !entry) return;
    try {
      action(entry);
    } catch (cause) {
      fail(theme, cause);
    }
  }

  function applySize(theme: ThemeName, entry: LoadedScene): void {
    const width = findElements(theme).sizer.clientWidth;
    if (width === 0) return;
    const compact = width < COMPACT_SCENE_WIDTH;
    entry.scene.resize({
      width,
      compact,
      devicePixelRatio: Math.min(
        window.devicePixelRatio || 1,
        MAX_DEVICE_PIXEL_RATIO,
      ),
    });
    setNowMode(theme, compact ? "html" : "board");
  }

  function applyColors(entry: LoadedScene): void {
    const scheme = colorScheme();
    if (entry.appliedScheme === scheme) return;
    entry.appliedScheme = scheme;
    entry.scene.applyColorScheme(scheme);
  }

  /** Sampled, because `loadingdone` never fired in Playwright's WebKit. */
  function applyFonts(entry: LoadedScene): void {
    const count = loadedFontFaceCount();
    if (count <= entry.fontFacesSeen) return;
    entry.fontFacesSeen = count;
    entry.scene.onFontsReady();
  }

  /** Same task as the selection, so no blank frame shows before the first tick. */
  function show(theme: ThemeName, entry: LoadedScene): void {
    try {
      current = theme;
      setState(theme, "running");
      sizeObserver.disconnect();
      sizeObserver.observe(findElements(theme).sizer);
      applySize(theme, entry);
      applyColors(entry);
      applyFonts(entry);
      entry.scene.draw();
      sizeChanged = false;
    } catch (cause) {
      fail(theme, cause);
    }
  }

  async function select(theme: ThemeName): Promise<void> {
    selected = theme;
    selectionTicket += 1;
    const ticket = selectionTicket;
    if (current && current !== theme) setState(current, "paused");
    current = null;

    const existing = loaded.get(theme);
    if (existing) {
      show(theme, existing);
      return;
    }

    setState(theme, "loading");
    try {
      const { createScene } = await SCENE_LOADERS[theme]();
      if (ticket !== selectionTicket) {
        // If this theme is selected again, the newer import owns its state.
        if (theme !== selected) {
          findElements(theme).root.removeAttribute(SCENE_STATE_ATTRIBUTE);
        }
        return;
      }
      const { root, canvas } = findElements(theme);
      const entry: LoadedScene = {
        appliedScheme: null,
        fontFacesSeen: loadedFontFaceCount(),
        scene: createScene({
          canvas,
          world,
          nowItems: readNowItems(root),
          readToken: (name) =>
            getComputedStyle(root).getPropertyValue(name).trim(),
        }),
      };
      loaded.set(theme, entry);
      show(theme, entry);
    } catch (cause) {
      if (ticket === selectionTicket) fail(theme, cause);
      else if (theme !== selected) setState(theme, "failed");
    }
  }

  function frame(time: number): void {
    const dt = (time - lastFrameTime) / 1000;
    lastFrameTime = time;
    if (!document.hidden) {
      withShowingScene((entry) => {
        if (sizeChanged && current) {
          sizeChanged = false;
          applySize(current, entry);
        }
        applyFonts(entry);
        world.update(dt);
        entry.scene.draw();
      });
    }
    requestAnimationFrame(frame);
  }

  const reactToColors = () => withShowingScene(applyColors);

  new MutationObserver(() => {
    const theme = showingTheme();
    if (theme !== selected) void select(theme);
    else reactToColors();
  }).observe(html, {
    attributes: true,
    attributeFilter: [THEME_ATTRIBUTE, COLOR_SCHEME_ATTRIBUTE],
  });
  systemDark.addEventListener("change", reactToColors);

  void select(showingTheme());
  requestAnimationFrame(frame);
}
