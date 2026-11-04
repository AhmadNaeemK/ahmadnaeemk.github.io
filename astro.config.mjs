import { defineConfig } from "astro/config";
import { pageChunkGroup } from "./scene-chunks.mjs";

export default defineConfig({
  site: "https://www.ahmadnaeem.dev",
  output: "static",
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
