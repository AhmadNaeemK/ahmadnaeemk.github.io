/** The fixture, plus what specs do to a page and read back from its attributes. */
import {
  expect,
  test as base,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  COLOR_SCHEME_ATTRIBUTE,
  NOW_ATTRIBUTE,
  SCENE_STATE_ATTRIBUTE,
  THEME_ATTRIBUTE,
  THEME_HOOKS,
  THEME_ROOT_ATTRIBUTE,
  type SceneState,
  type ThemeName,
} from "../../../src/scene/contract";
import { addSceneSpy } from "./scene-spy";

/** One glyph, generated for these tests, so a real font face can load offline. */
const TEST_FONT_BASE64 =
  "AAEAAAAKAIAAAwAgT1MvMlUMU9kAAACsAAAAVmNtYXAADAAmAAABBAAAACRnbHlmAvYE7AAAASgAAAAkaGVhZGEHQtoAAAFMAAAANmhoZWEFFgGSAAABhAAAACRobXR4AlgAAAAAAagAAAAEbG9jYQAAACQAAAGsAAAACG1heHAAAwAFAAABtAAAACBuYW1lAP4I8QAAAdQAAAAmcG9zdAADAAAAAAH8AAAAIAABAfQBkAAFAAAAZABkAAAAAABkAGQAAAAAADIAZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOT05FAEAAIP//AyD/OAAAAyAAyAAAAAAAAAAAAAAAAAABAAMAAQAAAAwABAAYAAAAAgACAAAAAP//AAD//wABAAAAAQAAAAAB9AH0AAMAAAEBAQEAAAH0AAD+DAAAAAAB9AAAAAAAAQAAAAEAACKJUF9fDzz1AAAD6AAAAAAAAAAAAAAAAAAAAAAAAAAAAfQB9AAAAAgAAgABAAAAAAABAAADIP84AAACWAAAAAAB9AABAAAAAAAAAAAAAAAAAAAAAQJYAAAAAAAAAAAAJAABAAAAAQAEAAEAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAgAeAAMAAQQJAAEACAAAAAMAAQQJAAQACAAAAFQAZQBzAHQAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/** Everything a spec has to expect explicitly, or the test fails at its end. */
export interface PageProblems {
  pageErrors: string[];
  sceneErrors: string[];
}

