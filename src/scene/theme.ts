/**
 * Theme selection after load: choosing a theme, following the hash, and keeping
 * the visitor's section across a switch (contract, sections 4 and 5). The first
 * selection is made by the inline head script in `src/layouts/Base.astro`, which
 * cannot import this module. Scenes only observe the attribute written here.
 */
import {
  DEFAULT_THEME,
  HEADER_HEIGHT_PROPERTY,
  isThemeName,
  SCENE_STATE_ATTRIBUTE,
  SECTION_KEYS,
  sectionId,
  showingTheme,
  STORAGE_KEYS,
  THEME_ATTRIBUTE,
  THEME_HOOKS,
  themeFromHash,
  themeHash,
  themeRootElement,
  type SectionKey,
  type ThemeName,
} from "./contract";

/** Absorbs the fraction of a pixel a scroll can land short of its target. */
const SECTION_TOP_TOLERANCE = 1;

/**
 * Frames the pin re-scrolls unconditionally after a switch. A smooth scroll from
 * a section link survives the switch's instant scroll in Chromium and carries the
 * page far from the section, and a same-position instant scroll beforehand does
 * not stop it. One re-scroll a frame later did in every run; the rest are margin.
 */
const SMOOTH_SCROLL_SETTLING_FRAMES = 3;

/** Without input a pin would measure the page for as long as it stays open. */
const PIN_TIME_LIMIT_MS = 10_000;

/**
 * What ends a pin, besides the time limit and the next pin. Never `scroll`, because
 * the pin's own scrolls fire it too. `popstate` as well as `hashchange`, because a
 * step between entries with the same hash fires only `popstate`, and a late layout
 * change would otherwise undo the scroll it restores.
 */
const PIN_ENDING_EVENTS = [
  "wheel",
  "touchmove",
  "pointerdown",
  "keydown",
  "hashchange",
  "popstate",
] as const;

export interface ScrollMeasure {
  readonly scrollY: number;
  readonly viewportHeight: number;
  readonly scrollHeight: number;
  /** In document order; `top` is relative to the viewport. */
  readonly sections: readonly {
    readonly key: SectionKey;
    readonly top: number;
    readonly scrollMarginTop: number;
  }[];
}

/** Step 1 of the contract's section 5: which section the visitor is reading. */
export function sectionKeyInView(measure: ScrollMeasure): SectionKey {
  const { scrollY, viewportHeight, scrollHeight, sections } = measure;
  // A short last section may never reach the viewport top.
  if (
    scrollY > 0 &&
    scrollY + viewportHeight >= scrollHeight - SECTION_TOP_TOLERANCE
  ) {
    return "contact";
  }
  return (
    sections.findLast(
      ({ top, scrollMarginTop }) =>
        top <= scrollMarginTop + SECTION_TOP_TOLERANCE,
    )?.key ?? "top"
  );
}

/** The section a hash names, or null for a theme hash or any other hash. */
export function sectionKeyFromHash(hash: string): SectionKey | null {
  const theme = themeFromHash(hash);
  if (!theme) return null;
  return (
    SECTION_KEYS.find((key) => hash === `#${sectionId(theme, key)}`) ?? null
  );
}

/** Keeps a choice for this tab when storage refuses it. */
let sessionChoice: ThemeName | null = null;

function savedTheme(): ThemeName | null {
  if (sessionChoice) return sessionChoice;
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    return isThemeName(saved) ? saved : null;
  } catch {
    return null;
  }
}

function saveTheme(theme: ThemeName): void {
  try {
    localStorage.setItem(STORAGE_KEYS.theme, theme);
    sessionChoice = null;
  } catch {
    sessionChoice = theme;
  }
}

function sectionElement(theme: ThemeName, key: SectionKey): HTMLElement | null {
  return document.getElementById(sectionId(theme, key));
}

function measureScroll(theme: ThemeName): ScrollMeasure {
  return {
    scrollY: window.scrollY,
    viewportHeight: window.innerHeight,
    scrollHeight: document.documentElement.scrollHeight,
    sections: SECTION_KEYS.flatMap((key) => {
      const element = sectionElement(theme, key);
      if (!element) return [];
      return [
        {
          key,
          top: element.getBoundingClientRect().top,
          scrollMarginTop:
            parseFloat(getComputedStyle(element).scrollMarginTop) || 0,
        },
      ];
    }),
  };
}

/** Writes the tracked header's height now; nothing is tracked until a theme shows. */
let measureHeader: () => void = () => {};
let headerObserver: ResizeObserver | null = null;

/**
 * Keeps a section's `scroll-margin-top` true to the shown header through font swaps
 * and zoom. This cannot loop, because the height feeds nothing that sizes the header.
 */
