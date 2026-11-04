/**
 * What the theme switcher adds once scripts run: placing the list by its toggle, its
 * keys, and choosing without following the link. Before that, `popover` and real
 * links already work, and the browser keeps outside clicks and Escape throughout.
 */
import {
  isThemeName,
  showingTheme,
  THEME_ATTRIBUTE,
  THEME_HOOKS,
  themeRootElement,
} from "../scene/contract";
import { chooseTheme } from "../scene/theme";
import { placeThemeList } from "./theme-list-placement";

const LIST_SELECTOR = ".dd__list";

/** Safari before 17 has no `popover`, and `:popover-open` throws in its selectors. */
const HAS_POPOVER = "showPopover" in HTMLElement.prototype;
const FALLBACK_OPEN_ATTRIBUTE = "data-open";

interface SwitcherParts {
  readonly toggle: HTMLButtonElement;
  readonly list: HTMLElement;
  readonly links: readonly HTMLAnchorElement[];
}

function findParts(switcher: HTMLElement): SwitcherParts | null {
  const toggle = switcher.querySelector("button");
  const list = switcher.querySelector<HTMLElement>(LIST_SELECTOR);
  if (!toggle || !list) return null;
  return { toggle, list, links: [...list.querySelectorAll("a")] };
}

function isOpen(list: HTMLElement): boolean {
  return HAS_POPOVER
    ? list.matches(":popover-open")
    : list.hasAttribute(FALLBACK_OPEN_ATTRIBUTE);
}

function setListOpen(list: HTMLElement, open: boolean): void {
  if (HAS_POPOVER) {
    if (open) list.showPopover();
    else list.hidePopover();
    return;
  }
  // Fired by hand, so what listens for the browser's own event needs no other path.
  list.dispatchEvent(
    Object.assign(new Event("beforetoggle"), {
      newState: open ? "open" : "closed",
    }),
  );
  list.toggleAttribute(FALLBACK_OPEN_ATTRIBUTE, open);
}

function hasCommandModifier(event: KeyboardEvent | MouseEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey;
}

function placeList({ toggle, list }: SwitcherParts): void {
  const { top, left, maxHeight } = placeThemeList({
    toggle: toggle.getBoundingClientRect(),
    list: {
      width: list.offsetWidth,
      // The natural height, whatever limit the last placement set. Clearing that
      // limit to measure would reset the list's own scroll on every page scroll.
      height: list.scrollHeight + list.offsetHeight - list.clientHeight,
    },
    viewport: {
      width: document.documentElement.clientWidth,
      height: window.innerHeight,
    },
  });
  list.style.margin = "0";
  list.style.inset = `${top}px auto auto ${left}px`;
  list.style.maxHeight = `${maxHeight}px`;
}

/** A fixed list has to be moved by hand when the page or the viewport moves it. */
function followToggleUntilClosed(parts: SwitcherParts): void {
  const place = () => placeList(parts);
  const following = new AbortController();
  const options = { passive: true, signal: following.signal };
  window.addEventListener("scroll", place, options);
  window.addEventListener("resize", place, options);
  parts.list.addEventListener("beforetoggle", () => following.abort(), {
    once: true,
    signal: following.signal,
  });
  place();
}

/** A short viewport limits the list's height, so a link can be scrolled out of it. */
function focusLink(link: HTMLAnchorElement | undefined): void {
  link?.focus({ preventScroll: true });
  link?.scrollIntoView({ block: "nearest", behavior: "instant" });
}

function openList(parts: SwitcherParts): void {
  const { list, links } = parts;
  if (!isOpen(list)) {
    setListOpen(list, true);
    followToggleUntilClosed(parts);
  }
  focusLink(
    links.find((link) => link.hasAttribute("aria-current")) ?? links[0],
  );
}

/** Focus sits in the list while it is open, and closing would drop it on the body. */
function closeToToggle({ toggle, list }: SwitcherParts): void {
  setListOpen(list, false);
  toggle.focus({ preventScroll: true });
}

