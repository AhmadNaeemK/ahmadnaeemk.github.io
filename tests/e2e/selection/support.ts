/**
 * What the selection and conformance specs share. Everything here reads the
 * contract's attributes or what a visitor can see, so the specs keep passing when
 * real themes, the real engine and the real runtime replace the stubs.
 */
import {
  test as base,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  SCENE_STATE_ATTRIBUTE,
  SECTION_KEYS,
  sectionId,
  STORAGE_KEYS,
  THEME_HOOKS,
  THEME_ROOT_ATTRIBUTE,
  type SectionKey,
  type ThemeName,
} from "../../../src/scene/contract";
import { THEME_META } from "../../../src/themes/registry";

/** From the registry, so a new theme joins every parametrised spec by itself. */
export const THEMES = Object.keys(THEME_META) as ThemeName[];

export const PHONE = { width: 390, height: 844 };
export const DESKTOP = { width: 1280, height: 720 };

/** Every (from, to) pair of different themes. */
export const THEME_PAIRS = THEMES.flatMap((from) =>
  THEMES.filter((to) => to !== from).map((to) => ({ from, to })),
);

const FONT_HOSTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

/**
 * WebKit logs this when the page's own `rel="preconnect"` finds no network, which
 * is how these runs keep the fonts away, and more often under load. A route cannot
 * reach a preconnect. Only this message is dropped: a font stylesheet that fails, or
 * a preconnect to any other host, still counts.
 */
const BLOCKED_FONT_PRECONNECT =
  /^Failed to preconnect to https:\/\/fonts\.(googleapis|gstatic)\.com\/\. Error: /;

export const test = base.extend<{
  /** Every font stylesheet the page asked for, in order. */
  fontRequests: string[];
  /**
   * Uncaught errors and console errors, across every page of the test. Any uncaught
   * error fails the test by itself; console errors are for a spec to check, because
   * WebKit logs one when a reload interrupts a scene import.
   */
  pageProblems: string[];
  /** For a spec that fails a scene on purpose. */
  allowUncaughtErrors: boolean;
}>({
  allowUncaughtErrors: [false, { option: true }],
  fontRequests: [
    async ({ context }, use) => {
      const requests: string[] = [];
      // Keeps runs off the network, and lets a spec count what was asked for.
      await context.route(FONT_HOSTS, async (route) => {
        requests.push(route.request().url());
        await route.fulfill({ contentType: "text/css", body: "" });
      });
      await use(requests);
    },
    { auto: true },
  ],
  pageProblems: [
    async ({ context, allowUncaughtErrors }, use) => {
      const problems: string[] = [];
      const watch = (page: Page) => {
        page.on("pageerror", (error) => problems.push(`uncaught: ${error}`));
        page.on("console", (message) => {
          if (
            message.type() === "error" &&
            !BLOCKED_FONT_PRECONNECT.test(message.text())
          ) {
            problems.push(`console: ${message.text()}`);
          }
        });
      };
      context.pages().forEach(watch);
      context.on("page", watch);
      await use(problems);
      if (!allowUncaughtErrors) {
        expect(
          problems.filter((problem) => problem.startsWith("uncaught:")),
        ).toEqual([]);
      }
    },
    { auto: true },
  ],
});

export function fontStylesheetUrl(theme: ThemeName): string {
  return new URL(THEME_META[theme].fontStylesheet).href;
}

export function themeRoot(page: Page, theme: ThemeName): Locator {
  return page.locator(`[${THEME_ROOT_ATTRIBUTE}="${theme}"]`);
}

export async function expectShowing(
  page: Page,
  theme: ThemeName,
): Promise<void> {
  const showing = page.locator(`[${THEME_ROOT_ATTRIBUTE}]:visible`);
  await expect(showing).toHaveCount(1);
  await expect(showing).toHaveAttribute(THEME_ROOT_ATTRIBUTE, theme);
}

/** Saved before the first load only, so a reload sees what the page itself saved. */
export async function seedStorage(
  page: Page,
  entries: Record<string, string>,
): Promise<void> {
  await page.addInitScript((seed) => {
    try {
      if (sessionStorage.getItem("test-storage-seeded")) return;
      sessionStorage.setItem("test-storage-seeded", "1");
      for (const [key, value] of Object.entries(seed)) {
        localStorage.setItem(key, value);
      }
    } catch {
      // An opaque first document (about:blank) has no storage to seed.
    }
  }, entries);
}

export function readSavedTheme(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.theme);
}

/** Adds CSS at parse time, so it is in place for the page's own first layout. */
export async function serveWithCss(page: Page, css: string): Promise<void> {
  await page.route(
    (url) => url.pathname === "/",
    async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        "</head>",
        `<style>${css}</style></head>`,
      );
      await route.fulfill({ response, body });
    },
  );
}

/** Different per theme, so keeping the pixel offset cannot pass for keeping the section. */
const SECTION_HEIGHTS: Readonly<Record<ThemeName, number>> = {
  interchange: 1100,
  diorama: 1500,
  "pixel-depot": 1300,
};

