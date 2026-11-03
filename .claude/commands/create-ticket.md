---
description: Draft scoped tickets (frontend, backend, or both) from an RFC or equivalent context, and create them in the project's tracker only after approval—with rules from issue-tracker.md.
argument-hint: [rfc-path-or-url | context]
---

## Inputs

Provide as much as you have; the agent will **not** draft until mandatory context is confirmed (see **Your role**).

### Mandatory before drafting (from RFC or chat)

All three must be established, via an **RFC** or **explicit user input**:

- **Problem context** — Why we are doing this (goal, user pain, constraints).
- **Decided solution** — Which approach was chosen (one-liner plus enough detail to scope tickets).
- **Step-by-step implementation plan** — How we will build it.

### What to pass with this command

- **RFC (recommended when it exists)** — Path or URL, so the agent can extract the three items above.
- **Scope (required or confirm)** — **Frontend only**, **backend only**, or **both**. If unclear, the skill asks before drafting.
- **Project or board (optional)** — If not the default in `.claude/rules/project.md`.
- **Title hints or labels (optional)**
- **Extra context (optional)** — Anything not in the RFC (rollout, dependencies, spikes, links).

## Your role

**Read and follow every step** in @.claude/skills/ticket-creation/SKILL.md: load @.claude/rules/issue-tracker.md first, establish context, determine scope, draft with the correct template from that skill, **present drafts for review**, and **only then** create tickets, returning a URL for each.

Do not create tickets until the user **explicitly approves** each draft.

## Action

1. **Load rules and skill** — Apply `issue-tracker.md` and the tracker in `project.md`; treat the skill as the process source of truth.
2. **Context** — Resolve the RFC or collect problem + solution + implementation plan; stop and ask if any mandatory piece is missing.
3. **Scope** — Confirm frontend, backend, or both; pick the matching template(s).
4. **Draft** — Fill each section per the skill; link the RFC where applicable.
5. **Review gate** — Show full draft(s) in chat; wait for explicit confirmation.
6. **Create** — Create with the tracker's tool; return **URLs** for every created ticket.

---

<!-- Optional: RFC link, scope, notes -->
