/**
 * The favicon, checked on what was built. It reads files only, so
 * `playwright.config.ts` runs it once, with no browser.
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const DIST = fileURLToPath(new URL("../../../dist", import.meta.url));
const ICONS = [
  { rel: "icon", href: "/favicon.svg" },
  { rel: "icon", href: "/favicon.ico" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
];

const ICO_HEADER_BYTES = 6;
const ICO_ENTRY_BYTES = 16;

const attributeOf = (tag: string, name: string): string | undefined =>
  tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

const linkedIcons = (html: string) =>
  [...html.matchAll(/<link\b[^>]*>/g)].map(([tag]) => ({
    rel: attributeOf(tag, "rel"),
    href: attributeOf(tag, "href"),
  }));

const icoEntrySizes = (ico: Buffer): number[] =>
  Array.from({ length: ico.readUInt16LE(4) }, (_, index) =>
    ico.readUInt8(ICO_HEADER_BYTES + ICO_ENTRY_BYTES * index),
  );

for (const page of ["index.html", "404.html"]) {
  test(`${page} links all three icons`, () => {
    const html = readFileSync(join(DIST, page), "utf8");

    expect(linkedIcons(html)).toEqual(expect.arrayContaining(ICONS));
  });
}

for (const { href } of ICONS) {
  test(`${href} is built and not empty`, () => {
    expect(statSync(join(DIST, href)).size).toBeGreaterThan(0);
  });
}

test("favicon.svg draws without fonts and stays visible on dark tabs", () => {
  const svg = readFileSync(join(DIST, "favicon.svg"), "utf8");

  expect(svg).not.toMatch(/<text\b/);
  expect(svg).toMatch(/prefers-color-scheme:\s*dark/);
});

test("favicon.ico lists 16, 32 and 48 px entries", () => {
  const ico = readFileSync(join(DIST, "favicon.ico"));

  expect(icoEntrySizes(ico)).toEqual(expect.arrayContaining([16, 32, 48]));
});
