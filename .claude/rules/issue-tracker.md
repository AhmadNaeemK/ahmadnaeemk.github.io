---
description: Issue tracker conventions — issue types, titles, and description structure. Which tracker to use comes from project.md.
---

# Issue tracker

The tracker, its tooling, and the ticket key format come from **`.claude/rules/project.md`**. Read and create tickets with the tool it names (for example the `gh` CLI for GitHub Issues, or an MCP server for Jira or Linear). If the project names no tracker, ask the user rather than guessing.

---

## 1. Placement

If the user names a project, board, or repository, use it. Otherwise use the default in `project.md`. Put tickets where the team will see them; if the tracker has both a board and a backlog, prefer the board.

---

## 2. Issue type

| Type      | When to use                                                   |
| --------- | ------------------------------------------------------------- |
| **Task**  | A small, well-scoped change                                   |
| **Bug**   | A fix for existing broken behavior                            |
| **Story** | Anything else (new feature, enhancement, larger body of work) |

On trackers without issue types, express these as labels.

---

## 3. Title

Keep titles **short and intent-revealing**. They should communicate _what_ changes and _why_ at a glance, not implementation details.

---

## 4. Description structure

Ticket templates (frontend vs backend) are owned by the **ticket-creation** skill (`.claude/skills/ticket-creation/SKILL.md`). Every ticket description **must** contain these sections, using these heading names:

1. **Context** — Answer the _why_: what situation or problem led to this ticket.
2. **Acceptance Criteria** — A **numbered list** written from the end user's perspective. Answer _what changes_ for the user. This is the primary reference for testing.
3. **Tasks** — A **numbered list** of high-level changes. Keep it summary-level, link RFCs against individual points where they exist, and include error-handling requirements explicitly, especially for API changes. **Skip this section** if the acceptance criteria already cover the work.

Optional sections for large stories:

4. **Performance Requirements** — Latency budgets, throughput targets, query limits.
5. **Security & Privacy Requirements** — Auth or permission changes, PII handling, new attack surface, compliance.

```markdown
## Context

<Why does this ticket exist?>

## Acceptance Criteria

1. <User-facing outcome 1>
2. <User-facing outcome 2>

## Tasks

1. <High-level change — link to RFC if applicable>
2. <High-level change — include error-handling notes for API work>
```
