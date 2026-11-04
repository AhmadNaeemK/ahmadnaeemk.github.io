/**
 * The chunk rule in section 8 of the contract says no CSS import in `scene.ts`. A
 * large one fails `tests/e2e/scene/chunk-rule.spec.ts`, but Astro inlines a tiny one
 * into every visit's HTML, and nothing built looks wrong. So this reads the source.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { THEME_NAMES } from "./contract";

const SRC = dirname(dirname(fileURLToPath(import.meta.url)));
const THEMES_DIR = join(SRC, "themes");

const STYLESHEET = /\.(css|scss|sass|less|styl|stylus|pcss|postcss)$/;
const IMPORT_FORMS =
  /(?:^|[;}\s])(import|export)\s+(type\s+)?(?:[\w$*{][^"'`;]*?from\s*)?["'`]([^"'`]+)["'`]|(?:^|[;}\s])import\s*["'`]([^"'`]+)["'`]|\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/gm;

function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

/** Every module a source really imports. Type-only imports leave nothing behind. */
function importedSpecifiers(source: string): string[] {
  return [...withoutComments(source).matchAll(IMPORT_FORMS)].flatMap(
    ([, , typeOnly, fromForm, bareForm, dynamicForm]) => {
      if (typeOnly) return [];
      const specifier = fromForm ?? bareForm ?? dynamicForm;
      return specifier ? [specifier] : [];
    },
  );
}

function isStylesheet(specifier: string): boolean {
  return STYLESHEET.test(specifier.split("?")[0] ?? specifier);
}

/**
 * What `entry` pulls in that is CSS, following relative imports, since a helper's
 * CSS import lands in the same chunk as the scene's own. `readModule` returns null
 * for what cannot be followed.
 */
function stylesheetImports(
  entry: string,
  readModule: (path: string) => { path: string; source: string } | null,
): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const visit = (path: string) => {
    const loaded = readModule(path);
    if (!loaded || seen.has(loaded.path)) return;
    seen.add(loaded.path);
    for (const specifier of importedSpecifiers(loaded.source)) {
      if (isStylesheet(specifier)) {
        found.push(`${relative(SRC, loaded.path)} imports ${specifier}`);
      } else if (specifier.startsWith(".")) {
        visit(join(dirname(loaded.path), specifier));
      }
    }
  };
  visit(entry);
  return found;
}

function readFromDisk(path: string) {
  const candidate = [
    path,
    `${path}.ts`,
    `${path}.js`,
    join(path, "index.ts"),
  ].find((file) => existsSync(file) && statSync(file).isFile());
  return candidate
    ? { path: candidate, source: readFileSync(candidate, "utf8") }
    : null;
}

const RULE =
  "A scene chunk may not import CSS (contract, section 8): Astro inlines a small one into every visit's HTML. Import it from Theme.astro.";

describe("the theme scenes", () => {
  const scenes = readdirSync(THEMES_DIR)
    .map((name) => join(THEMES_DIR, name, "scene.ts"))
    .filter((path) => existsSync(path));

  it("include every theme's, so the scan below looks at real files", () => {
    for (const theme of THEME_NAMES) {
      expect(scenes).toContain(join(THEMES_DIR, theme, "scene.ts"));
    }
  });

  it.each(scenes.map((path) => [relative(SRC, path), path]))(
    "%s imports no CSS",
    (_name, path) => {
      expect(stylesheetImports(path as string, readFromDisk), RULE).toEqual([]);
    },
  );
});

describe("the scan", () => {
  it.each([
    ['import "./a.css";', "a bare import"],
    ['import"./a.css";', "a bare import, minified"],
    ['import styles from "./a.css";', "a default import"],
    ['import { styles } from "./a.module.css";', "a named import"],
    ['import * as styles from "./a.css";', "a star import"],
    ['export { styles } from "./a.css";', "a re-export"],
    ['import inline from "./a.css?inline";', "a query"],
    ['const styles = import("./a.css");', "a dynamic import"],
    ['import "./a.scss";', "a preprocessor file"],
  ])("sees %s, %s", (source) => {
    const found = stylesheetImports("/scene.ts", () => ({
      path: "/scene.ts",
      source,
    }));
    expect(found).toHaveLength(1);
  });

  it.each([
    ['// import "./a.css";', "a line comment"],
    ['/* import "./a.css"; */', "a block comment"],
    ['const name = "a.css";', "a string that is not an import"],
    ['import type { Styles } from "./a.css";', "a type-only import"],
    ['import { css } from "./css";', "a module named css"],
    ['import { readToken } from "../../rail";', "an ordinary import"],
  ])("ignores %s, %s", (source) => {
    const found = stylesheetImports("/scene.ts", (path) =>
      path === "/scene.ts" ? { path, source } : null,
    );
    expect(found).toEqual([]);
  });

  it("follows a relative import into a helper", () => {
    const modules: Record<string, string> = {
      "/themes/x/scene.ts": 'import { draw } from "./draw";',
      "/themes/x/draw": 'import "./draw.css";',
    };
    const found = stylesheetImports("/themes/x/scene.ts", (path) =>
      Object.hasOwn(modules, path)
        ? { path, source: modules[path] ?? "" }
        : null,
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("draw.css");
  });

  it("survives modules that import each other", () => {
    const modules: Record<string, string> = {
      "/a": 'import "./b";',
      "/b": 'import "./a";',
    };
    expect(
      stylesheetImports("/a", (path) => ({
        path,
        source: modules[path] ?? "",
      })),
    ).toEqual([]);
  });
});
