---
description: Project profile — the single file holding everything specific to this repository (stack, layout, commands, branches, tracker). Every other rule, skill, command, and agent reads its values from here.
---

# Project profile

**This is the only file that should name this repository's specifics.** To adopt the workflow elsewhere, copy `.claude/` and `CLAUDE.md`, then rewrite this file; the rest stays as is.

Elsewhere in the workflow, `<test>`, `<lint>`, `<base-branch>`, and similar placeholders mean the values below. A value of `none` means the project does not have that thing: **skip the step that needs it and say so**. Do not invent a substitute.

## Project

- **What it is:** Personal website and blog, used to learn UI/UX and React with MUI.
- **Repository:** `AhmadNaeemK/ahmadnaeemk.github.io` (public, so never commit secrets or details from other projects)

## Stack

- **Language:** JavaScript (no TypeScript)
- **Framework:** React 17, Create React App (`react-scripts` 5)
- **UI:** MUI v5 + Emotion
- **State:** Redux Toolkit, `react-redux`
- **Routing:** `react-router-dom` v6
- **Other:** `react-p5` for canvas sketches
- **Test tooling:** Jest (via `react-scripts`), React Testing Library 12, `user-event` 13
- **Stack add-ons:** `.claude/rules/react.md`

## Commands

| Slot             | Command                 | Notes                                                       |
| ---------------- | ----------------------- | ----------------------------------------------------------- |
| `<install>`      | `npm ci`                |                                                             |
| `<dev>`          | `npm start`             | Serves on port 3000                                         |
| `<test>`         | `CI=true npm test --`   | Append a path or `-t "name"`; `CI=true` stops watch mode    |
| `<lint>`         | `npx eslint src`        | Uses the `eslintConfig` in `package.json`                   |
| `<lint-fix>`     | `npx eslint src --fix`  |                                                             |
| `<typecheck>`    | `none`                  |                                                             |
| `<format-check>` | `none`                  |                                                             |
| `<build>`        | `npm run build`         | The only check CI runs on pull requests (Node 16)           |
| `<e2e>`          | `none`                  |                                                             |
| `<e2e-setup>`    | `none`                  |                                                             |

- **CI-parity checks** (run before opening a PR): `<lint>`, `<test>`, `<build>`
- **Pre-commit checks:** no git hooks are installed, so whoever is about to commit runs `<lint>` and targeted `<test>` first.

## Git and delivery

- **`<base-branch>`:** `main`
- **Branch naming:** `ahmad/<short-slug>`
- **Commit style:** Conventional Commits, not enforced by tooling (see `.claude/rules/commit-conventions.md`)
- **PR template:** `none`
- **Deploy:** pushing to `main` builds and publishes to GitHub Pages (`.github/workflows/deploy.yml`)

## Layout

| Kind of code            | Location                                  |
| ----------------------- | ----------------------------------------- |
| Layout shells           | `src/components/layout/`                  |
| Page content            | `src/components/content/`                 |
| Canvas sketches         | `src/components/canvas/`                  |
| Shared helpers          | `src/components/utils/`                   |
| Redux store             | `src/app/store.js`                        |
| Redux slices            | `src/features/`                           |
| Static assets           | `src/components/assets/`, `public/`       |
| Design explorations     | `design/`                                 |

- **Test file patterns:** `src/**/*.test.js`, `src/setupTests.js`
- **Design tokens:** `src/components/assets/themes/`

## Integrations

- **Issue tracker:** GitHub Issues via `gh`; ticket key format `#123`
- **Spec docs:** Markdown files under `docs/rfcs/`
- **Design source:** `none` (when a task links a Figma file, use the `figma-design-extraction` skill)
- **Analytics convention:** `none`
