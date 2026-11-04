/**
 * What follows the showing theme and colour scheme but sits outside any theme
 * root: font stylesheets, the colour toggles and the page canvas. All of it hangs
 * off the attributes on `<html>`, so it holds however they were written.
 */
import {
  COLOR_SCHEME_ATTRIBUTE,
  effectiveColorScheme,
  showingTheme,
  STORAGE_KEYS,
  THEME_ATTRIBUTE,
  THEME_HOOKS,
  themeRootElement,
  type ColorScheme,
  type ThemeName,
} from "../scene/contract";
import { THEME_META } from "../themes/registry";

/** Read by `html` and `body::before` in `global.css`. */
const PAGE_CANVAS_PROPERTY = "--rail-page-canvas";

function saveColorScheme(scheme: ColorScheme): void {
  try {
    localStorage.setItem(STORAGE_KEYS.colorScheme, scheme);
  } catch {
    // Private windows can refuse storage; the attribute still holds for this tab.
  }
}

export function startPageAppearance(): void {
  const html = document.documentElement;
  const systemDark = matchMedia("(prefers-color-scheme: dark)");
  const requestedFonts = new Set<ThemeName>();

  const isDark = () => effectiveColorScheme() === "dark";

  function requestFontStylesheet(theme: ThemeName): void {
    if (requestedFonts.has(theme)) return;
    requestedFonts.add(theme);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = THEME_META[theme].fontStylesheet;
    document.head.append(link);
  }

  /**
   * Overscroll and the safe area paint outside every theme root, and tokens
   * cannot flow up to `html`, so the showing theme's `--bg` is copied there.
   */
  function syncPageCanvas(theme: ThemeName): void {
    const root = themeRootElement(theme);
    const canvas = root && getComputedStyle(root).getPropertyValue("--bg");
    if (canvas) html.style.setProperty(PAGE_CANVAS_PROPERTY, canvas.trim());
    else html.style.removeProperty(PAGE_CANVAS_PROPERTY);
  }

  function syncToggles(): void {
    const dark = isDark();
    for (const toggle of document.querySelectorAll(
      THEME_HOOKS.colorSchemeToggle,
    )) {
      toggle.setAttribute("aria-pressed", String(dark));
      toggle.setAttribute(
        "aria-label",
        dark ? "Switch to light theme" : "Switch to dark theme",
      );
    }
  }

  function sync(): void {
    const theme = showingTheme();
    requestFontStylesheet(theme);
    syncPageCanvas(theme);
    syncToggles();
  }

  for (const toggle of document.querySelectorAll(
    THEME_HOOKS.colorSchemeToggle,
  )) {
    toggle.addEventListener("click", () => {
      const scheme: ColorScheme = isDark() ? "light" : "dark";
      html.setAttribute(COLOR_SCHEME_ATTRIBUTE, scheme);
      saveColorScheme(scheme);
    });
  }

  new MutationObserver(sync).observe(html, {
    attributes: true,
    attributeFilter: [THEME_ATTRIBUTE, COLOR_SCHEME_ATTRIBUTE],
  });
  systemDark.addEventListener("change", sync);
  // The system scheme can change while a page sits frozen in the bfcache.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) sync();
  });
  sync();
}
