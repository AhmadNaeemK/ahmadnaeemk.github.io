/** Everything that changes what the server sends, through `page.route`. */
import { expect, type Page, type Route } from "@playwright/test";
import {
  THEME_ROOT_ATTRIBUTE,
  type ThemeName,
} from "../../../src/scene/contract";
import { openScenePage, waitFrames } from "./page-actions";
import type { SceneCallName } from "./scene-spy";

const SCENE_CHUNK = /\/_astro\/scene\.[^/]*\.js(\?.*)?$/;

export interface HeldChunks {
  /** Requests seen so far, in the order the page made them. */
  count(): number;
  release(index: number): Promise<void>;
  /** Lets through everything held and everything to come. */
  releaseAll(): Promise<void>;
  abort(index: number): Promise<void>;
  waitForCount(count: number): Promise<void>;
}

/** Each scene chunk waits until a spec lets it through, in any order. */
export async function holdSceneChunks(page: Page): Promise<HeldChunks> {
  const held: Route[] = [];
  const waiting = new Set<Route>();
  let holding = true;
  const settle = (route: Route) => {
    waiting.delete(route);
    return route;
  };
  await page.route(SCENE_CHUNK, async (route) => {
    held.push(route);
    if (holding) waiting.add(route);
    else await route.continue();
  });
  return {
    count: () => held.length,
    release: (index) => settle(held[index]).continue(),
    async releaseAll() {
      holding = false;
      await Promise.all([...waiting].map((route) => settle(route).continue()));
    },
    abort: (index) => settle(held[index]).abort(),
    waitForCount: (count) =>
      expect
        .poll(() => held.length, {
          message: `fewer than ${count} scene chunks were requested: check that the theme was selected, and the chunk's file name`,
        })
        .toBeGreaterThanOrEqual(count),
  };
}

export async function failSceneChunks(page: Page): Promise<void> {
  await page.route(SCENE_CHUNK, (route) => route.abort());
}

export const restoreSceneChunks = (page: Page): Promise<void> =>
  page.unroute(SCENE_CHUNK);

const REAL_SCENE_QUERY = "?real";

/**
 * Serves a small module in place of each scene chunk, which wraps the real one's
 * `createScene` to log contract calls and inject faults into them. The real chunk
 * runs byte for byte, and its relative imports still reach the same `page` URL, so
 * nothing is evaluated twice. Do not combine with `holdSceneChunks` or
 * `failSceneChunks`: whichever is added last would also catch the real chunk.
 */
export async function instrumentScenes(page: Page): Promise<void> {
  await page.route(SCENE_CHUNK, async (route) => {
    const url = route.request().url();
    if (url.endsWith(REAL_SCENE_QUERY)) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      contentType: "text/javascript",
      body: `import{createScene as c}from${JSON.stringify(url + REAL_SCENE_QUERY)};export const createScene=(x)=>window.__sceneSpy.wrapCreateScene(c)(x);`,
    });
  });
}

export const sceneCalls = (page: Page, theme: ThemeName) =>
  page.evaluate(
    (name) =>
      window.__sceneSpy.sceneCalls
        .filter((call) => call.theme === name)
        .map((call) => call.method),
    theme,
  );

export const countSceneCalls = async (
  page: Page,
  theme: ThemeName,
  method: SceneCallName,
): Promise<number> =>
  (await sceneCalls(page, theme)).filter((call) => call === method).length;

export const injectSceneFault = (
  page: Page,
  theme: ThemeName,
  method: SceneCallName,
): Promise<void> =>
  page.evaluate(
    (fault) => {
      window.__sceneSpy.sceneFault = fault;
    },
    { theme, method },
  );

export const clearSceneFault = (page: Page): Promise<void> =>
  page.evaluate(() => {
    window.__sceneSpy.sceneFault = null;
  });

/** How the runtime's call looks once built: `world.update(last === null ? 0 : …`. */
const BUILT_STEP_CALL = /([\w$]+)\.update\(([\w$]+)===null\?0:/g;

/**
 * Opens the page with the runtime's step call going through a check, which counts
 * steps and can throw. A scene cannot reach the step, so there is no other way to
 * see it or to reproduce an engine bug on demand.
 */
export async function openWithCheckedStep(page: Page): Promise<void> {
  let stepCallsRewritten = 0;
  await page.route(/\/_astro\/[^/]*\.js(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({
      response,
      body: source.replace(BUILT_STEP_CALL, (_, world, lastTime) => {
        stepCallsRewritten += 1;
        return `window.__sceneSpy.checkStep(${world}).update(${lastTime}===null?0:`;
      }),
    });
  });
  await openScenePage(page);
  expect(
    stepCallsRewritten,
    "The runtime's built step call has changed shape: update BUILT_STEP_CALL.",
  ).toBeGreaterThan(0);
}

/** The most world steps any frame saw over a run, and how many frames stepped. */
export async function measureSteps(page: Page, frames = 20) {
  await page.evaluate(() => window.__sceneSpy.stepsByFrame.clear());
  await waitFrames(page, frames);
  return page.evaluate(() => ({
    framesThatStepped: window.__sceneSpy.stepsByFrame.size,
    mostStepsInAFrame: Math.max(0, ...window.__sceneSpy.stepsByFrame.values()),
  }));
}

/**
 * Seconds of world text time per second of real time, seen through a scene's own
 * view. It holds for a step of any shape, where `measureSteps` needs the known one.
 * Frames over the engine's clamp lower it, so a loaded machine cannot fail this.
 */
export const worldClockRate = (page: Page, theme: ThemeName): Promise<number> =>
  page.evaluate(async (name) => {
    const { world } = window.__sceneSpy.contexts[name];
    const startWorld = world.textTime;
    const startReal = performance.now();
    await new Promise<void>((resolve) => {
      let left = 30;
      const onFrame = () => {
        left -= 1;
        if (left <= 0) resolve();
        else window.__sceneSpy.rawFrame(onFrame);
      };
      window.__sceneSpy.rawFrame(onFrame);
    });
    return (
      (world.textTime - startWorld) / ((performance.now() - startReal) / 1000)
    );
  }, theme);

/** Rewrites one theme's part of the page's HTML, on every load of the page. */
export async function rewriteThemeHtml(
  page: Page,
  theme: ThemeName,
  edit: (themeHtml: string) => string,
): Promise<void> {
  await page.route(
    (url) => url.pathname === "/",
    async (route) => {
      const response = await route.fetch();
      const pageHtml = await response.text();
      const start = pageHtml.indexOf(`${THEME_ROOT_ATTRIBUTE}="${theme}"`);
      if (start < 0) throw new Error(`No root for ${theme} in the page.`);
      const next = pageHtml.indexOf(`${THEME_ROOT_ATTRIBUTE}="`, start + 1);
      const end = next < 0 ? pageHtml.length : next;
      await route.fulfill({
        response,
        body:
          pageHtml.slice(0, start) +
          edit(pageHtml.slice(start, end)) +
          pageHtml.slice(end),
      });
    },
  );
}

/** Adds a style to the page's HTML, so it applies from the first layout on. */
export async function addStyleToHtml(page: Page, css: string): Promise<void> {
  await page.route(
    (url) => url.pathname === "/",
    async (route) => {
      const response = await route.fetch();
      const pageHtml = await response.text();
      await route.fulfill({
        response,
        body: pageHtml.replace(
          "</head>",
          `<style id="e2e">${css}</style></head>`,
        ),
      });
    },
  );
}