function bindToggle(parts: SwitcherParts): void {
  const { toggle, list } = parts;

  // Taken over from the browser so the list opens placed, in one task, with no frame
  // at the centre of the viewport.
  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    if (isOpen(list)) closeToToggle(parts);
    else openList(parts);
  });

  toggle.addEventListener("keydown", (event) => {
    if (hasCommandModifier(event)) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openList(parts);
    }
  });

  // Also hears what the browser closes itself: an outside click, or Escape.
  list.addEventListener("beforetoggle", (event) => {
    toggle.setAttribute("aria-expanded", String(event.newState === "open"));
  });

  // A step through history moves the page under the list, even on the same theme.
  window.addEventListener("popstate", () => {
    if (isOpen(list)) closeToToggle(parts);
  });

  if (!HAS_POPOVER) {
    document.addEventListener("click", ({ target }) => {
      const outside =
        target instanceof Node &&
        !toggle.contains(target) &&
        !list.contains(target);
      if (outside && isOpen(list)) setListOpen(list, false);
    });
  }

  toggle.setAttribute("aria-expanded", String(isOpen(list)));
  // Opened before this script ran, so it is still where the browser centred it.
  if (isOpen(list)) followToggleUntilClosed(parts);
}

function bindListKeys(parts: SwitcherParts): void {
  const { list, links } = parts;
  const lastIndex = links.length - 1;

  const focusIndexByKey: Readonly<Record<string, (index: number) => number>> = {
    ArrowDown: (index) => (index === lastIndex ? 0 : index + 1),
    ArrowUp: (index) => (index === 0 ? lastIndex : index - 1),
    Home: () => 0,
    End: () => lastIndex,
  };

  const actionByKey: Readonly<
    Record<string, (event: KeyboardEvent, link: HTMLAnchorElement) => void>
  > = {
    Escape: (event) => {
      event.preventDefault();
      closeToToggle(parts);
    },
    // No preventDefault: from the toggle, Tab moves on past the closed list.
    Tab: () => closeToToggle(parts),
    // Links answer Enter by themselves, and Space would scroll the page.
    " ": (event, link) => {
      event.preventDefault();
      if (!event.repeat) link.click();
    },
  };

  list.addEventListener("keydown", (event) => {
    const link = event.target;
    if (hasCommandModifier(event) || !(link instanceof HTMLAnchorElement)) {
      return;
    }
    actionByKey[event.key]?.(event, link);
    const focusIndex = focusIndexByKey[event.key];
    if (focusIndex) {
      event.preventDefault();
      focusLink(links[focusIndex(links.indexOf(link))]);
    }
  });
}

/** A held key would open the list, pick from it and open it again, over and over. */
function ignoreHeldActivationKey(event: KeyboardEvent): void {
  if (event.repeat && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
  }
}

function bindChoices(parts: SwitcherParts): void {
  for (const link of parts.links) {
    link.addEventListener("click", (event) => {
      // A modified click opens a new tab, which is a shared link and not a pick.
      if (hasCommandModifier(event) || event.shiftKey) return;
      const theme = link.dataset.themeChoice;
      if (!isThemeName(theme)) return;
      event.preventDefault();
      if (isOpen(parts.list)) closeToToggle(parts);
      chooseTheme(theme);
    });
  }
}

/**
 * A theme hidden with its list open would show it open again on coming back. Only a
 * link followed before scripts ran gets here: it changes the theme when scripts start,
 * with no history step and without going through the switcher.
 */
function closeListsOfHiddenThemes(): void {
  const showingRoot = themeRootElement(showingTheme());
  const lists = document.querySelectorAll<HTMLElement>(
    `${THEME_HOOKS.themeSwitcher} ${LIST_SELECTOR}`,
  );
  for (const list of lists) {
    if (isOpen(list) && !showingRoot?.contains(list)) setListOpen(list, false);
  }
}

export function startThemeSwitchers(): void {
  for (const switcher of document.querySelectorAll<HTMLElement>(
    THEME_HOOKS.themeSwitcher,
  )) {
    const parts = findParts(switcher);
    if (!parts) continue;
    bindToggle(parts);
    bindListKeys(parts);
    bindChoices(parts);
    switcher.addEventListener("keydown", ignoreHeldActivationKey);
  }

  closeListsOfHiddenThemes();
  new MutationObserver(closeListsOfHiddenThemes).observe(
    document.documentElement,
    { attributes: true, attributeFilter: [THEME_ATTRIBUTE] },
  );
}