function eachSectionSelector(theme: ThemeName, keys: readonly SectionKey[]) {
  return keys.map((key) => `[id="${sectionId(theme, key)}"]`).join(", ");
}

const BELOW_TOP = SECTION_KEYS.filter((key) => key !== "top");

/**
 * Stub pages are too short for a section to reach the viewport top. Scroll
 * anchoring is off because it can mask a broken pin in Chromium.
 */
export function tallSectionsCss(
  keys: readonly SectionKey[] = BELOW_TOP,
): string {
  const heights = THEMES.map(
    (theme) =>
      `${eachSectionSelector(theme, keys)} { min-height: ${SECTION_HEIGHTS[theme]}px !important; }`,
  );
  return ["html, body { overflow-anchor: none !important; }", ...heights].join(
    "\n",
  );
}

/** A late layout change the scene's first show will cause, whatever the theme. */
export const HERO_GROWS_WHEN_SCENE_STARTS = `
  :is([${SCENE_STATE_ATTRIBUTE}="running"], [${SCENE_STATE_ATTRIBUTE}="paused"]) [data-rail-hero] {
    padding-top: 240px !important;
  }
`;

/**
 * A pin re-scrolls by itself for 3 frames (contract, section 5). Past them, with
 * some margin, only what a pin answers can still move the page.
 */
const PIN_SETTLING_FRAMES = 3;
const FRAMES_PAST_PIN_SETTLING = PIN_SETTLING_FRAMES + 3;

/** Lets `n` frames pass in the page. */
export async function frames(page: Page, n = 2): Promise<void> {
  await page.evaluate(async (count) => {
    for (let frame = 0; frame < count; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, n);
}

export async function pastPinSettling(page: Page): Promise<void> {
  await frames(page, FRAMES_PAST_PIN_SETTLING);
}

/** Until the theme's scene has loaded or failed, so nothing is still moving the page. */
export async function sceneSettled(
  page: Page,
  theme: ThemeName,
): Promise<void> {
  await expect(themeRoot(page, theme)).toHaveAttribute(
    SCENE_STATE_ATTRIBUTE,
    /^(running|paused|failed)$/,
  );
}

/** Hidden themes are out of the accessibility tree, so this is the showing theme's. */
export function showingSwitcher(page: Page): Locator {
  return page.getByRole("navigation", { name: "Design theme" });
}

export function switcherToggle(page: Page): Locator {
  return showingSwitcher(page).getByRole("button", { name: /^Design theme:/ });
}

/** The showing theme's link for a theme, found whether or not the list is open. */
export function switcherChoice(page: Page, theme: ThemeName): Locator {
  return showingSwitcher(page).getByRole("link", {
    name: new RegExp(`^${THEME_META[theme].label}\\b`),
    includeHidden: true,
  });
}

/** Real clicks, for when the page's scroll position does not matter. */
export async function pickTheme(page: Page, theme: ThemeName): Promise<void> {
  await switcherToggle(page).click();
  await switcherChoice(page, theme).click();
}

/**
 * Picks without Playwright scrolling the switcher into view first, and without a
 * pointer press, so the scroll position under test stays the visitor's own.
 */
export async function pickThemeInPlace(
  page: Page,
  theme: ThemeName,
): Promise<void> {
  await switcherChoice(page, theme).dispatchEvent("click");
}

/** Puts the section where a visitor who reached it would have it. */
export async function scrollToSection(
  page: Page,
  theme: ThemeName,
  key: SectionKey,
): Promise<void> {
  await page.evaluate(
    (id) =>
      document
        .getElementById(id)
        ?.scrollIntoView({ block: "start", behavior: "instant" }),
    sectionId(theme, key),
  );
}

/**
 * How far the section sits from where a scroll to it would have put it. A section
 * whose margin asks for more than the page above it can give stops at scroll 0.
 */
export function sectionOffset(
  page: Page,
  theme: ThemeName,
  key: SectionKey,
): Promise<number> {
  return page.evaluate(
    (id) => {
      const section = document.getElementById(id);
      if (!section) return Number.NaN;
      const offset =
        section.getBoundingClientRect().top -
        (parseFloat(getComputedStyle(section).scrollMarginTop) || 0);
      return window.scrollY === 0 ? Math.max(offset, 0) : offset;
    },
    sectionId(theme, key),
  );
}

/** Scroll positions can be fractional, and the contract allows 1 px of that. */
const ON_TARGET = 1.5;

export async function expectSectionAtTop(
  page: Page,
  theme: ThemeName,
  key: SectionKey,
): Promise<void> {
  await expect
    .poll(async () => Math.abs(await sectionOffset(page, theme, key)), {
      message: `${sectionId(theme, key)} should be at the viewport top`,
    })
    .toBeLessThanOrEqual(ON_TARGET);
}

declare global {
  interface Window {
    testEventSeen?: Promise<void>;
  }
}

/**
 * Starts watching for `type`, so a later negative check can first prove the event
 * really happened. Returns what waits for it.
 */
export async function watchForEvent(
  page: Page,
  type: string,
): Promise<() => Promise<void>> {
  await page.evaluate((eventType) => {
    window.testEventSeen = new Promise<void>((resolve) =>
      window.addEventListener(eventType, () => resolve(), {
        capture: true,
        once: true,
      }),
    );
  }, type);
  return () => page.evaluate(() => window.testEventSeen);
}

/** Until the page has stopped moving: browsers can animate a restored scroll. */
export async function scrollAtRest(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const STILL_FRAMES = 10;
    let still = 0;
    let last = window.scrollY;
    while (still < STILL_FRAMES) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      still = window.scrollY === last ? still + 1 : 0;
      last = window.scrollY;
    }
  });
}

