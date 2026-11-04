// Captures the Open Graph image (public/og-image.png) from the built site. It takes
// real fonts from the network, so run it online, from the repo root:
//   npm run build && npm run preview
//   node scripts/og-image.mjs http://localhost:4321 public/og-image.png
// Add --motion to catch the train mid-route instead of at its reduced-motion start.
import process from "node:process";
import { chromium } from "@playwright/test";

const [siteUrl, outputPath, motionFlag] = process.argv.slice(2);
if (!siteUrl || !outputPath) {
  throw new Error(
    "Usage: node scripts/og-image.mjs <site-url> <output-path> [--motion]",
  );
}
const SCENE_SETTLE_MS = 4000;

// Keeps the map, the name and the role. Everything hidden is page furniture that
// means nothing in a link preview.
const CARD_CSS = `
  [data-rail-theme-root="interchange"] header,
  [data-rail-theme-root="interchange"] .service,
  [data-rail-theme-root="interchange"] .intro__text,
  [data-rail-theme-root="interchange"] .intro__cta,
  [data-rail-theme-root="interchange"] main > :not(.hero),
  [data-rail-theme-root="interchange"] footer { display: none !important; }
  html, body { overflow: hidden !important; }
  /* Covers what is left of the billboard's hangers above the bridge. */
  body::before { height: 14px !important; }
  [data-rail-theme-root="interchange"] .hero { padding-block: 0 !important; margin-top: -74px !important; }
  [data-rail-theme-root="interchange"] .hero .wrap { max-width: 1200px !important; }
  [data-rail-theme-root="interchange"] .intro { display: block !important; max-width: none !important; margin: 26px 0 0 !important; padding: 0 0 0 24px !important; }
  [data-rail-theme-root="interchange"] .intro__name { margin: 0 !important; font-size: 5.5rem !important; }
  [data-rail-theme-root="interchange"] .intro__role { max-width: none !important; margin: 10px 0 0 !important; font-size: 1.75rem !important; }
`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  colorScheme: "light",
  reducedMotion: motionFlag === "--motion" ? "no-preference" : "reduce",
});
await page.goto(`${siteUrl}/#interchange`, { waitUntil: "networkidle" });
await page.addStyleTag({ content: CARD_CSS });
await page.evaluate("document.fonts.ready");
await page.waitForTimeout(SCENE_SETTLE_MS);
await page.screenshot({ path: outputPath });
await browser.close();
