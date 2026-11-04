/** Between the toggle and the list. */
const TOGGLE_GAP = 8;
/** The least the list keeps from the viewport's left and right edges. */
const VIEWPORT_MARGIN = 16;

export interface ListPlacementInput {
  readonly toggle: {
    readonly top: number;
    readonly bottom: number;
    readonly right: number;
  };
  /** The list's natural size, before any height limit. */
  readonly list: { readonly width: number; readonly height: number };
  readonly viewport: { readonly width: number; readonly height: number };
}

export interface ListPlacement {
  readonly top: number;
  readonly left: number;
  readonly maxHeight: number;
}

/**
 * Below the toggle and right-aligned with it, as the prototype has it. Above, only
 * when below is too short and above has more room, as at 400% zoom. The list follows
 * the toggle vertically, even off-screen, so scrolling moves them together.
 */
export function placeThemeList({
  toggle,
  list,
  viewport,
}: ListPlacementInput): ListPlacement {
  const roomBelow = viewport.height - toggle.bottom - TOGGLE_GAP;
  const roomAbove = toggle.top - TOGGLE_GAP;
  const goesAbove = list.height > roomBelow && roomAbove > roomBelow;
  const maxHeight = Math.max(goesAbove ? roomAbove : roomBelow, 0);

  const leftAtViewportEdge = viewport.width - VIEWPORT_MARGIN - list.width;
  const left = Math.max(
    Math.min(toggle.right - list.width, leftAtViewportEdge),
    VIEWPORT_MARGIN,
  );

  return {
    top: goesAbove
      ? toggle.top - TOGGLE_GAP - Math.min(list.height, maxHeight)
      : toggle.bottom + TOGGLE_GAP,
    left,
    maxHeight,
  };
}
