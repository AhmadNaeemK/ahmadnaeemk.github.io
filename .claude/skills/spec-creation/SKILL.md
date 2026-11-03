---
name: spec-creation
description: Architect workflow — turn a problem or feature into a detailed solution and an RFC grounded in this repository, published where project.md says specs live. Use when turning a problem or feature into an RFC.
---

# /spec — Architect: RFC

Turn a **problem statement or high-level feature** into a **detailed solution, implementation outline, and RFC**, grounded in **this repository**.

## When to use

Run `/spec` with a problem or high-level feature overview when the work is substantial enough to deserve written agreement before building. For changes spanning several services, still make the **contract between them** explicit, and coordinate the other side's details with its owners.

## Process

### Phase 1 — Understand

1. **Clarify scope** — If the overview is ambiguous, ask the shortest set of questions needed (surfaces touched, design source, API changes, rollout, analytics, accessibility).
2. **Explore this codebase first** — Read **`.claude/rules/project.md`**, then search for related features, modules, routes, and data access. Cite real paths. Follow **`@.claude/rules/code-standards.md`**.
3. **Design-driven work** — When the main input is a design link, ground the spec in the design before locking the approach. For Figma, use the MCP: extract `fileKey` / `nodeId` from the URL (branch URLs use the branch key as `fileKey`; hyphenated `node-id` → colons), then call **`get_design_context`** (and **`get_metadata`** / child nodes when the URL has no node, but **not** for Figma Make). Treat MCP output as **reference only**; describe behavior and layout intent adapted to the project's stack.
4. **Changes outside this repo** — If the change does not touch this repo, say so and avoid duplicating implementation detail here; still document **what this project will depend on** (endpoints, payloads, errors).

### Phase 2 — Approach (iterate until finalized)

5. **Propose approach(es)** — If multiple viable solutions exist, present each with trade-offs (complexity, performance, migration, test cost, and so on) and **recommend one with clear reasoning**. If only one sound approach exists, propose it directly; do not fabricate alternatives.
6. **Apply project standards** — Align with **`@.claude/rules/code-standards.md`** and any stack add-on. Call out **loading, error, and empty** states and **routing** impacts where they apply.
7. **Iterate** — Refine and challenge assumptions with the user until the approach is explicitly finalized.

### Phase 3 — Detailed changes (iterate until finalized)

8. **End-to-end change list** — Once the approach is locked, produce a detailed breakdown of **all** required changes, for example:

   - **Entry points** — routes, pages, handlers, commands.
   - **Components and modules** — new vs extended.
   - **Data layer** — clients, types, cache keys, schema or migrations, and coordination points if a contract is new.
   - **State** — stores or context when needed.
   - **Constants and utilities.**
   - **Tests** — unit vs integration per `.claude/skills/unit-testing/SKILL.md` and `.claude/skills/integration-testing/SKILL.md` when the RFC should mandate them.
   - **Analytics** — when `project.md` lists a convention, an event list (action → event name and key properties) for every user-facing action the work adds or changes, flagging any new event constant. For mutations, track failures as well as successes.
   - **Cross-cutting** — i18n, feature flags.

   Include **file paths** (and line ranges when pointing at existing code) so implementers can navigate quickly.

9. **Finalize changes** — Iterate until the user confirms the changes are complete and correct.

### Phase 4 — RFC publish (only after go-ahead)

10. **Load the spec rules** — Apply every requirement in **`.claude/rules/spec-docs.md`**, and find the destination in `project.md`.
11. **Draft the RFC body** — Mandatory sections: `## Context`, `## Executive Summary`, then **numbered** detail sections from `## 3. ...` onward. Include a **step-by-step implementation guide**, new vs changed files, and **references to existing files** with paths. Add sections such as **Proposed Solution**, **UI / UX** (states, breakpoints, accessibility), **API / data contract**, **Analytics**, **Alternatives Considered**, **Migration / Rollout**, and **Testing / Verification** as the topic requires.
12. **Review** — Present the full RFC draft before publishing. Incorporate feedback.
13. **Publish** — Once the user confirms, write the file or publish to the destination in `project.md`. Return the **path or URL**.
14. **Handoff** — List open questions and what downstream steps need: `.claude/skills/ticket-creation/SKILL.md` (tickets from the RFC) and `.claude/skills/planning-and-task-breakdown/SKILL.md` for `.claude/plans/{slug}_plan.md`. Include the **RFC link**, and the **frontend/backend split** if tickets will be filed separately.

## Verification

| Phase            | Check                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------- |
| Understand       | Relevant project code (and design source when design-led) explored; real paths cited  |
| Approach         | User explicitly confirmed the chosen approach; aligns with `code-standards.md`        |
| Detailed changes | End-to-end change list reviewed and confirmed by the user                             |
| Analytics        | Events identified for each new or changed user action, when `project.md` has a convention |
| RFC publish      | `spec-docs.md` rules applied; RFC reviewed before publishing; path or URL returned    |

## Input

Paste the problem or feature overview below (or provide it in the chat above).

---

<!-- Paste problem / high-level overview here -->