export const test = base.extend<{ problems: PageProblems }>({
  problems: [
    async ({ page }, use) => {
      const problems: PageProblems = { pageErrors: [], sceneErrors: [] };
      page.on("pageerror", (error) => problems.pageErrors.push(error.message));
      page.on("console", (message) => {
        if (
          message.type() === "error" &&
          /Scene for theme/.test(message.text())
        ) {
          problems.sceneErrors.push(message.text());
        }
      });
      // Theme fonts are not what these specs test, and they stay offline.
      await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
        route.abort(),
      );
      await use(problems);
      expect(problems.pageErrors, "uncaught page errors").toEqual([]);
      expect(problems.sceneErrors, "scene failures").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export const root = (page: Page, theme: ThemeName): Locator =>
  page.locator(`[${THEME_ROOT_ATTRIBUTE}="${theme}"]`);
export const hero = (page: Page, theme: ThemeName): Locator =>
  root(page, theme).locator(THEME_HOOKS.hero);
export const canvas = (page: Page, theme: ThemeName): Locator =>
  root(page, theme).locator(THEME_HOOKS.canvas);
export const toggle = (page: Page, theme: ThemeName): Locator =>
  root(page, theme).locator(THEME_HOOKS.toggle);
/** `[data-x]` becomes `[data-x="value"]`. */
const hookWithValue = (hook: string, value: string | number) =>
  `${hook.slice(0, -1)}="${value}"]`;
export const speedButton = (page: Page, theme: ThemeName, index: number) =>
  root(page, theme).locator(hookWithValue(THEME_HOOKS.speed, index));
export const liveryButton = (page: Page, theme: ThemeName, id: string) =>
  root(page, theme).locator(hookWithValue(THEME_HOOKS.livery, id));

interface OpenOptions {
  readonly reducedMotion?: boolean;
  /** Stops at `commit`, for a page whose chunks a spec is holding back. */
  readonly waitForRunning?: boolean;
}

/** Loads the page with spies in place and, by default, Interchange running. */
export async function openScenePage(
  page: Page,
  { reducedMotion = false, waitForRunning = true }: OpenOptions = {},
): Promise<void> {
  if (reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
  await addSceneSpy(page);
  await page.goto("/", { waitUntil: waitForRunning ? "load" : "commit" });
  if (waitForRunning) await expectState(page, "interchange", "running");
}

export const expectState = (
  page: Page,
  theme: ThemeName,
  state: SceneState,
): Promise<void> =>
  expect(root(page, theme)).toHaveAttribute(SCENE_STATE_ATTRIBUTE, state);

export const stateOf = (page: Page, theme: ThemeName) =>
  root(page, theme).getAttribute(SCENE_STATE_ATTRIBUTE);

/** Task 5 owns selection, and the runtime only observes this attribute. */
export const selectTheme = (page: Page, theme: ThemeName): Promise<void> =>
  page.evaluate(
    ([attribute, name]) =>
      document.documentElement.setAttribute(attribute, name),
    [THEME_ATTRIBUTE, theme] as const,
  );

export async function showTheme(page: Page, theme: ThemeName): Promise<void> {
  await selectTheme(page, theme);
  await expectState(page, theme, "running");
}

export const setColorScheme = (page: Page, scheme: "light" | "dark" | null) =>
  page.evaluate(
    ([attribute, value]) => {
      const html = document.documentElement;
      if (value === null) html.removeAttribute(attribute);
      else html.setAttribute(attribute, value);
    },
    [COLOR_SCHEME_ATTRIBUTE, scheme] as const,
  );

/** Uses the browser's own rAF, so waiting adds nothing to the counts. */
export const waitFrames = (page: Page, count = 3): Promise<void> =>
  page.evaluate(
    (frames) =>
      new Promise<void>((resolve) => {
        let left = frames;
        const onFrame = () => {
          left -= 1;
          if (left <= 0) resolve();
          else window.__sceneSpy.rawFrame(onFrame);
        };
        window.__sceneSpy.rawFrame(onFrame);
      }),
    count,
  );

export const drawCount = (page: Page, theme: ThemeName): Promise<number> =>
  page.evaluate((name) => window.__sceneSpy.draws[name] ?? 0, theme);

export const widthWriteCount = (
  page: Page,
  theme: ThemeName,
): Promise<number> =>
  page.evaluate((name) => window.__sceneSpy.widthWrites[name] ?? 0, theme);

export const statesSeen = (page: Page, theme: ThemeName) =>
  page.evaluate(
    (name) =>
      window.__sceneSpy.stateLog
        .filter((entry) => entry.theme === name)
        .map((entry) => entry.state),
    theme,
  );

export async function expectDrawing(
  page: Page,
  theme: ThemeName,
): Promise<void> {
  const before = await drawCount(page, theme);
  await expect
    .poll(() => drawCount(page, theme), {
      message: `${theme} drew nothing new: check that its scene is running and that Scene.draw paints its canvas`,
    })
    .toBeGreaterThan(before);
}

const QUIET_FRAMES = 20;

/** Passes once no draw lands for a long run of frames, then checks the rest. */
export async function expectDrawsStop(
  page: Page,
  theme: ThemeName,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const before = await drawCount(page, theme);
        await waitFrames(page, 6);
        return (await drawCount(page, theme)) - before;
      },
      {
        message: `${theme} kept drawing: check the runtime's one rule for running`,
      },
    )
    .toBe(0);
  await expectNoDraws(page, theme);
}

export async function expectNoDraws(
  page: Page,
  theme: ThemeName,
): Promise<void> {
  const before = await drawCount(page, theme);
  await waitFrames(page, QUIET_FRAMES);
  expect(await drawCount(page, theme)).toBe(before);
}

/**
 * The most draws and rAF requests any frame saw over a run. One loop gives 1 for
 * both, however many switches came before.
 */
async function measureLoop(page: Page, frames = 15) {
  await page.evaluate(() => {
    window.__sceneSpy.drawsByFrame.clear();
    window.__sceneSpy.rafRequestsByFrame.clear();
  });
  await waitFrames(page, frames);
  return page.evaluate(() => {
    const most = (counts: Map<number, number>) =>
      Math.max(0, ...counts.values());
    return {
      framesThatDrew: window.__sceneSpy.drawsByFrame.size,
      mostDrawsInAFrame: most(window.__sceneSpy.drawsByFrame),
      mostRequestsInAFrame: most(window.__sceneSpy.rafRequestsByFrame),
    };
  });
}

export async function expectOneLoop(page: Page): Promise<void> {
  const loop = await measureLoop(page);
  expect(loop.framesThatDrew).toBeGreaterThan(0);
  expect(loop.mostDrawsInAFrame).toBe(1);
  expect(loop.mostRequestsInAFrame).toBe(1);
}

export const hideTab = (page: Page, hidden: boolean): Promise<void> =>
  page.evaluate((isHidden) => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => isHidden,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);

const TALL_PAGE_CSS = "body { padding-bottom: 5000px; }";

export const makePageTall = (page: Page) =>
  page.addStyleTag({ content: TALL_PAGE_CSS });

/** Instant even once global CSS sets smooth scrolling. */
export const scrollPage = (page: Page, top: number): Promise<void> =>
  page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), top);

