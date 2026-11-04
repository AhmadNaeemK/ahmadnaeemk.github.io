import type { ThemeElements } from "./theme-elements";

/** Reports size changes and on-screen state for one theme's canvas at a time. */
export interface CanvasWatch {
  watch(elements: ThemeElements): void;
  stop(): void;
  /**
   * False from each `watch` until the observer reports, so an off-screen scene
   * is never stepped, not even for its first frame.
   */
  isOnScreen(): boolean;
}

interface CanvasWatchHandlers {
  /**
   * Must only note the change. A scene's resize changes the height of the
   * observed element, so running it here makes WebKit report a ResizeObserver
   * loop error.
   */
  readonly onSizeChange: () => void;
  readonly onScreenEntry: () => void;
}

export function createCanvasWatch(handlers: CanvasWatchHandlers): CanvasWatch {
  let watchedCanvas: HTMLCanvasElement | null = null;
  let onScreen = false;

  const sizeObserver = new ResizeObserver(() => handlers.onSizeChange());

  const screenObserver = new IntersectionObserver((entries) => {
    // Entries queued for the previous theme's canvas can arrive after a switch.
    const latest = entries
      .filter(({ target }) => target === watchedCanvas)
      .at(-1);
    if (!latest) return;
    onScreen = latest.isIntersecting;
    if (onScreen) handlers.onScreenEntry();
  });

  function stop(): void {
    sizeObserver.disconnect();
    screenObserver.disconnect();
    watchedCanvas = null;
    onScreen = false;
  }

  return {
    watch({ canvas, sizer }) {
      stop();
      watchedCanvas = canvas;
      sizeObserver.observe(sizer);
      screenObserver.observe(canvas);
    },
    stop,
    isOnScreen: () => onScreen,
  };
}
