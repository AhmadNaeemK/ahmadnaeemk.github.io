/**
 * The half of the chunk rule in section 8 of the contract that a browser has to show:
 * only the entry script may start anything, so a scene chunk's import of the page
 * chunk cannot start a second runtime.
 */
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { SCENE_STATE_ATTRIBUTE } from "../../../src/scene/contract";

const CHUNKS_DIR = fileURLToPath(
  new URL("../../../dist/_astro", import.meta.url),
);

const pageChunkNames = () =>
  readdirSync(CHUNKS_DIR).filter(
    (name) => name.startsWith("page.") && name.endsWith(".js"),
  );

test("importing the page chunk starts nothing, and the entry script does", async ({
  page,
}) => {
  const entryScript =
    /<script\b(?=[^>]*\btype="module")[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g;
  let entryUrls: string[] = [];
  await page.route(
    (url) => url.pathname === "/",
    async (route) => {
      const response = await route.fetch();
      const html = await response.text();
      entryUrls = [...html.matchAll(entryScript)].map(([, url]) => url);
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
  expect(
    entryUrls.length,
    "The home page has no entry script to take out.",
  ).toBeGreaterThan(0);
  await expect(
    page.locator('script[type="module"]'),
    "A module script stayed on the page, so the check below would prove nothing.",
  ).toHaveCount(0);

  const pageChunkUrl = `/_astro/${pageChunkNames()[0]}`;
  expect(entryUrls, "The page chunk is itself an entry script.").not.toContain(
    pageChunkUrl,
  );
  await page.evaluate((url) => import(url), pageChunkUrl);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(resolve)),
  );
  expect(sceneRequests).toEqual([]);
  await expect(page.locator(`[${SCENE_STATE_ATTRIBUTE}]`)).toHaveCount(0);

  // A page can have several entries in any order, and one of them starts the runtime.
  await page.evaluate(
    (urls) => Promise.all(urls.map((url) => import(url))),
    entryUrls,
  );
  await expect(page.locator(`[${SCENE_STATE_ATTRIBUTE}]`)).not.toHaveCount(0);
});
