import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import { pageChunkGroup } from "./scene-chunks.mjs";

const SITE = "https://www.ahmadnaeem.dev";

const PAGES_LEFT_OUT_OF_SITEMAP = [`${SITE}/404/`];

export default defineConfig({
  site: SITE,
  output: "static",
  integrations: [
    sitemap({
      filter: (page) => !PAGES_LEFT_OUT_OF_SITEMAP.includes(page),
    }),
  ],
  vite: {
    // Fail on a taken port. Moving to the next one would leave Playwright testing
    // whichever server already holds the port it waits on.
    preview: { strictPort: true },
    // Astro targets the newest browsers, so the minifier would leave out the
    // `-webkit-backdrop-filter` Safari before 18 needs. On these versions it adds
    // that prefix and removes `-webkit-mask`, which none of them needs. It has
    // nothing else to rewrite, so the CSS stays nested.
    build: { cssTarget: ["chrome123", "edge123", "firefox120", "safari17.5"] },
    environments: {
      client: {
        build: {
          rolldownOptions: {
            output: { codeSplitting: { groups: [pageChunkGroup] } },
          },
        },
      },
    },
  },
});
