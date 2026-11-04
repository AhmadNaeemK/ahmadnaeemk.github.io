import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://www.ahmadnaeem.dev",
  output: "static",
  // Fail on a taken port. Moving to the next one would leave Playwright testing
  // whichever server already holds the port it waits on.
  vite: { preview: { strictPort: true } },
});
