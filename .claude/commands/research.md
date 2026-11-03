---
description: Take a requirement or open question, research it via the web (libraries, prior art, best practices, pitfalls), ground it against this codebase's stack and conventions, and propose a solution with trade-offs—chat output only, no files or pages written.
argument-hint: <question>
---

# /research — R&D and solution proposal (chat only)

Turns a **requirement, problem, or open technical question** into a **web-researched, codebase-grounded solution proposal**, presented in chat and iterated on with the developer. Nothing is written to `.claude/plans/`, `.claude/skills/`, or spec docs — that's a follow-up step (`/plan` or `/spec`) once the proposal is agreed.

## When to use

Run `/research` before `/plan` or `/spec` when you don't yet know **how** to solve something: choosing between libraries or approaches, checking how others solve a problem, evaluating a new API/SDK, or sanity-checking an idea against current best practices — for this project's stack (see `.claude/rules/project.md`) or a dependency it integrates with.

Do **not** use it when the approach is already decided and you just need tasks (`/plan`) or a formal RFC (`/spec`) — those commands assume the solution direction is settled.

## Process

### Phase 1 — Clarify the ask

1. **Restate the requirement** in one or two sentences to confirm scope before researching.
2. **Ask only if genuinely blocked** — if the ask is underspecified in a way that would send research in the wrong direction (e.g. no budget/constraint, no target surface, ambiguous "it" between two features), ask the smallest set of clarifying questions. Otherwise proceed — don't stall on details you can reasonably assume and state.

### Phase 2 — Web R&D

3. **Search the web** for the requirement: current best practices, competing libraries/approaches, official docs, known pitfalls, and how comparable products solve it. Use `WebSearch` and `WebFetch` directly for a focused, few-source lookup; invoke the **`deep-research`** skill instead when the topic is broad enough to need fan-out search, multiple independent sources, and adversarial fact-checking (e.g. "what's the current recommended approach for X across the ecosystem").
4. **Track sources** — Keep the URLs/titles behind each claim so the proposal can cite them; don't present unsourced claims as settled fact.

### Phase 3 — Ground in this codebase

5. **Check what already exists** — Search the project for related modules, patterns, or prior attempts so the proposal builds on existing conventions instead of ignoring them. Cite real paths.
6. **Check fit against the stack** — Confirm any externally-researched approach is compatible with the stack in **`.claude/rules/project.md`** and with **`@.claude/rules/code-standards.md`**. Flag anything that would require a new dependency or a conventions exception.

### Phase 4 — Propose a solution

7. **Present findings and a recommendation:**
   - **Options considered** — Each with a one-line description, source link(s), and trade-offs (complexity, bundle size, maintenance, fit with existing stack).
   - **Recommendation** — One option, with reasoning tied to this codebase's constraints, not just the research in isolation. If only one sound option exists, say so plainly instead of manufacturing alternatives.
   - **High-level approach** — Rough shape of the implementation (what would change, at a component/module level — not a full file-by-file change list; that belongs in `/plan` or `/spec`).
   - **Open risks/questions** — Anything unresolved that the developer should weigh in on before committing.
8. **Iterate** — Refine the proposal based on developer feedback; re-research specific angles if asked. Treat the proposal as settled only when the developer confirms it.

### Phase 5 — Handoff

9. **Suggest next steps** once the developer is satisfied: `/plan` to break the agreed solution into implementation tasks, or `/spec` if it warrants an RFC first (cross-team visibility, larger scope, or full-stack contract). Don't run either automatically.

## Verification

| Phase     | Check                                                                                   |
| --------- | --------------------------------------------------------------------------------------- |
| Clarify   | Requirement restated; blocking ambiguity resolved before research starts                |
| Web R&D   | Findings backed by cited sources; `deep-research` skill used when scope warrants it     |
| Grounding | Existing project patterns checked; fit against `code-standards.md` and current stack confirmed |
| Proposal  | Options + trade-offs + a clear recommendation presented; developer feedback iterated on |
| Handoff   | Next step (`/plan` or `/spec`) suggested, not auto-run                                  |

## Input

Paste the requirement, problem, or open question below (or provide it in chat above).

---

Requirement:

```text

```