function trackHeaderHeight(theme: ThemeName): void {
  const root = themeRootElement(theme);
  const header = root
    ?.querySelector(THEME_HOOKS.themeSwitcher)
    ?.closest("header");
  if (!root || !header) return;
  measureHeader = () => {
    const height = Math.ceil(header.getBoundingClientRect().height);
    root.style.setProperty(HEADER_HEIGHT_PROPERTY, `${height}px`);
  };
  measureHeader();
  headerObserver?.disconnect();
  headerObserver = new ResizeObserver(measureHeader);
  headerObserver.observe(header);
}

/**
 * The default is "instant" and not "auto": `html { scroll-behavior: smooth }` would
 * turn "auto" into an animation. It measures first because a pin can run in the frame
 * a font lands, before the observer hears of the header's new height.
 */
function scrollToSection(
  theme: ThemeName,
  key: SectionKey,
  behavior: ScrollBehavior = "instant",
): void {
  measureHeader();
  sectionElement(theme, key)?.scrollIntoView({ block: "start", behavior });
}

/**
 * The `scrollY` that puts a section at the viewport top. Scrolling leaves it alone
 * and only a layout change moves it, so a pin can read it during a smooth scroll.
 */
function sectionRestingScrollY(theme: ThemeName, key: SectionKey): number {
  const section = sectionElement(theme, key);
  if (!section) return 0;
  return (
    section.getBoundingClientRect().top +
    window.scrollY -
    (parseFloat(getComputedStyle(section).scrollMarginTop) || 0)
  );
}

function hasMoved(restingScrollY: number, lastSeen: number): boolean {
  return Math.abs(restingScrollY - lastSeen) > SECTION_TOP_TOLERANCE;
}

let endPin: (() => void) | null = null;

/** Runs `keepSection` every frame until the pin ends (section 5). */
function startPin(keepSection: () => void, onEnd?: () => void): void {
  endPin?.();
  let frameRequest = requestAnimationFrame(function onFrame() {
    keepSection();
    frameRequest = requestAnimationFrame(onFrame);
  });

  const listeners = new AbortController();
  const end = () => {
    onEnd?.();
    cancelAnimationFrame(frameRequest);
    clearTimeout(timeLimit);
    listeners.abort();
    endPin = null;
  };
  const timeLimit = setTimeout(end, PIN_TIME_LIMIT_MS);
  for (const type of PIN_ENDING_EVENTS) {
    window.addEventListener(type, end, {
      capture: true,
      passive: true,
      signal: listeners.signal,
    });
  }
  endPin = end;
}

/** Holds a section in place while the incoming theme settles (section 5). */
function pinSection(theme: ThemeName, key: SectionKey): void {
  let lastSeen = sectionRestingScrollY(theme, key);
  const repin = () => {
    scrollToSection(theme, key);
    lastSeen = sectionRestingScrollY(theme, key);
  };

  // A MutationObserver runs before the next paint, so the shift never shows.
  const stateObserver = new MutationObserver(repin);
  const root = themeRootElement(theme);
  if (root) {
    stateObserver.observe(root, {
      attributes: true,
      attributeFilter: [SCENE_STATE_ATTRIBUTE],
    });
  }

  let framesToSettle = SMOOTH_SCROLL_SETTLING_FRAMES;
  startPin(
    () => {
      if (
        framesToSettle > 0 ||
        hasMoved(sectionRestingScrollY(theme, key), lastSeen)
      ) {
        repin();
      }
      framesToSettle -= 1;
    },
    () => stateObserver.disconnect(),
  );
}

/**
 * Sees a clicked link's smooth scroll to the right place. The browser fixes that
 * scroll's end when it starts, so a section that moves needs a new one, and "auto"
 * carries on from where the page is instead of jumping. Reduced motion makes it instant.
 */
function pinClickedSection(
  theme: ThemeName,
  key: SectionKey,
  restingScrollYAtClick: number,
): void {
  let lastSeen = restingScrollYAtClick;
  startPin(() => {
    if (!hasMoved(sectionRestingScrollY(theme, key), lastSeen)) return;
    scrollToSection(theme, key, "auto");
    lastSeen = sectionRestingScrollY(theme, key);
  });
}

/**
 * The section in view when `popstate` fired, for the hash it landed on. Both
 * browsers fire `popstate` on every fragment navigation, and WebKit restores the
 * scroll between it and `hashchange`. Measuring at `hashchange` would read the
 * outgoing theme's layout at a position saved for the other theme, and the section
 * would walk on every back and forward.
 */
let sectionBeforeHistoryStep: { hash: string; key: SectionKey } | null = null;

