/**
 * Serves the themes' real fonts from `./fonts`, so a spec can see them without the
 * network. Other specs block them, and a machine's fallback fonts can hide or cause
 * differences that a visitor with the real ones never meets.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import type { ThemeName } from "../../../src/scene/contract";
import { THEME_META } from "../../../src/themes/registry";

const FONT_DIR = fileURLToPath(new URL("./fonts/", import.meta.url));
const STYLESHEET_HOST = /^https:\/\/fonts\.googleapis\.com\//;
const FILE_HOST = /^https:\/\/fonts\.gstatic\.com\//;
const FILE_ORIGIN = "https://fonts.gstatic.com/test/";

/** The families in a theme's stylesheet address, which is what a visitor is sent. */
export function themeFontFamilies(theme: ThemeName): string[] {
  return new URL(THEME_META[theme].fontStylesheet).searchParams
    .getAll("family")
    .map((family) => family.split(":")[0]);
}

/** `Overpass:ital,wght@0,400;1,400` as one `@font-face` for each face it asks for. */
function fontFaceRules(familyRequest: string): string[] {
  const [family, axes = "wght@400"] = familyRequest.split(":");
  const [axisNames, faces] = axes.split("@");
  const hasItalicAxis = axisNames.startsWith("ital");
  const slug = family.toLowerCase().replaceAll(" ", "-");
  return faces.split(";").map((face) => {
    const parts = face.split(",");
    const weight = parts.at(-1);
    const style = hasItalicAxis && parts[0] === "1" ? "italic" : "normal";
    const file = `${slug}-latin-${weight}-${style}.woff2`;
    return `@font-face { font-family: "${family}"; font-weight: ${weight}; font-style: ${style}; font-display: swap; src: url(${FILE_ORIGIN}${file}) format("woff2"); }`;
  });
}

/**
 * Stands in for Google Fonts. Returns what releases the font files, which are held
 * until then when `holdFiles` is set, as they would be on a slow connection.
 */
export async function serveRealFonts(
  page: Page,
  { holdFiles = false }: { readonly holdFiles?: boolean } = {},
): Promise<() => Promise<void>> {
  let filesAsked = 0;
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  if (!holdFiles) release();

  await page.route(STYLESHEET_HOST, (route) =>
    route.fulfill({
      contentType: "text/css",
      body: new URL(route.request().url()).searchParams
        .getAll("family")
        .flatMap(fontFaceRules)
        .join("\n"),
    }),
  );
  await page.route(FILE_HOST, async (route) => {
    filesAsked += 1;
    await released;
    const file = new URL(route.request().url()).pathname.split("/").at(-1);
    await route.fulfill({
      contentType: "font/woff2",
      // Fonts are always fetched with CORS, and this is another origin.
      headers: { "access-control-allow-origin": "*" },
      body: await readFile(`${FONT_DIR}${file}`),
    });
  });

  return async () => {
    await expect
      .poll(() => filesAsked, { message: "no font file was asked for" })
      .toBeGreaterThan(0);
    release();
  };
}

/** The real families that shown text in the theme is actually set in. */
export function familiesInUse(page: Page, theme: ThemeName): Promise<string[]> {
  return page.locator(`[data-rail-theme-root="${theme}"]`).evaluate((root) => {
    const unquoted = (family: string) => family.replaceAll('"', "").trim();
    const loaded = new Set(
      [...document.fonts]
        .filter(({ status }) => status === "loaded")
        .map(({ family }) => unquoted(family)),
    );
    const inUse = new Set<string>();
    for (const element of root.querySelectorAll("*")) {
      const hasOwnText = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      );
      if (!hasOwnText || !element.checkVisibility()) continue;
      const [first] = getComputedStyle(element).fontFamily.split(",");
      if (loaded.has(unquoted(first))) inUse.add(unquoted(first));
    }
    return [...inUse].sort();
  });
}

/** Until every family the theme asks for is set on shown text. */
export const expectThemeFontsInUse = (
  page: Page,
  theme: ThemeName,
): Promise<void> =>
  expect
    .poll(() => familiesInUse(page, theme))
    .toEqual(themeFontFamilies(theme).sort());
