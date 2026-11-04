/**
 * Checked on what was built, because neither browser here needs the prefix: both
 * would show the same page without it. The minifier strips it unless `build.cssTarget`
 * in astro.config.mjs names browsers old enough to need it.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const ASSETS_DIR = fileURLToPath(
  new URL("../../../dist/_astro", import.meta.url),
);

const builtCss = (): string =>
  readdirSync(ASSETS_DIR)
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(join(ASSETS_DIR, name), "utf8"))
    .join("\n");

const valuesOf = (css: string, property: string): string[] =>
  [...css.matchAll(new RegExp(`(?<![-\\w])${property}:([^;}]+)`, "g"))].map(
    ([, value]) => value,
  );

test("every backdrop-filter keeps the prefix Safari before 18 needs", () => {
  const css = builtCss();
  const unprefixed = valuesOf(css, "backdrop-filter");

  expect(unprefixed.length).toBeGreaterThan(0);
  expect(valuesOf(css, "-webkit-backdrop-filter")).toEqual(unprefixed);
});
