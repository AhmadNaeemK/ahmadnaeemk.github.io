/**
 * The failure table in section 8 of the contract, on real sockets. Deliberately
 * uses Playwright's plain `test`, not the one in `helpers.ts`: its font route would
 * turn the HTTP cache off, and these failures depend on that cache.
 */
import { expect, test, type Page } from "@playwright/test";
import { THEME_HOOKS, type ThemeName } from "../../../src/scene/contract";
import {
  addSceneSpy,
  expectDrawing,
  expectOneLoop,
  expectState,
  expectToggle,
  liveryButton,
  pressedLiveries,
  root,
  selectTheme,
  showTheme,
  stateOf,
  STOPPED_TOGGLE,
  toggle,
} from "./helpers";
import { startRealServer, type RealServer } from "./real-server";

const SCENE_CHUNK = /\/_astro\/scene\.[^/]*\.js$/;
const PAGE_CHUNK = /\/_astro\/page\.[^/]*\.js$/;

let server: RealServer;
let pageErrors: string[];

test.beforeEach(async ({ page }) => {
  server = await startRealServer();
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await addSceneSpy(page);
});

test.afterEach(() => {
  server.close();
  expect(pageErrors, "uncaught page errors").toEqual([]);
});

const failScenes = () =>
  server.setFate((path) => (SCENE_CHUNK.test(path) ? "drop" : "serve"));
const serveEverything = () => server.setFate(() => "serve");

const chunkEvaluations = (page: Page): Promise<number[]> =>
  page.evaluate(() =>
    Object.values(
      (globalThis as unknown as { __chunkEvaluations: Record<string, number> })
        .__chunkEvaluations,
    ),
  );

/** A chunk evaluated twice means a second runtime, and with it a second world. */
async function expectEveryChunkEvaluatedOnce(page: Page): Promise<void> {
  const evaluations = await chunkEvaluations(page);
  expect(evaluations.length).toBeGreaterThan(0);
  expect(evaluations.every((count) => count === 1)).toBe(true);
}

const expectNoModulePreloads = (page: Page) =>
  expect(page.locator('link[rel="modulepreload"]')).toHaveCount(0);

async function expectStaticHero(page: Page, theme: ThemeName): Promise<void> {
  await expect(root(page, theme).locator(THEME_HOOKS.staticHero)).toBeVisible();
  await expect(root(page, theme).locator(THEME_HOOKS.canvas)).toBeHidden();
}

test("a healthy visit requests each chunk once, evaluates it once and links no preloads", async ({
  page,
}) => {
  await page.goto(server.url);
  await expectState(page, "interchange", "running");
  await showTheme(page, "diorama");
  await showTheme(page, "pixel-depot");
  await showTheme(page, "interchange");

  expect(server.requestsFor(SCENE_CHUNK)).toBe(3);
  expect(server.requestsFor(PAGE_CHUNK)).toBe(1);
  await expectEveryChunkEvaluatedOnce(page);
  await expectNoModulePreloads(page);
});

test("a scene chunk failing after load recovers on return, with the same world", async ({
  page,
}) => {
  await page.goto(server.url);
  await expectState(page, "interchange", "running");
  await liveryButton(page, "interchange", "steam").click();
  await toggle(page, "interchange").click();

  failScenes();
  await selectTheme(page, "diorama");
  await expectState(page, "diorama", "failed");
  await expectStaticHero(page, "diorama");
  await expectNoModulePreloads(page);

  serveEverything();
  await showTheme(page, "interchange");
  await showTheme(page, "diorama");

  await expectDrawing(page, "diorama");
  await expectOneLoop(page);
  await expectEveryChunkEvaluatedOnce(page);
  await expectToggle(page, "diorama", STOPPED_TOGGLE);
  expect(await pressedLiveries(page, "diorama")).toEqual(["steam"]);
});

test("another theme's first show still works after a scene chunk failed", async ({
  page,
}) => {
  await page.goto(server.url);
  await expectState(page, "interchange", "running");

  failScenes();
  await selectTheme(page, "diorama");
  await expectState(page, "diorama", "failed");

  serveEverything();
  await showTheme(page, "pixel-depot");
  await expectDrawing(page, "pixel-depot");
  await showTheme(page, "diorama");
  await expectDrawing(page, "diorama");
});

test("a scene chunk failing on first load recovers on return", async ({
  page,
}) => {
  failScenes();
  await page.goto(server.url);
  await expectState(page, "interchange", "failed");
  await expectStaticHero(page, "interchange");

  serveEverything();
  await showTheme(page, "diorama");
  await showTheme(page, "interchange");

  await expectDrawing(page, "interchange");
  await expectEveryChunkEvaluatedOnce(page);
});

test("scene and page chunks failing on first load leave the static hero, and a reload recovers", async ({
  page,
}) => {
  server.setFate((path) =>
    SCENE_CHUNK.test(path) || PAGE_CHUNK.test(path) ? "drop" : "serve",
  );
  await page.goto(server.url);
  await expectStaticHero(page, "interchange");
  expect(await stateOf(page, "interchange")).toBeNull();

  serveEverything();
  const requestsBefore =
    server.requestsFor(SCENE_CHUNK) + server.requestsFor(PAGE_CHUNK);
  await page.reload();

  await expectState(page, "interchange", "running");
  await expectDrawing(page, "interchange");
  await expectEveryChunkEvaluatedOnce(page);
  expect(
    server.requestsFor(SCENE_CHUNK) + server.requestsFor(PAGE_CHUNK),
  ).toBeGreaterThan(requestsBefore);
});

test("a chunk gone since a deploy fails each return, while loaded themes keep working", async ({
  page,
}) => {
  await page.goto(server.url);
  await expectState(page, "interchange", "running");

  server.setFate((path) => (SCENE_CHUNK.test(path) ? "not-found" : "serve"));
  await selectTheme(page, "diorama");
  await expectState(page, "diorama", "failed");

  await showTheme(page, "interchange");
  await expectDrawing(page, "interchange");
  await selectTheme(page, "diorama");
  await expectState(page, "diorama", "failed");
  await expectStaticHero(page, "diorama");

  serveEverything();
  await page.reload();
  await expectState(page, "interchange", "running");
  await showTheme(page, "diorama");
});

test("while offline a scene fails each return, and coming back online recovers it", async ({
  page,
  context,
}) => {
  await page.goto(server.url);
  await expectState(page, "interchange", "running");

  await context.setOffline(true);
  await selectTheme(page, "diorama");
  await expectState(page, "diorama", "failed");
  await showTheme(page, "interchange");
  await selectTheme(page, "diorama");
  await expectState(page, "diorama", "failed");
  await showTheme(page, "interchange");

  await context.setOffline(false);
  await showTheme(page, "diorama");
  await expectDrawing(page, "diorama");
  await expectEveryChunkEvaluatedOnce(page);
});
