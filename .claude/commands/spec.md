---
description: Turn a problem or high-level feature into a grounded solution outline and RFC—by following the spec-creation architect workflow (codebase exploration, approach iteration, detailed change list, then publish per spec-docs rules).
argument-hint: <problem-or-feature>
---

## Inputs

Provide as much of the following as you have; the agent will ask the smallest follow-ups if something blocks the workflow.

- **Problem or feature overview (required)** — What we are solving or shipping: user story, current pain, desired outcome, and any non-negotiables (deadlines, scope boundaries).
- **Surfaces and scope (recommended)** — Routes or areas of the app, feature names, or a "whole flow" description.
- **Ticket hint (optional)** — A ticket key or product area.
- **Design input (optional)** — A design URL; the workflow uses the Figma MCP as described in the skill when this is the main input.
- **Links and references (optional)** — PRs, spikes, related RFCs, threads: anything that pins API shape, rollout, or analytics.
- **Constraints (optional)** — Accessibility targets, performance, feature flags, i18n, analytics events, rollout or migration notes.

## Your role

**Read and follow every step** in @.claude/skills/spec-creation/SKILL.md **as the architect workflow**: clarify scope, explore the project (and the design source when design-led), align with @.claude/rules/code-standards.md, iterate on the approach and the detailed change list until both are explicitly finalized, then draft and publish the RFC per @.claude/rules/spec-docs.md only after the user's go-ahead.

Do not skip phases, formatting rules, or verification checks listed in that skill.

## Action

1. **Load the skill** — Open `.claude/skills/spec-creation/SKILL.md` and treat it as the single process source of truth for this command.
2. **Phase 1 — Understand** — Apply inputs above; explore the codebase (and design source if applicable); cite real paths.
3. **Phases 2–3 — Approach and detailed changes** — Propose or confirm the approach with trade-offs when needed; produce the end-to-end change list with file paths; iterate until the user confirms both.
4. **Phase 4 — RFC** — After explicit go-ahead: apply `spec-docs.md`, draft mandatory RFC sections, get review on the draft, publish to the destination in `.claude/rules/project.md`, and return the path or URL.
5. **Handoff** — Per the skill: open questions and suggested next steps (tickets from the RFC, planning skill for `.claude/plans/`).

---

<!-- Optional: paste problem / high-level overview here, or supply it in the chat when invoking this command. -->
