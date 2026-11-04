# ahmadnaeem.dev

Personal website and portfolio, published at <https://www.ahmadnaeem.dev>. A static [Astro](https://astro.build) site written in TypeScript.

## Setup

The Node version is pinned in `.nvmrc`.

```sh
nvm use
npm ci
npm run test:e2e:install # only needed for the e2e tests
```

## Commands

| Command                 | What it does                                    |
| ----------------------- | ----------------------------------------------- |
| `npm run dev`           | Starts the dev server on port 4321              |
| `npm run build`         | Builds the static site into `dist/`             |
| `npm run preview`       | Serves the built site                           |
| `npm run lint`          | Runs ESLint                                     |
| `npm run format:check`  | Checks formatting with Prettier                 |
| `npm run typecheck`     | Runs `astro check`                              |
| `npm test`              | Runs the Vitest unit tests                      |
| `npm run test:coverage` | Runs the unit tests with coverage               |
| `npm run test:e2e`      | Rebuilds, then runs Playwright against the site |

`design/` holds the visual prototypes the site is built from. It is reference material and is not part of the build.

## Where things are explained

- [`src/content/README.md`](src/content/README.md): the site's content and how to edit it.
- [`docs/rfcs/theme-contract.md`](docs/rfcs/theme-contract.md): how a theme plugs into the page and the scene runtime.
- [`docs/rfcs/theme-contract-history.md`](docs/rfcs/theme-contract-history.md): why that contract took its shape.
- [`scripts/og-image.mjs`](scripts/og-image.mjs): how to regenerate the link-preview image, `public/og-image.png`.
