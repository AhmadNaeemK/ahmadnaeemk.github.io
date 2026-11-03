---
name: implementation-workflow
description: Workflow for implementing features from a spec or plan. For stack, layout, and code patterns apply .claude/rules/project.md and .claude/rules/code-standards.md (required). This skill adds workflow notes and links to testing skills.
---

# Implementation workflow

**Conventions:** Use **`@.claude/rules/project.md`** and **`@.claude/rules/code-standards.md`** (plus any stack add-on `project.md` lists) for every implementation. Do not duplicate those conventions here.

## Workflow

- Implement only what the plan or user asked for; avoid drive-by refactors or unrelated formatting.
- Match nearby files in the same feature or folder; prefer consistency with siblings over generic patterns.
- Reuse existing components and utilities before adding new abstractions.

## Related skills

- **Tests:** `.claude/skills/unit-testing/SKILL.md` and `.claude/skills/integration-testing/SKILL.md` when implementation includes or requires tests.
