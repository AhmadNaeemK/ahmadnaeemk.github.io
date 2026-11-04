import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { THEME_NAMES } from "./contract";

const SRC = dirname(dirname(fileURLToPath(import.meta.url)));
const THEMES_DIR = join(SRC, "themes");

const themeSources = readdirSync(THEMES_DIR, {
  recursive: true,
  encoding: "utf8",
})
  .filter((path) => /\.(ts|astro)$/.test(path))
  .map((path) => ({
    path: relative(SRC, join(THEMES_DIR, path)),
    source: readFileSync(join(THEMES_DIR, path), "utf8"),
  }));

describe("theme sources", () => {
  it("includes every theme's scene, so the scans below look at real files", () => {
    const paths = themeSources.map(({ path }) => path);

    for (const theme of THEME_NAMES) {
      expect(paths).toContain(join("themes", theme, "scene.ts"));
    }
  });

  it("never build a world, since the runtime owns the only one", () => {
    const offenders = themeSources
      .filter(({ source }) => /\bcreateWorld\b/.test(source))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  it("never step anything with .update(, since only the runtime steps the world", () => {
    const offenders = themeSources
      .filter(({ source }) => /\.update\(/.test(source))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });
});

describe("the one world", () => {
  const SKIP = /^rail\/|\.test\.ts$/;
  const runtimeSources = readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((path) => /\.(ts|astro|mjs)$/.test(path) && !SKIP.test(path))
    .map((path) => readFileSync(join(SRC, path), "utf8"));
  const countMatches = (pattern: RegExp) =>
    runtimeSources.flatMap((source) => source.match(pattern) ?? []).length;

  it("is created in exactly one place outside the engine", () => {
    expect(countMatches(/\bcreateWorld\(/g)).toBe(1);
  });

  it("is stepped in exactly one place outside the engine", () => {
    expect(countMatches(/\.update\(/g)).toBe(1);
  });
});