/** The whole of section 5's one synchronous step, plus the pin that follows. */
function switchTheme(
  incoming: ThemeName,
  requestedKey: SectionKey | null,
): void {
  sectionBeforeHistoryStep = null;
  const key = requestedKey ?? sectionKeyInView(measureScroll(showingTheme()));
  document.documentElement.setAttribute(THEME_ATTRIBUTE, incoming);
  trackHeaderHeight(incoming);
  scrollToSection(incoming, key);

  // No history entry and no hashchange, and a stale `#a-about` cannot bring the
  // old theme back on reload.
  const hash = sectionKeyFromHash(location.hash)
    ? `#${sectionId(incoming, key)}`
    : themeHash(incoming);
  history.replaceState(history.state, "", hash);

  pinSection(incoming, key);
}

/** Focus would otherwise fall to the body once the old theme hides. */
function focusThemeSwitcher(theme: ThemeName): void {
  const switcher = themeRootElement(theme)?.querySelector(
    THEME_HOOKS.themeSwitcher,
  );
  const target =
    switcher?.querySelector<HTMLElement>('[aria-current="true"]') ??
    switcher?.querySelector<HTMLElement>("a, button");
  target?.focus({ preventScroll: true });
}

/** The visitor picked a theme. */
export function chooseTheme(theme: ThemeName): void {
  saveTheme(theme);
  if (theme === showingTheme()) return;
  switchTheme(theme, null);
  focusThemeSwitcher(theme);
}

function noteSectionBeforeHistoryStep(): void {
  sectionBeforeHistoryStep = {
    hash: location.hash,
    key: sectionKeyInView(measureScroll(showingTheme())),
  };
}

/**
 * A clicked link to a section of the showing theme, until its `hashchange`. Measured
 * at the click because a font can land before that `hashchange` fires.
 */
let clickedLink: { hash: string; restingScrollY: number } | null = null;

function noteClickedLink(event: MouseEvent): void {
  const plain =
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey;
  const hash =
    plain && event.target instanceof Element
      ? event.target.closest("a")?.hash
      : null;
  const key = hash && hash !== location.hash ? sectionKeyFromHash(hash) : null;
  const theme = showingTheme();
  clickedLink =
    hash && key && themeFromHash(hash) === theme
      ? { hash, restingScrollY: sectionRestingScrollY(theme, key) }
      : null;
}

/**
 * The theme follows the hash, and shows what a reload of this hash would show. A
 * link is not a pick, so nothing is saved. With the theme unchanged, the
 * browser has already done any scrolling, but a clicked section link can still land
 * off target if a font or the scene moves the section during it, so it gets a pin of
 * its own, which leaves the link's smooth scroll running.
 */
function followHash(): void {
  const clicked = clickedLink?.hash === location.hash ? clickedLink : null;
  clickedLink = null;

  // Compared by hash as a defence for a browser outside the test matrix that fires
  // no `popstate` on a fragment navigation, which would meet an older note.
  const keyBeforeStep =
    sectionBeforeHistoryStep?.hash === location.hash
      ? sectionBeforeHistoryStep.key
      : null;
  sectionBeforeHistoryStep = null;

  const incoming =
    themeFromHash(location.hash) ?? savedTheme() ?? DEFAULT_THEME;
  const outgoing = showingTheme();
  if (incoming === outgoing) {
    const linkedKey = sectionKeyFromHash(location.hash);
    if (linkedKey && clicked) {
      pinClickedSection(incoming, linkedKey, clicked.restingScrollY);
    }
    return;
  }

  const hadFocus = themeRootElement(outgoing)?.contains(document.activeElement);
  switchTheme(incoming, sectionKeyFromHash(location.hash) ?? keyBeforeStep);
  if (hadFocus) focusThemeSwitcher(incoming);
}

/**
 * True for a link opened or typed. A reload or a history step restores the
 * visitor's own scroll position, which a pin must not take back.
 */
function isFreshNavigation(): boolean {
  const [navigation] = performance.getEntriesByType(
    "navigation",
  ) as PerformanceNavigationTiming[];
  return navigation?.type === "navigate";
}

export function startThemeSelection(): void {
  trackHeaderHeight(showingTheme());
  document.addEventListener("click", noteClickedLink);
  window.addEventListener("popstate", noteSectionBeforeHistoryStep);
  window.addEventListener("hashchange", followHash);

  // A link clicked before this module ran changed the hash after the head script
  // chose the theme. Does nothing when the two already agree, as on a normal load.
  followHash();

  // A shared section link is a first show too: the browser has scrolled to
  // the section, and the same late changes would move it away again.
  const linkedKey = sectionKeyFromHash(location.hash);
  if (linkedKey && isFreshNavigation()) pinSection(showingTheme(), linkedKey);
}
