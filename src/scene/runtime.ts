/**
 * One world and one loop for whichever theme is showing, so themes only draw.
 * Section 8 of docs/rfcs/theme-contract.md is the specification.
 */
import { createWorld } from "../rail";
import { SCENE_LOADERS } from "../themes/registry";
import {
  COLOR_SCHEME_ATTRIBUTE,
  NOW_ATTRIBUTE,
  resolveThemeName,
  SCENE_STATE_ATTRIBUTE,
  THEME_ATTRIBUTE,
  THEME_NAMES,
  type CanvasPoint,
  type ColorScheme,
  type NowMode,
  type SceneSize,
  type SceneState,
  type ThemeName,
} from "./contract";
import { createCanvasWatch } from "./canvas-watch";
import { createTrainControls } from "./controls";
import { bindCanvasInput, bindHeroKeys } from "./input";
import {
  currentPixelRatio,
  isSameSize,
  loadScene,
  measureScene,
  tellSceneAboutFonts,
  type LoadedScene,
} from "./loaded-scene";
import { readSavedLivery } from "./saved-livery";
import { findThemeDom, type ThemeDom } from "./theme-elements";
import { worldStartOptions } from "./world-start";
import { createWorldView } from "./world-view";

export function startSceneRuntime(): void {
  const html = document.documentElement;
  const systemDark = matchMedia("(prefers-color-scheme: dark)");
  const selectedTheme = () =>
    resolveThemeName(html.getAttribute(THEME_ATTRIBUTE));
  const colorScheme = (): ColorScheme => {
    const picked = html.getAttribute(COLOR_SCHEME_ATTRIBUTE);
    if (picked === "light" || picked === "dark") return picked;
    return systemDark.matches ? "dark" : "light";
  };

  const world = createWorld(
    worldStartOptions({
      firstTheme: selectedTheme(),
      savedLivery: readSavedLivery(),
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    }),
  );
  const worldView = createWorldView(world);

  const themeDom = Object.fromEntries(
    THEME_NAMES.map((theme) => [theme, findThemeDom(theme)]),
  ) as Readonly<Record<ThemeName, ThemeDom>>;
  const loaded = new Map<ThemeName, LoadedScene>();

  let selected: ThemeName | null = null;
  let showing: LoadedScene | null = null;
  // Each selection takes a ticket, so a late import cannot start a stale theme.
  let selectionTicket = 0;
  let frameRequest = 0;
  let lastStepTime: number | null = null;
  let sizeChanged = false;
  let repaintPending = false;

  const controls = createTrainControls({
    world,
    themeRoots: THEME_NAMES.flatMap((theme) => themeDom[theme].root ?? []),
    isCompact: () => showing?.size?.compact ?? false,
  });

  const canvasWatch = createCanvasWatch({
    onSizeChange() {
      sizeChanged = true;
      scheduleFrame();
    },
    onScreenEntry: wake,
  });

  /**
   * The one rule for running (E10). It is worked out from all three facts each
   * time, because a stored flag is what let the prototype's tab refocus overwrite
   * the off-screen state.
   */
  const isRunning = () =>
    showing?.size != null && canvasWatch.isOnScreen() && !document.hidden;

  /** Every wake goes through here, so there can never be a second loop (E11). */
  function scheduleFrame(): void {
    if (frameRequest === 0) frameRequest = requestAnimationFrame(frame);
  }

  function wake(): void {
    lastStepTime = null;
    scheduleFrame();
  }

  const setState = (theme: ThemeName, state: SceneState) =>
    themeDom[theme].root?.setAttribute(SCENE_STATE_ATTRIBUTE, state);

  const setNowMode = (theme: ThemeName, mode: NowMode) =>
    themeDom[theme].elements?.hero.setAttribute(NOW_ATTRIBUTE, mode);

  function fail(theme: ThemeName, cause: unknown): void {
    console.error(`Scene for theme "${theme}" failed.`, cause);
    loaded.delete(theme);
    if (showing?.theme === theme) {
      showing = null;
      canvasWatch.stop();
    }
    setState(theme, "failed");
    setNowMode(theme, "html");
  }

  /** Any throw from a scene counts as a failed load. */
  function withShowingScene(action: (entry: LoadedScene) => void): void {
    if (!showing) return;
    const { theme } = showing;
    try {
      action(showing);
    } catch (cause) {
      fail(theme, cause);
    }
  }

  function resizeScene(entry: LoadedScene, size: SceneSize): void {
    entry.scene.resize(size);
    entry.size = size;
    setNowMode(entry.theme, size.compact ? "html" : "board");
    // A resize clears the canvas, and the toggle follows the width.
    repaintPending = true;
    controls.sync();
  }

  function resizeIfChanged(entry: LoadedScene): void {
    const pixelRatioChanged =
      entry.size !== null &&
      currentPixelRatio() !== entry.size.devicePixelRatio;
    if (!sizeChanged && !pixelRatioChanged) return;
    sizeChanged = false;

    // The observer's first report after each show lands here with nothing new.
    const size = measureScene(entry);
    if (size && !isSameSize(size, entry.size)) resizeScene(entry, size);
  }

  function applyColors(entry: LoadedScene): void {
    const scheme = colorScheme();
    if (entry.appliedScheme === scheme) return;
    entry.appliedScheme = scheme;
    entry.scene.applyColorScheme(scheme);
    repaintPending = true;
  }

  function drawIfSized(entry: LoadedScene): void {
    repaintPending = false;
    if (entry.size) entry.scene.draw();
  }

  /** Same task as the selection, so no blank frame shows before the first tick. */
  function show(entry: LoadedScene): void {
    showing = entry;
    setState(entry.theme, "running");
    canvasWatch.watch(entry.elements);
    withShowingScene(() => {
      const size = measureScene(entry);
      if (size) resizeScene(entry, size);
      applyColors(entry);
      tellSceneAboutFonts(entry);
      drawIfSized(entry);
    });
    sizeChanged = false;
    scheduleFrame();
  }

  async function select(theme: ThemeName): Promise<void> {
    selected = theme;
    selectionTicket += 1;
    const ticket = selectionTicket;
    if (showing) setState(showing.theme, "paused");
    showing = null;
    canvasWatch.stop();

    const existing = loaded.get(theme);
    if (existing) {
      show(existing);
      return;
    }

    setState(theme, "loading");
    try {
      const { createScene } = await SCENE_LOADERS[theme]();
      if (ticket !== selectionTicket) {
        // If this theme is selected again, the newer import owns its state.
        if (theme !== selected) {
          themeDom[theme].root?.removeAttribute(SCENE_STATE_ATTRIBUTE);
        }
        return;
      }
      const entry = loadScene({
        theme,
        dom: themeDom[theme],
        world: worldView,
        createScene,
      });
      loaded.set(theme, entry);
      show(entry);
    } catch (cause) {
      // A stale failure leaves a selected theme to its newer import.
      if (ticket === selectionTicket || theme !== selected) fail(theme, cause);
    }
  }

  function frame(time: number): void {
    frameRequest = 0;
    withShowingScene((entry) => {
      resizeIfChanged(entry);
      tellSceneAboutFonts(entry);
    });

    const running = isRunning();
    if (running) {
      // Outside any scene's `try`: an engine bug is not that theme's failed load.
      // It surfaces as an uncaught error, and the next wake tries again.
      world.update(lastStepTime === null ? 0 : (time - lastStepTime) / 1000);
      lastStepTime = time;
    } else {
      lastStepTime = null;
    }
    // Off-screen, a repaint keeps the next view of the canvas from being blank.
    if (running || repaintPending) withShowingScene(drawIfSized);
    if (isRunning()) scheduleFrame();
  }

  function reactToColors(): void {
    withShowingScene(applyColors);
    if (repaintPending) scheduleFrame();
  }

  function reactToHtmlAttributes(): void {
    const theme = selectedTheme();
    if (theme !== selected) void select(theme);
    else reactToColors();
  }

  function hitsTrainOn(
    theme: ThemeName,
    point: CanvasPoint,
    radius: number,
  ): boolean {
    let hit = false;
    if (showing?.theme === theme) {
      withShowingScene(({ scene }) => {
        hit = scene.hitTrain(point, radius);
      });
    }
    return hit;
  }

  for (const theme of THEME_NAMES) {
    const { elements } = themeDom[theme];
    if (!elements) continue;
    bindCanvasInput(
      elements.canvas,
      (point, radius) => hitsTrainOn(theme, point, radius),
      controls.pressStop,
    );
    bindHeroKeys(elements.hero, () => showing?.theme === theme, controls);
  }

  new MutationObserver(reactToHtmlAttributes).observe(html, {
    attributes: true,
    attributeFilter: [THEME_ATTRIBUTE, COLOR_SCHEME_ATTRIBUTE],
  });
  systemDark.addEventListener("change", reactToColors);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) wake();
  });
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    // Replaced rather than trusted: if the frozen page lost its request, the
    // guard in `scheduleFrame` would keep the loop from ever restarting.
    cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    reactToHtmlAttributes();
    wake();
  });

  void select(selectedTheme());
}
