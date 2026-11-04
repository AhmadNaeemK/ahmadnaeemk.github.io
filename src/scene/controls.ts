import type { World } from "../rail";
import { THEME_HOOKS } from "./contract";
import { saveLivery } from "./saved-livery";

interface ToggleAppearance {
  readonly state: "go" | "stop";
  readonly pressed: boolean;
  readonly label: string;
}

const RUNNING: ToggleAppearance = {
  state: "go",
  pressed: false,
  label: "Stop the train",
};
const REDUCED_MOTION_START: ToggleAppearance = {
  state: "stop",
  pressed: false,
  label: "Pause the text",
};
const STOPPED: ToggleAppearance = {
  state: "stop",
  pressed: true,
  label: "Start the train",
};

type StopFlags = Pick<World, "userStopped" | "textPaused">;

const isReducedMotionStart = ({ userStopped, textPaused }: StopFlags) =>
  userStopped && !textPaused;

/** The table in section 7 of the contract, with its compact exception. */
export function toggleAppearance(
  flags: StopFlags,
  compact: boolean,
): ToggleAppearance {
  if (!flags.userStopped) return RUNNING;
  return isReducedMotionStart(flags) && !compact
    ? REDUCED_MOTION_START
    : STOPPED;
}

/** Every way a visitor changes the world, each followed by a state write. */
export interface TrainControls {
  /** The control, the press on the train and the Space key all come here. */
  pressStop(): void;
  stepSpeed(change: number): void;
  /** Writes state to every theme's controls, so a hidden theme is right when shown. */
  sync(): void;
}

interface TrainControlsOptions {
  readonly world: World;
  readonly themeRoots: readonly HTMLElement[];
  /** The showing scene's current size, since the toggle follows the width. */
  readonly isCompact: () => boolean;
}

export function createTrainControls(
  options: TrainControlsOptions,
): TrainControls {
  const { world, themeRoots, isCompact } = options;

  const toggles = themeRoots.flatMap((root) => [
    ...root.querySelectorAll<HTMLElement>(THEME_HOOKS.toggle),
  ]);
  const speedButtons = themeRoots.flatMap((root) => [
    ...root.querySelectorAll<HTMLElement>(THEME_HOOKS.speed),
  ]);
  const liveryButtons = themeRoots.flatMap((root) => [
    ...root.querySelectorAll<HTMLElement>(THEME_HOOKS.livery),
  ]);
  const toggleLabels = toggles.map((toggle) =>
    toggle.querySelector(THEME_HOOKS.toggleLabel),
  );

  function sync(): void {
    const { state, pressed, label } = toggleAppearance(world, isCompact());
    toggles.forEach((toggle, index) => {
      toggle.dataset.state = state;
      toggle.setAttribute("aria-pressed", String(pressed));
      toggle.setAttribute("aria-label", label);
      const labelElement = toggleLabels[index];
      if (labelElement) labelElement.textContent = label;
    });
    for (const button of speedButtons) {
      const isCurrent = Number(button.dataset.railSpeed) === world.speedIndex;
      button.setAttribute(
        "aria-pressed",
        String(isCurrent && !world.userStopped),
      );
    }
    for (const button of liveryButtons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.railLivery === world.liveryId),
      );
    }
  }

  function pressStop(): void {
    // Nothing moves at compact widths on this start, so there is no text to
    // pause and the press goes straight to starting the train.
    if (isReducedMotionStart(world) && isCompact()) world.toggleStop(false);
    else world.toggleStop();
    sync();
  }

  function stepSpeed(change: number): void {
    world.setSpeed(world.speedIndex + change);
    sync();
  }

  for (const toggle of toggles) toggle.addEventListener("click", pressStop);
  for (const button of speedButtons) {
    button.addEventListener("click", () => {
      world.setSpeed(Number(button.dataset.railSpeed));
      sync();
    });
  }
  for (const button of liveryButtons) {
    button.addEventListener("click", () => {
      world.setLivery(button.dataset.railLivery ?? "");
      saveLivery(world.liveryId);
      sync();
    });
  }
  sync();

  return { pressStop, stepSpeed, sync };
}
