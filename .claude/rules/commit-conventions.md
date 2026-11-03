---
description: Git commit message conventions.
---

# Commit conventions

Apply these whenever creating git commits. If **`.claude/rules/project.md`** names a different commit style, it wins.

---

## 1. Format

Follow the **Conventional Commits** spec:

```
<type>(<scope>): <subject>
```

- **type** — one of: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `ci`, `build`, `revert`
- **scope** — optional; the feature or area affected, e.g. `auth`, `navbar`, or a ticket key
- **subject** — short, imperative description of the change

---

## 2. Subject casing

Write subjects in **lowercase**, including component names and acronyms. This is what `@commitlint/config-conventional` enforces in projects that use it.

```
# ✅ correct
feat(navbar): add mobile menu state machine

# ❌ rejected by commitlint
feat(navbar): Add MobileMenu state machine
```

---

## 3. Hooks

If the project has commit hooks, let them run, fix what they report, and re-stage. Do not bypass them with `--no-verify`.
