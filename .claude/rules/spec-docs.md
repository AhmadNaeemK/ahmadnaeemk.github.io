---
description: Conventions for RFCs and spec documents — required structure and formatting. Where they are published comes from project.md.
---

# Spec documents

Where specs live (a repo folder, Confluence, Notion, and so on) comes from **`.claude/rules/project.md`**. If the user names a location, use that instead. If the destination is an external service, draft in chat and get approval before publishing.

---

## 1. RFC structure

An **RFC** (Request for Comments) **must** begin with these two sections, using **exactly** these headings. Do **not** rename, merge, or omit them.

1. **`## Context`** — High-level description of the problem. Provide enough background for a reader unfamiliar with the ticket to understand the motivation.
2. **`## Executive Summary`** — A short summary (maximum 5 lines) of the decided solution **and the reasoning behind the decision**. It answers _"what are we doing and why?"_ at a glance.

**After those two sections**, divide the rest into whatever sections the topic requires, numbered from 3. Common sections include:

- **Proposed Solution** — detailed design, data flow, or API contracts.
- **Alternatives Considered** — other approaches and why they were rejected.
- **Migration / Rollout Plan** — steps to ship safely.

```markdown
## Context

<Describe the high-level problem here.>

## Executive Summary

<Max 5 lines: what solution was chosen and why.>

## 3. <First Detail Section>

...

## 4. <Next Section>

...
```

---

## 2. Formatting and code references

- Wrap code snippets in fenced code blocks with a language tag.
- When referencing project source code, include the **file path** and **line range** so readers can find it, for example `src/payments/refund.js` (lines 42–78).
- Use tables, bullet lists, and headings to keep documents scannable.
- Bold key terms and decisions so they stand out during review.
- File names for repo-hosted specs: `{descriptive-kebab-slug}.md`.
