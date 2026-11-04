// Generates public/favicon.ico and public/apple-touch-icon.png from public/favicon.svg:
//   node scripts/favicon.mjs
// The SVG's two stroke colors are Interchange's --ink values, light and dark, from
// src/themes/interchange/tokens.css. An SVG file cannot read those tokens, so update
// it by hand if they change, then run this script.
import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import { URL } from "node:url";
import { chromium } from "@playwright/test";

const PUBLIC_DIR = new URL("../public/", import.meta.url);
const TILE_COLOR = "#ffffff";

// The ICO and PNG cannot follow the color scheme, so the letter sits on a white tile
// that stays readable on a dark tab. The SVG's own padding is already all that 16px
// can spare, so the ICO draws the letter at full size. iOS applies its own mask, so
// its tile stays square and the letter stands well clear of the corners.
const ICO_ICONS = [16, 32, 48].map((size) => ({
  size,
  tileRadius: Math.round(size * 0.2),
  letterSize: size,
}));
const APPLE_ICON = { size: 180, tileRadius: 0, letterSize: 136 };

const ICO_HEADER_BYTES = 6;
const ICO_ENTRY_BYTES = 16;
const ICO_TYPE_ICON = 1;
const ICO_COLOR_PLANES = 1;
const ICO_BITS_PER_PIXEL = 32;

async function renderIcon(page, svgDataUrl, { size, tileRadius, letterSize }) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html>
    <style>
      html, body { margin: 0; background: transparent; }
      div {
        display: grid;
        place-items: center;
        width: ${size}px;
        height: ${size}px;
        border-radius: ${tileRadius}px;
        background: ${TILE_COLOR};
      }
    </style>
    <div><img src="${svgDataUrl}" width="${letterSize}" height="${letterSize}" alt="" /></div>`);
  await page.evaluate("document.images[0].decode()");
  return page.screenshot({ omitBackground: true });
}

// An ICO entry may hold a whole PNG, so the file is only a directory in front of them.
function buildIco(pngIcons) {
  const directorySize = ICO_HEADER_BYTES + ICO_ENTRY_BYTES * pngIcons.length;
  const directory = Buffer.alloc(directorySize);
  directory.writeUInt16LE(ICO_TYPE_ICON, 2);
  directory.writeUInt16LE(pngIcons.length, 4);

  let imageOffset = directorySize;
  pngIcons.forEach(({ size, png }, index) => {
    const entry = ICO_HEADER_BYTES + ICO_ENTRY_BYTES * index;
    directory.writeUInt8(size, entry);
    directory.writeUInt8(size, entry + 1);
    directory.writeUInt16LE(ICO_COLOR_PLANES, entry + 4);
    directory.writeUInt16LE(ICO_BITS_PER_PIXEL, entry + 6);
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(imageOffset, entry + 12);
    imageOffset += png.length;
  });
  return Buffer.concat([directory, ...pngIcons.map(({ png }) => png)]);
}

const svg = await readFile(new URL("favicon.svg", PUBLIC_DIR));
const svgDataUrl = `data:image/svg+xml;base64,${svg.toString("base64")}`;

const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: "light" });

const pngIcons = [];
for (const icon of ICO_ICONS) {
  pngIcons.push({
    size: icon.size,
    png: await renderIcon(page, svgDataUrl, icon),
  });
}
await writeFile(new URL("favicon.ico", PUBLIC_DIR), buildIco(pngIcons));
await writeFile(
  new URL("apple-touch-icon.png", PUBLIC_DIR),
  await renderIcon(page, svgDataUrl, APPLE_ICON),
);
await browser.close();