export function goToHash(page: Page, hash: string): Promise<void> {
  return page.evaluate((next) => {
    location.hash = next;
  }, hash);
}

export function hasSidewaysScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const { documentElement } = document;
    return documentElement.scrollWidth > documentElement.clientWidth;
  });
}

/**
 * The "Right now" shown to the eye: the HTML line, or the billboard the scene draws
 * when the runtime says `board`. Screen readers always keep the line, so that it
 * exists is no answer.
 */
export function shownRightNows(
  page: Page,
  theme: ThemeName,
): Promise<string[]> {
  return themeRoot(page, theme).evaluate(
    (root, { hero, canvas }) => {
      const shown: string[] = [];
      const seenAsBox = (element: Element | null) => {
        if (!element) return false;
        const { width, height } = element.getBoundingClientRect();
        return (
          width > 1 &&
          height > 1 &&
          getComputedStyle(element).display !== "none"
        );
      };
      root.querySelectorAll(".now").forEach((line) => {
        if (seenAsBox(line)) shown.push("html line");
      });
      const heroElement = root.querySelector(hero);
      if (
        heroElement?.getAttribute("data-now") === "board" &&
        seenAsBox(root.querySelector(canvas))
      ) {
        shown.push("billboard");
      }
      return shown;
    },
    { hero: THEME_HOOKS.hero, canvas: THEME_HOOKS.canvas },
  );
}

export function currentHash(page: Page): Promise<string> {
  return page.evaluate(() => location.hash);
}

/**
 * A real, loadable font of one empty glyph, because a pin answers a rise in the
 * count of loaded faces and nothing short of a real font raises it.
 */
export const LOADABLE_FONT_URL =
  "data:font/ttf;base64,AAEAAAAKAIAAAwAgT1MvMkD2QTgAAAEoAAAAYGNtYXAADABGAAABjAAAACxnbHlmAAAAAAAAAbwAAAABaGVhZC02rUYAAACsAAAANmhoZWEDIgEuAAAA5AAAACRobXR4AfQAAAAAAYgAAAAEbG9jYQAAAAAAAAG4AAAABG1heHAAAgACAAABCAAAACBuYW1lAJlcyAAAAcAAAAA8cG9zdAADAAAAAAH8AAAAJAABAAAAAQAAvb4EQF8PPPUAAwPoAAAAAOcQNjMAAAAA5xA2MwAAAAAAAAAAAAAAAwACAAAAAAAAAAEAAAMg/zgAAAH0AAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAEAAAABAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAwH0AZAABQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPz8/PwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAB9AAAAAAAAgAAAAMAAAAUAAMAAQAAABQABAAYAAAAAgACAAAAAP//AAD//wABAAAAAAAAAAAAAAAAAAQANgABAAAAAAABAAEAAAABAAAAAAACAAEAAQADAAEECQABAAIAAgADAAEECQACAAIABFRSAFQAUgACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAA==";

/**
 * Holds what matches `pattern` until released. Releasing proves something was held:
 * a pattern that stopped matching would otherwise leave its spec passing untested.
 */
async function holdRequests(
  page: Page,
  pattern: string,
): Promise<() => Promise<void>> {
  const held: (() => void)[] = [];
  let released = false;
  await page.route(pattern, async (route) => {
    if (!released) await new Promise<void>((resolve) => held.push(resolve));
    await route.fallback();
  });
  return async () => {
    await expect
      .poll(() => held.length, { message: `no request matched ${pattern}` })
      .toBeGreaterThan(0);
    released = true;
    held.forEach((release) => release());
  };
}

/** Holds each theme's lazy scene chunk, to make its first show late. */
export function holdSceneChunks(page: Page): Promise<() => Promise<void>> {
  return holdRequests(page, "**/_astro/scene.*.js");
}

/** Holds every built script, for what a visitor can do before any of them run. */
export function holdPageScripts(page: Page): Promise<() => Promise<void>> {
  return holdRequests(page, "**/_astro/*.js");
}

/** While a hold is meant to be working, the theme's scene must not have started. */
export async function expectSceneNotStarted(
  page: Page,
  theme: ThemeName,
): Promise<void> {
  await expect(themeRoot(page, theme)).not.toHaveAttribute(
    SCENE_STATE_ATTRIBUTE,
    /^(running|paused)$/,
  );
}