export const scrollY = (page: Page): Promise<number> =>
  page.evaluate(() => window.scrollY);

export async function scrollCanvasOffScreen(
  page: Page,
  theme: ThemeName,
): Promise<void> {
  const box = await canvas(page, theme).boundingBox();
  if (!box) throw new Error("The canvas is not showing.");
  // Far enough that a viewport change, which can re-anchor the scroll position in
  // WebKit and make the hero taller, cannot bring the canvas back on-screen.
  await scrollPage(page, (await scrollY(page)) + box.y + box.height + 2500);
  const after = await canvas(page, theme).boundingBox();
  expect(after && after.y + after.height).toBeLessThan(0);
}

export interface ToggleState {
  readonly state: string | undefined;
  readonly pressed: string | null;
  readonly name: string | null;
  readonly label: string;
}

export const RUNNING_TOGGLE: ToggleState = {
  state: "go",
  pressed: "false",
  name: "Stop the train",
  label: "Stop the train",
};
export const REDUCED_START_TOGGLE: ToggleState = {
  state: "stop",
  pressed: "false",
  name: "Pause the text",
  label: "Pause the text",
};
export const STOPPED_TOGGLE: ToggleState = {
  state: "stop",
  pressed: "true",
  name: "Start the train",
  label: "Start the train",
};

export const toggleState = (
  page: Page,
  theme: ThemeName,
): Promise<ToggleState> =>
  toggle(page, theme).evaluate(
    (button: HTMLElement, labelHook) => ({
      state: button.dataset.state,
      pressed: button.getAttribute("aria-pressed"),
      name: button.getAttribute("aria-label"),
      label: button.querySelector(labelHook)?.textContent ?? "",
    }),
    THEME_HOOKS.toggleLabel,
  );

export const expectToggle = (
  page: Page,
  theme: ThemeName,
  expected: ToggleState,
): Promise<void> =>
  expect
    .poll(() => toggleState(page, theme), {
      message: `${theme}'s toggle does not show "${expected.label}": check the runtime's control sync, and the press that should have got it there`,
    })
    .toEqual(expected);

/** Pressed speed indexes, for every speed button of a theme. */
export const pressedSpeeds = (
  page: Page,
  theme: ThemeName,
): Promise<number[]> =>
  root(page, theme)
    .locator(THEME_HOOKS.speed)
    .evaluateAll((buttons) =>
      buttons.flatMap((button, index) =>
        button.getAttribute("aria-pressed") === "true" ? [index] : [],
      ),
    );

export const pressedLiveries = (page: Page, theme: ThemeName) =>
  root(page, theme)
    .locator(THEME_HOOKS.livery)
    .evaluateAll((buttons) =>
      buttons.flatMap((button) =>
        button.getAttribute("aria-pressed") === "true"
          ? [(button as HTMLElement).dataset.railLivery]
          : [],
      ),
    );

/** The "Right now" line takes up real space, rather than being only for readers. */
export async function isNowLineShowing(
  page: Page,
  theme: ThemeName,
): Promise<boolean> {
  const box = await hero(page, theme).locator(".now").boundingBox();
  return box !== null && box.width > 1 && box.height > 1;
}

export const nowMode = (page: Page, theme: ThemeName) =>
  hero(page, theme).getAttribute(NOW_ATTRIBUTE);

/** Adds a real, loaded font face to the page, as a late web font would. */
export const loadFontFace = (page: Page, family: string): Promise<void> =>
  page.evaluate(
    async ([name, base64]) => {
      const face = new FontFace(name, `url(data:font/ttf;base64,${base64})`);
      document.fonts.add(face);
      await face.load();
    },
    [family, TEST_FONT_BASE64],
  );

/** Hands a real key press to the page. WebKit drops zero-length arrow presses. */
export const pressKey = (page: Page, key: string): Promise<void> =>
  page.keyboard.press(key, { delay: 120 });

export const focusHero = (page: Page, theme: ThemeName): Promise<void> =>
  hero(page, theme).evaluate((element: HTMLElement) =>
    element.focus({ preventScroll: true }),
  );
