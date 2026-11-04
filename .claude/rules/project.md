---
description: Project profile — the single file holding everything specific to this repository (stack, layout, commands, branches, tracker). Every other rule, skill, command, and agent reads its values from here.
---

# Project profile

**This is the only file that should name this repository's specifics.** To adopt the workflow elsewhere, copy `.claude/` and `CLAUDE.md`, then rewrite this file; the rest stays as is.

Elsewhere in the workflow, `<test>`, `<lint>`, `<base-branch>`, and similar placeholders mean the values below. A value of `none` means the project does not have that thing: **skip the step that needs it and say so**. Do not invent a substitute.

## Project

- **What it is:** Personal website and portfolio: a static Astro site with three train-themed presentations.
- **Repository:** `AhmadNaeemK/ahmadnaeemk.github.io` (public, so never commit secrets or details from other projects)

## Stack

- **Language:** TypeScript (`strict`)
- **Framework:** Astro, static output, no UI framework
- **Runtime:** Node 24, pinned in `.nvmrc` (`nvm use` picks it up; CI reads the same file) and `engines` in `package.json`
- **Package manager:** npm, with a committed `package-lock.json`
- **Lint and format:** ESLint flat config (TypeScript and Astro plugins), Prettier (Astro plugin)
- **Test tooling:** Vitest with v8 coverage for unit tests, Playwright (Chromium and WebKit) for e2e against the built site
- **Stack add-ons:** none

## Commands

| Slot             | Command                     | Notes                                                                 |
| ---------------- | --------------------------- | --------------------------------------------------------------------- |
| `<install>`      | `npm ci`                    |                                                                       |
| `<dev>`          | `npm run dev`               | Serves on port 4321                                                   |
| `<test>`         | `npm test --`               | Vitest, single run. Append a path or `-t "name"`. Coverage: `npm run test:coverage` |
| `<lint>`         | `npm run lint`              | Does not scan `design/`                                               |
| `<lint-fix>`     | `npm run lint:fix`          |                                                                       |
| `<typecheck>`    | `npm run typecheck`         | `astro check`; does not cover `design/`                               |
| `<format-check>` | `npm run format:check`      | Skips `design/` and `.claude/`. Fix with `npm run format`             |
| `<build>`        | `npm run build`             | Writes the static site to `dist/`                                     |
| `<e2e>`          | `npm run test:e2e`          | Builds, then serves through `astro preview`. In CI it serves the `dist/` the workflow built |
| `<e2e-setup>`    | `npm run test:e2e:install`  | Downloads the Chromium and WebKit browsers                            |

- **CI-parity checks** (run before opening a PR): `<lint>`, `<format-check>`, `<typecheck>`, `npm run test:coverage`, `<build>`, `<e2e>`. `.github/workflows/checks.yml` runs them in that order, on every pull request and on pushes to `main`.
- **Node version:** local commands need Node 24 from `.nvmrc`, so run `nvm use` first.
- **Background servers:** Astro detaches `npm run dev` and `astro preview` when it detects a coding agent. Stop them with `npx astro dev stop` or `npx astro preview stop`.
- **Pre-commit checks:** no git hooks are installed, so whoever is about to commit runs `<lint>`, `<format-check>` and targeted `<test>` first.

## Git and delivery

- **`<base-branch>`:** `main`
- **Rebuild branch:** rebuild work lands on `redesign/astro` through its own PRs, and merges to `main` only at the cut-over.
- **Branch naming:** `ahmad/<short-slug>`
- **Commit style:** Conventional Commits, not enforced by tooling (see `.claude/rules/commit-conventions.md`)
- **PR template:** `none`
- **Deploy:** pushing to `main` runs `.github/workflows/deploy.yml`, which still builds the old site on Node 16 and publishes `./build` to the `gh-pages` branch, and which needs `public/CNAME` to keep the custom domain. The cut-over replaces that workflow with an Actions deploy and removes `public/CNAME`. Until then, do not merge `redesign/astro` into `main`.
- **Canonical host:** `https://www.ahmadnaeem.dev`

## Layout

| Kind of code                                   | Location          |
| ---------------------------------------------- | ----------------- |
| Content collections                            | `src/content/`    |
| Train simulation (framework-free)              | `src/rail/`       |
| Scene lifecycle shared by the themes           | `src/scene/`      |
| Themes                                         | `src/themes/`     |
| Shared components                              | `src/components/` |
| Page layouts                                   | `src/layouts/`    |
| Routes                                         | `src/pages/`      |
| Static assets                                  | `public/`         |
| E2E tests                                      | `tests/e2e/`      |
| Design prototypes (reference only, not built)  | `design/`         |

- **Test file patterns:** `src/**/*.test.ts`, `tests/e2e/**/*.spec.ts`
- **Design tokens:** shared tokens in `src/layouts/`, per-theme tokens in `src/themes/`

## Integrations

- **Issue tracker:** GitHub Issues via `gh`; ticket key format `#123`
- **Spec docs:** Markdown files under `docs/rfcs/`
- **Design source:** `none` (when a task links a Figma file, use the `figma-design-extraction` skill)
- **Analytics convention:** `none`
