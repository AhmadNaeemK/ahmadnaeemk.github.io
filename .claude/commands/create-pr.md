---
description: CI-parity checks, branch validation, commit, push, and gh pr create using the repo PR template if there is one.
argument-hint: [ticket-key] [slug]
---

# /create-pr — Check, branch, commit, push, open PR

Runs the checks that match CI (the **CI-parity checks** in **`.claude/rules/project.md`**), ensures the correct **base** branch and branch naming, **commits** and **pushes**, then opens a pull request with **`gh`**.

## When to use

Developer runs **`/create-pr`**, optionally with a **ticket key** and a slug or links to fill the PR body.

## Prerequisites (GitHub CLI)

1. **`gh --version`** — If missing, **stop**: install from [https://cli.github.com/](https://cli.github.com/).
2. **`gh auth status`** — If not logged in, **stop**: run `gh auth login`, confirm with `gh auth status`, then re-run **`/create-pr`**.

## Target branch rules

- **Base branch:** `<base-branch>` from `project.md`, unless the user names another (e.g. a release branch).
- **Branch naming:** the pattern in `project.md`.
- **PR title:** a short description, prefixed with the ticket key when there is one (e.g. `PROJ-123: Add calendar sync`).

If the project has a release process, follow what `project.md` says about it. Otherwise ask rather than guessing.

## Process

### 1. Checks (CI parity — required)

Run the **CI-parity checks** from `project.md` on the current tree, skipping any marked `none`. Fix failures before commit and push.

**Optional context:** to see what changed vs the base:

```bash
git fetch origin
git diff --name-only origin/<base-branch>...HEAD
```

### 2. Branch

If not already on a correctly named branch, create it from `<base-branch>`, then apply the work or confirm the user is on the right branch. Never open a PR from `<base-branch>` to itself.

### 3. Stage and commit

- **`git add`** intended files; confirm **`git diff --staged`** matches intent.
- **Commit message:** follow **`.claude/rules/commit-conventions.md`**. Include the ticket key for traceability when there is one, e.g. **`feat(PROJ-123): add calendar sync`**.

### 4. Push

```bash
git push -u origin HEAD
```

If push fails, surface the error and auth or remote hints, and **do not** claim the PR was opened.

### 5. PR body

If `project.md` names a PR template, read it and fill it in. Otherwise include:

- **Ticket** — link, when there is one
- **Description of changes**
- **Root cause and fix** (for bugfixes)
- **Testing** — what was run and how
- **Screenshots or references**, if relevant

### 6. Open PR

Write the body to a temp file, then:

```bash
gh pr create --base <base-branch> --title "<title>" --body-file <tempfile>
```

Return the **PR URL** from `gh` output.

### `gh` failure handling

If **`gh`** fails (auth, scope, API): print **numbered** recovery steps and exit **without** claiming success.

## Verification

| Check         | Evidence                                                                 |
| ------------- | ------------------------------------------------------------------------ |
| CI parity     | Every CI-parity check in `project.md` passes, or is `none`               |
| Branch / base | Branch name and `--base` match the **Target branch rules**               |
| PR            | **`gh`** prints a PR URL; title matches the agreed format                |

## Input

Ticket key and optional short slug for the branch name, or nothing at all.

---

Ticket key (optional):

```text

```
