---
description: Turn a spec, ticket, RFC, design link, or stated goal into a written implementation plan under `.claude/plans/{slug}_plan.md`—numbered tasks, acceptance criteria, verification, and dependencies—for builder, orchestrator, and verifier (planning only; no product code unless explicitly asked).
argument-hint: [spec | ticket-key | design-url | goal]
---

## Inputs

Provide as much as you have; the agent asks the smallest follow-ups if scope or sources are ambiguous.

- **What to plan (required)** — One of: **goal or problem statement**, **RFC path or URL**, **short written spec**, or **enough context** to derive numbered requirements. For orchestrator-driven work, this should be the same material you would hand to **planner** before **implementation** starts.
- **A ticket as primary spec (optional)** — Ticket key or URL so the agent can **fetch it read-only** per @.claude/rules/issue-tracker.md before writing tasks.
- **Design source (optional)** — Design URL (for Figma, with `node-id` when possible) when frames drive UI scope; the agent uses the Figma MCP when available per @.claude/agents/planner.md and the planning skill before locking tasks.
- **Constraints (recommended)** — In scope / out of scope, deadlines, dependencies on other teams, feature flags, analytics, a11y or performance bars.
- **Filename hint (optional)** — Short kebab phrase for the plan slug (e.g. `edit-profile-form`); the agent still picks **`.claude/plans/{descriptive-slug}_plan.md`** per conventions if omitted.
- **Detail level (optional)** — `detail=low_level | high_level | auto`. Controls *how much of the "how"* the plan spells out (see **Detail mode** below). **Defaults to `auto`** when omitted. Naming is *level of detail*, not abstraction — `high_level` = **more** detail.

## Detail mode

Follow the planning skill's **Planning altitude & detail modes** exactly. Summary:

- **`low_level`** — steps breakdown only: the **what and why** (outcome + acceptance criteria + verification). No code snippets or "how" steps; the builder owns implementation.
- **`high_level`** — everything `low_level` has **plus** grounded code snippets, "how" steps, and implementation detail under an **Implementation notes** heading in each task. Illustrative reference, not a mandate.
- **`auto`** (default) — default each task to `low_level`, escalating to `high_level` detail only where it genuinely reduces risk **and** is grounded in real project code.

**The guardrails hold in every mode** (including `high_level`): only plan what the spec requires, **never invent** paths/components/functions/parameters/APIs/events *or code snippets*, keep `files likely touched` grounded, and give every task that writes code the standing **@.claude/rules/code-standards.md** criterion. A `high_level` snippet that can't be grounded drops to `low_level` or becomes an **Open question** — it is never fabricated.

## Your role

**Behave as** @.claude/agents/planner.md **describes for the planner**: decompose the input into an **Implementation Plan** with **numbered tasks** (`## Task 1:`, `## Task 2:`, …), **acceptance criteria**, **verification** steps, **dependencies**, **files likely touched**, checkpoints, risks, and open questions—aligned with @.claude/rules/code-standards.md.

**Planning altitude (non-negotiable):** The **`detail`** mode controls whether tasks include the *how* (code snippets / steps) — but the guardrails never move. **Only plan what the spec requires** (speculative refactors/cleanups → Open questions, not tasks). **Never invent** file paths, components, functions, parameters, APIs, events, *or code snippets* — keep **files likely touched** to paths verified in the project or omit them; unknowns become **Open questions**. Keep tasks **human-readable and consistently shaped**, and give **every task that writes code** the standing **@.claude/rules/code-standards.md** acceptance criterion.

**Process and templates:** Follow @.claude/skills/planning-and-task-breakdown/SKILL.md end-to-end (dependency ordering, vertical slices, S/M sizing, project verification commands, design-first and ticket-first branches when those inputs apply).

**Writes allowed:** Create or update **only** **`.claude/plans/{descriptive-kebab-slug}_plan.md`** (create **`.claude/plans/`** if needed). **Do not** change application or test **implementation** code unless the user explicitly asks for exploratory edits outside planning.

**Not in scope unless asked:** Implementing features, running the full orchestrator loop, or creating/updating tickets (planning loads a ticket **read-only** when it is the spec).

Tests are written **after** each task is implemented and verified (tests-after). Note **`Tests: not required — {reason}`** on any task unlikely to warrant a meaningful test per planner; otherwise assume `test-engineer` will add tests after the slice is verified.

## Action

0. **Resolve detail mode** — Read `detail=` from the input (`low_level` | `high_level` | `auto`); **default `auto`** if absent. Apply it per the **Detail mode** section for the whole plan.
1. **Clarify** — Confirm goal, scope boundaries, and primary source (RFC, ticket, Figma, prose).
2. **Load planner rules and skill** — Apply `planner.md` expectations and `planning-and-task-breakdown/SKILL.md` (template, sizing, verification commands).
3. **Grounding** — Skim the project for realistic tasks; fetch tickets for ticket-first specs and use the Figma MCP for design-first specs, as in `planner.md`.
4. **Write the plan file** — Full document at **`.claude/plans/{slug}_plan.md`** with **R1…** requirements (when useful), consecutive **`## Task N:`** sections, AC, verification, dependencies, parallelization notes, and **`Tests: not required`** only where justified. For tasks that add or change a tracked user action, include the event as a testable acceptance criterion when `project.md` lists an analytics convention.
5. **Reply format** — First line: **`Plan file: .claude/plans/…`** (actual path). Then a **short summary**: task count, suggested first task, blockers or open questions. **Do not** paste the entire plan in chat unless the user asks.

---

<!-- Optional: goal, ticket key/URL, design URL, slug hint, detail=low_level|high_level|auto, notes -->
