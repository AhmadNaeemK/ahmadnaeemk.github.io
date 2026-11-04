import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import { pageChunkGroup } from "./scene-chunks.mjs";

const SITE = "https://www.ahmadnaeem.dev";

// /content-preview/ goes when Task 13 removes the route.
const PAGES_LEFT_OUT_OF_SITEMAP = [`${SITE}/404/`, `${SITE}/content-preview/`];

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
