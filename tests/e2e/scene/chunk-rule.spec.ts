/**
 * The chunk rule in section 8 of the contract, checked on what was built. Without
 * it a theme could quietly make failed scenes unrecoverable in WebKit, which only
 * shows when a real request fails.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import {
  SCENE_STATE_ATTRIBUTE,
  THEME_NAMES,
} from "../../../src/scene/contract";

const DIST = fileURLToPath(new URL("../../../dist", import.meta.url));
const CHUNKS_DIR = join(DIST, "_astro");

const chunkNames = () =>
  readdirSync(CHUNKS_DIR).filter((name) => name.endsWith(".js"));
const readChunk = (name: string) =>
  readFileSync(join(CHUNKS_DIR, name), "utf8");
const sceneChunkNames = () =>
  chunkNames().filter((name) => name.startsWith("scene."));
const pageChunkNames = () =>
  chunkNames().filter((name) => name.startsWith("page."));

/** Every `import … from`, bare `import` and `export … from`, as built. */
function staticImports(source: string): string[] {
  const staticImport =
    /(?:^|[;}\s])(?:import|export)\s*(?:[\w$*{][^"'`;]*?from\s*)?["'`]([^"'`]+)["'`]/g;
  return [...source.matchAll(staticImport)].map(([, specifier]) => specifier);
}

test("the import scan sees every static form a chunk can use", () => {
  const source = [
    'import{a as e,b as t}from"./named.js";',
    'import"./bare.js";',
    'import x from"./default.js";',
    'import*as y from"./star.js";',
    'export{z}from"./reexport.js";',
    'var n=1;import("./dynamic.js");',
  ].join("");

  expect(staticImports(source)).toEqual([
    "./named.js",
    "./bare.js",
    "./default.js",
    "./star.js",
    "./reexport.js",
  ]);
});

test("each theme has its own scene chunk, and there is one page chunk", () => {
  expect(sceneChunkNames()).toHaveLength(THEME_NAMES.length);
  expect(pageChunkNames()).toHaveLength(1);
});

test("a scene chunk statically imports only the page chunk", () => {
  const [pageChunk] = pageChunkNames();
  const allowed = `./${pageChunk}`;
  const importsByScene = sceneChunkNames().map((name) => ({
    name,
    imports: staticImports(readChunk(name)),
  }));

  expect(importsByScene.flatMap(({ imports }) => imports)).toContain(allowed);
  for (const { name, imports } of importsByScene) {
    expect(
      imports.filter((specifier) => specifier !== allowed),
      `${name} imports more than the page chunk`,
    ).toEqual([]);
  }
});

test("a scene chunk makes no dynamic import of its own", () => {
  for (const name of sceneChunkNames()) {
    expect(readChunk(name), name).not.toMatch(/\bimport\(/);
  }
});

test("the page chunk holds the import of every scene", () => {
  const pageSource = readChunk(pageChunkNames()[0]);

  expect(sceneChunkNames().length).toBeGreaterThan(0);
  for (const name of sceneChunkNames()) {
    const importOfScene = new RegExp(
      `import\\(\\s*["'\`]\\./${name.replaceAll(".", "\\.")}["'\`]\\s*\\)`,
    );
    expect(pageSource).toMatch(importOfScene);
  }
});

test("no chunk carries a preload list for its imports", () => {
  const chunks = chunkNames();

  expect(chunks.length).toBeGreaterThan(0);
  for (const name of chunks) {
    expect(readChunk(name), name).not.toContain("__vite__mapDeps");
  }
});

test("the page chunk has no CSS, which a shared one would need a preload list for", () => {
  const assets = readdirSync(CHUNKS_DIR);

  expect(assets.some((name) => name.startsWith("page."))).toBe(true);
  expect(
    assets.filter((name) => name.startsWith("page.") && name.endsWith(".css")),
  ).toEqual([]);
});

test("importing the page chunk starts nothing, and the entry script does", async ({
  page,
}) => {
  const entryScript = /<script type="module" src="([^"]+)"[^>]*><\/script>/g;
  let entryUrl = "";
  await page.route(
    (url) => url.pathname === "/",
    async (route) => {
      const response = await route.fetch();
      const html = await response.text();
      entryUrl = [...html.matchAll(entryScript)][0]?.[1] ?? "";
      await route.fulfill({ response, body: html.replace(entryScript, "") });
    },
  );
  const sceneRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/scene\.[^/]*\.js/.test(request.url())) {
      sceneRequests.push(request.url());
    }
  });
  await page.goto("/");
  expect(entryUrl, "The home page has no entry script to take out.").not.toBe(
    "",
  );

  await page.evaluate((url) => import(url), `/_astro/${pageChunkNames()[0]}`);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(resolve)),
  );
  expect(sceneRequests).toEqual([]);
  await expect(page.locator(`[${SCENE_STATE_ATTRIBUTE}]`)).toHaveCount(0);

  await page.evaluate((url) => import(url), entryUrl);
  await expect(page.locator(`[${SCENE_STATE_ATTRIBUTE}]`)).not.toHaveCount(0);
});

test("no built page links a module preload", () => {
  const pages = readdirSync(DIST, { recursive: true, encoding: "utf8" }).filter(
    (path) => path.endsWith(".html"),
  );
  const home = readFileSync(join(DIST, "index.html"), "utf8");

  expect(home).toContain("data-rail-theme-root");
  expect(home).toContain("<script");
  for (const path of pages) {
    expect(readFileSync(join(DIST, path), "utf8"), path).not.toMatch(
      /rel=["']?modulepreload/,
    );
  }
});
