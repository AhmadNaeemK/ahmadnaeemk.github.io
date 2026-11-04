import { HIT_RADIUS, type CanvasPoint } from "./contract";
import type { TrainControls } from "./controls";

/**
 * Nothing here calls `preventDefault` on a pointer or touch event, captures the
 * pointer or sets `touch-action`, because a drag on the canvas scrolls the page.
 * A tap arrives as `click`.
 */
export function bindCanvasInput(
  canvas: HTMLCanvasElement,
  hitsTrain: (point: CanvasPoint, radius: number) => boolean,
  pressStop: TrainControls["pressStop"],
): void {
  const canvasPoint = (event: MouseEvent): CanvasPoint => {
    const { left, top } = canvas.getBoundingClientRect();
    return { x: event.clientX - left, y: event.clientY - top };
  };

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    canvas.style.cursor = hitsTrain(canvasPoint(event), HIT_RADIUS.hover)
      ? "pointer"
      : "";
  });
  canvas.addEventListener("click", (event) => {
    if (hitsTrain(canvasPoint(event), HIT_RADIUS.click)) pressStop();
  });
}

const OWN_KEYBOARD_BEHAVIOUR = "a, button, input, select, textarea";
const SPEED_STEP_BY_KEY: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  "+": 1,
  ArrowLeft: -1,
  "-": -1,
};

/**
 * Keys count only with focus on the hero itself or its plain content, and only
 * while its scene shows. Modified keys stay with the browser, such as Alt+Left
 * for back and Shift+Space for scrolling up.
 */
export function bindHeroKeys(
  hero: HTMLElement,
  isShowing: () => boolean,
  controls: TrainControls,
): void {
  hero.addEventListener("keydown", (event) => {
    if (!isShowing() || event.altKey || event.ctrlKey || event.metaKey) return;
    if (
      event.target instanceof Element &&
      event.target.closest(OWN_KEYBOARD_BEHAVIOUR)
    ) {
      return;
    }
    if (event.key === " ") {
      if (event.shiftKey) return;
      event.preventDefault();
      if (!event.repeat) controls.pressStop();
      return;
    }
    const speedStep = SPEED_STEP_BY_KEY[event.key];
    if (speedStep) controls.stepSpeed(speedStep);
  });
}
