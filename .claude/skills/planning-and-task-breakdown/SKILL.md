---
name: planning-and-task-breakdown
description: Breaks work into ordered, implementable tasks with acceptance criteria and verification. Use when you have a spec or clear requirements and need a plan for the builder; when a task feels too large; when estimating scope or parallelizing work; when implementation order is unclear; or when debugging spans multiple steps and needs checkpoints (see `.claude/agents/debugger.md`).
---

# Planning and Task Breakdown

## Overview

Decompose work into **small, verifiable tasks** with explicit **acceptance criteria**. Each task should be implementable, testable, and verifiable in one focused session. **Do not write implementation code during planning**—output is a **plan document** for `.claude/agents/builder.md` (and optionally verifier/test-engineer).

## Planning altitude & detail modes

This section is the top rule and it overrides every template below. Two things are independent:

- **Detail mode** — *how much of the "how"* the plan spells out. Chosen per run via the **`detail`** parameter.
- **Guardrails** — always on, in **every** mode; never waived.

### Detail mode (the `detail` parameter)

The caller (the `/plan` command or the prompt handed to the **planner** agent) picks one. **Default is `auto`.** Naming is *level of detail*, not abstraction: `high_level` = **more** detail, `low_level` = **less**.

| Mode | What each task contains |
| ---- | ----------------------- |
| **`low_level`** | **Steps breakdown only — the *what* and *why*.** Outcome + acceptance criteria + verification. **No** code snippets, function signatures, parameter lists, pseudo-code, or "edit line X to Y" steps. The builder owns the *how*, guided by **`@.claude/rules/code-standards.md`**. Lightest and most human-readable. |
| **`high_level`** | Everything `low_level` has, **plus** implementation detail: **code snippets, "how" steps, function/parameter shapes, and specific edit guidance** — but only where it is **grounded** (see guardrails). Snippets are **illustrative reference**, not mandates; the builder may adapt. Still traces to the spec; still carries the standing code-standards criterion. |
| **`auto`** (default) | Planner decides per task: default each task to `low_level`, and add `high_level` detail **only** where implementation guidance genuinely reduces risk (tricky wiring, non-obvious API usage, a pattern easy to get wrong) **and** the detail is grounded. When unsure, stay low. |

### Guardrails (all modes — including `high_level`)

- **Only plan what the spec requires.** Every task traces to a stated requirement (ticket, RFC, design, or the explicit goal). **No** speculative "nice to have", refactor, cleanup, or infra tasks the spec did not ask for — raise those under **Open questions**, never as tasks.
- **Never invent.** Do not fabricate file paths, component names, functions, parameters, APIs, routes, or events — **this includes `high_level` code snippets and "how" steps**, which must reference **real** code you verified by reading the project or the spec. If you cannot ground a detail, drop that task to `low_level` or raise an **Open question**; do not invent code to look thorough. This guardrail is exactly what keeps `high_level` from drifting back into made-up plans.
- **Grounded files only.** **Files likely touched** lists paths you confirmed exist by skimming the project, plus at most the one clearly-named new file a task obviously creates. Unsure where something lives? Describe the area in prose or omit the field — do not invent a path.
- **Code standards always apply.** Every task that writes code carries the standing **`@.claude/rules/code-standards.md`** acceptance criterion (see **Project context**); any `high_level` snippet must itself obey it.
- **Consistent shape.** Every task uses the same template in **§4**, same fields in the same order, every time. In `high_level`, put the extra detail under an **Implementation notes** sub-heading in the task body — do not reshuffle the standard fields.

Bias to **fewer, larger-outcome tasks** over many fine-grained steps. In `low_level`/`auto`, if you feel the urge to specify implementation detail "to help", that urge is where invention and scope creep enter — either it's grounded and the run is `high_level`, or it goes to **Open questions**.

## Plan files (`.claude/plans/{slug}_plan.md`)

Plans live under **`.claude/plans/`** (repository root). Each plan is a **descriptively named** Markdown file:

- **Pattern:** **`{descriptive-kebab-slug}_plan.md`** — lowercase **kebab-case** slug summarizing the feature or change, then the fixed suffix **`_plan.md`**.
- **Examples:** `edit-profile-form_plan.md`, `notification-settings_plan.md`, `fix-login-redirect_plan.md`
- **Choose the slug** from the goal (ticket title, feature name, or **Overview** title in the plan). Keep it short and unique enough to recognize in a file list; avoid generic names like `feature_plan.md` or `new-stuff_plan.md` when a specific label exists.

**Write** the full implementation plan (this skill’s template) to **`.claude/plans/{slug}_plan.md`** (you choose **slug**). **Create** **`.claude/plans/`** if it does not exist. **Overwrite** the same file when revising that effort; use a **new** filename only when starting a **different** initiative (or when the slug should change after a major scope rename—then prefer one clear file and delete or archive the obsolete name only if the team agrees).

Humans, the **orchestrator**, and other agents use this path as the **single source of truth** without pasting the plan into every handoff. In chat, give a **short summary** and the **full path** (e.g. **`.claude/plans/edit-profile-form_plan.md`**) instead of duplicating the entire document.

## When to use

- Spec exists and needs implementable units
- Work is large, vague, or order-dependent
- Parallel agents/sessions need a shared task list
- Scope must be communicated to a human

**When not to use:** Single-file or obvious-scope changes; specs that already list concrete tasks.

## Debugging (same process, different goal)

For **bugs** and **incidents**, use the same templates: each task should move from **repro → isolate → fix → verify** in thin slices. Prefer tasks like “add minimal repro or failing test,” “fix root cause in `<path>`,” “add regression test,” rather than one vague “fix the bug.” The **debugger** agent (`.claude/agents/debugger.md`) owns investigation narrative and when to escalate to a full plan; you supply the **task list and checkpoints** so fixes stay reviewable and verifiable.

## Project context

- **Project profile:** read **`.claude/rules/project.md`** first — stack, layout, commands, base branch, tracker, and whether an analytics or design source exists. Verification commands in plans use its `<test>`, `<lint>`, `<typecheck>`, `<build>`, `<e2e>` slots; never plan a check marked `none` there.
- **Code standards (always):** **`@.claude/rules/code-standards.md`** is non-negotiable for any task that writes code. Give **every** such task this **standing acceptance criterion** so the builder and reviewer enforce it:

  > - [ ] Conforms to **`@.claude/rules/code-standards.md`** and any stack add-on listed in `project.md`.

  Add this criterion verbatim; do not restate the individual rules elsewhere in the task.
- **Analytics (only when `project.md` lists a convention):** When the work adds or changes a **user-facing action**, the plan must name the event(s) it emits using that convention. Reuse existing event names; a new one is its own acceptance criterion. If the spec already lists events, carry them verbatim into the relevant tasks. With no convention listed, do not plan analytics unless the spec asks.

## Process

### 1. Plan mode (read-only except `.claude/plans/{slug}_plan.md`)

**Start in plan mode, or enter plan mode before anything else.** Read the spec and relevant code; map dependencies and risks. **No product or implementation code changes**—the only file you may create or update during planning is **`.claude/plans/{descriptive-slug}_plan.md`** (the plan artifact; create **`.claude/plans/`** if needed).

### 1b. Design-first specs (Figma MCP)

When the **main input is a ticket** (a key like `PROJ-123`, a URL, or explicit "implement this ticket"), the planner must ground the plan in the ticket **before** writing tasks:

| Input                                   | Action                                                                                                                                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **figma.com/design/…** with `?node-id=` | Extract `fileKey` (use **branch key** if URL is `…/branch/:branchKey/…`). Convert `node-id` **hyphens to colons** (e.g. `12-34` → `12:34`). Call **`get_design_context`** with `fileKey`, `nodeId`, and `clientLanguages` / `clientFrameworks` matching the project's stack. |
| **No node in URL** or wrong scope       | Call **`get_metadata`** on the page or a parent node (e.g. `0:1`), pick child node ids from names/layers, then **`get_design_context`** on each slice to plan. **Skip `get_metadata` for Figma Make files** (per MCP tool rules).                                                                |
| **figma.com/board/…** (FigJam)          | Use **`get_figjam`** per Figma MCP server instructions, then plan tasks from that output.                                                                                                                                                                                                        |
| **figma.com/make/…**                    | Use **`makeFileKey`** as `fileKey` per MCP; prefer **`get_design_context`**; do not use `get_metadata`.                                                                                                                                                                                          |

**Plan outputs:** Map frames/components and annotations to **R1…** requirements and **numbered tasks**. Each UI task should have acceptance criteria that tie to **design intent** (layout regions, components, states, copy where shown). Note **reference-only**: MCP-generated code must be **adapted** to this project's stack and **`@.claude/rules/code-standards.md`**. Include the **original design URL** (and node if helpful) in the plan so builder and verifier can reopen the node.

If the design is incomplete or MCP output is thin, add **open questions** and risks instead of inventing details.

### 1c. Ticket as primary spec

When the **main input is a ticket** (a key like `PROJ-123`, a URL, or explicit "implement this ticket"), the planner must ground the plan in the ticket **before** writing tasks:

| Input                               | Action                                                                                                                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ticket key** or **URL**           | Load **`@.claude/rules/issue-tracker.md`** and fetch the one issue by key using the tracker's tool it names.                                                                                                                                        |
| **Epic / parent only**              | If the user points at a parent issue, fetch that issue first; fetch linked children or subtasks only when the tool response is insufficient and another read call is justified.                                                                     |

**Plan outputs:** Map summary, description, **Acceptance Criteria** (field or structured description), technical notes, and linked RFC URLs to **R1…** and **numbered tasks** (traceability in acceptance criteria). Include the **ticket key** and **URL** in the **Overview**. **Read-only:** do not create or update tickets from planning unless the user explicitly requests it.

If fetching fails or content is thin, add **open questions** and ask for minimal pasted context rather than guessing scope.

### 2. Dependency graph

Order work so foundations exist first (types, API contract, shared modules, then UI that consumes them). Note what blocks what.

### 3. Vertical slices

Prefer **end-to-end thin slices** (one user-visible path: data + UI + wiring) over horizontal layers (“all API, then all UI”). Each slice should leave something **working and testable**.

### 4. Write tasks

**First**, add the task to the **Task checklist** section (near top of plan):

```markdown
- [ ] **N.** [Short task title]
```

**Then**, write the detailed task section. Use this structure for **every** task:

```markdown
## Task [N]: [Short descriptive title]

**Description:** One or two plain sentences on the outcome this delivers and why. No code, no implementation steps.

**Acceptance criteria:**

- [ ] [Specific, testable, user-observable condition]
- [ ] [Specific, testable, user-observable condition]
- [ ] Conforms to `@.claude/rules/code-standards.md` (tasks that write code — standing criterion, see **Project context**)

**Verification:** One line — the check(s) that actually prove the criteria (e.g. `<test> <file>`, `<build>`, or a named manual step). Don't pad with checks this task doesn't need.

**Dependencies:** [task numbers] | None

**Files likely touched:** [grounded paths you confirmed exist in the project, plus at most one obvious new file — or omit this field if unsure; never invent a path]

**Estimated scope:** XS | S | M | L (if L+, split further)

**Tests:** after implementation (orchestrator runs **builder** → **verifier** → **test-engineer** writes meaningful tests) | **not required** — `{brief reason}` when no meaningful test is worth writing

**Implementation notes:** *(only in `high_level` mode, or an `auto` task that warrants it)* Grounded code snippets, "how" steps, and function/parameter shapes — referencing **real** project code (see **Never invent** guardrail). Illustrative reference for the builder, not a mandate. Omit this field entirely in `low_level`.
```

**Analytics events in acceptance criteria:** When `project.md` lists an analytics convention and a task adds or changes a tracked user-facing action, add an explicit, testable acceptance criterion naming the event per that convention. A new event constant is its own criterion or a small foundation task others depend on.

**Checklist rules:**

- Task numbers must be consecutive (1, 2, 3…); do not skip
- Planner always creates tasks **unchecked** (`[ ]`)
- Builder/orchestrator mark `[x]` **only after** verification + commit (see **Task checklist ownership** below)

### 5. Order and checkpoints

- Satisfy dependencies; keep the repo buildable after each task when possible.
- Add checkpoints every 2–3 tasks or after each phase.
- Put **high-risk** items early (fail fast).

**Checkpoint example:**

```markdown
## Checkpoint: After Tasks 1–3

- [ ] `<test>` / targeted tests pass
- [ ] `<build>` succeeds
- [ ] Core flow works end-to-end (manual or e2e)
- [ ] Human review before next phase (if required)
```

## Task sizing

| Size   | Files | Guidance                               |
| ------ | ----- | -------------------------------------- |
| **XS** | 1     | Single function, config, or tiny tweak |
| **S**  | 1–2   | One module, component, or endpoint slice |
| **M**  | 3–5   | One vertical feature slice             |
| **L**  | 5–8   | Multi-component; consider splitting    |
| **XL** | 8+    | **Too large** — break down             |

**Split if:** multi-session work; acceptance criteria explode; multiple independent subsystems; title contains “and” for two different outcomes.

## Plan document template

Deliver the full plan in this shape (copy and fill). **Materialize it in `.claude/plans/{slug}_plan.md`** (see **Plan files** above).

```markdown
# Implementation Plan: [Feature name]

## Overview

[One paragraph]

## Architecture decisions

- [Decision + rationale]

## Task checklist

<!-- Single status tracker — builder/orchestrator mark [x] after verification + commit -->

- [ ] **1.** [Short task title]
- [ ] **2.** [Short task title]
- [ ] **3.** [Short task title]

## Task details

**Phase 1: [Name]**

## Task 1: [Short descriptive title]

**Description:** One or two plain sentences on the outcome and why. No code or implementation steps.

**Acceptance criteria:**

- [ ] Specific, testable, user-observable condition
- [ ] Specific, testable, user-observable condition
- [ ] Conforms to `@.claude/rules/code-standards.md` (tasks that write code — standing criterion, see **Project context**)

**Verification:** One line — the check(s) that prove the criteria (e.g. `<test> <file>`, `<build>`, or a named manual step).

**Dependencies:** None

**Files likely touched:** grounded project paths (or omit if unsure — never invent)

**Estimated scope:** S

**Tests:** after implementation

## Task 2: …

…

### Checkpoint: After Tasks 1–2

- [ ] `<test>` / targeted tests pass
- [ ] `<build>` succeeds
- [ ] Manual verification complete

**Phase 2: …**

## Task 3: …

…

## Risks and mitigations

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| …    | H/M/L  | …          |

## Open questions

- …

## Parallelization

- **Safe parallel:** independent slices, tests for stable code, docs
- **Sequential:** migrations, shared contracts, ordered refactors
- **Coordinate first:** shared API/types — define contract, then parallelize consumers
```

### Task checklist ownership

The **Task checklist** section is the single status tracker. Ownership:

| Role             | Permissions                                               |
| ---------------- | --------------------------------------------------------- |
| **Planner**      | Create/edit task content, reorder, add/remove (unchecked) |
| **Builder**      | Mark `[x]` or `[ ]` only — no content edits               |
| **Orchestrator** | Mark `[x]` or `[ ]` only — no content edits               |
| **Others**       | Read only                                                 |

**When to mark checked:** After verification passes **and** commit is created.

## Related agents

| Agent        | Role                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Planner**  | Feature/spec plans (`.claude/agents/planner.md`)                                                                                                       |
| **Debugger** | Bug investigation + fix plan using this skill (`.claude/agents/debugger.md`)                                                                           |
| **Builder**  | Executes tasks from **`.claude/plans/{slug}_plan.md`**, planner output, or debugger task lists (`.claude/agents/builder.md`, `subagent_type: builder`) |

## Handoff to builder

The **builder** reads the plan at the **path provided** (e.g. **`.claude/plans/edit-profile-form_plan.md`**) as the authoritative task list and executes tasks in order. Plans should:

- Number tasks and list **dependencies** explicitly.
- Name **files likely touched** so diffs stay scoped.
- Include **verification** the verifier can reuse.

## Pre-flight checklist

Before handing off:

- [ ] **Task checklist** section exists with all tasks numbered and unchecked
- [ ] Every task has acceptance criteria and verification
- [ ] Every task traces to a stated requirement — no speculative/extra tasks the spec didn't ask for
- [ ] Detail matches the run's **`detail`** mode: `low_level`/`auto`-low tasks have **no** code snippets or "how" steps; any `high_level` detail is **grounded** in real project code, not invented
- [ ] No invented paths, components, functions, parameters, or APIs — including any `high_level` snippet; `Files likely touched` are grounded in the project (or omitted); unknowns are **Open questions**
- [ ] Every task that writes code carries the standing **`@.claude/rules/code-standards.md`** acceptance criterion
- [ ] Dependencies and order are explicit
- [ ] No task is XL; L tasks justified or split
- [ ] Checkpoints exist between major phases
- [ ] Open questions and risks are visible
- [ ] Where `project.md` lists an analytics convention, events for new/changed user actions are identified; new event constants captured as tasks/criteria

## Red flags

- No written task list
- Tasks without acceptance criteria or verification
- **Code snippets or step-by-step "how" instructions in a `low_level`/`auto`-low task** (those belong only in `high_level`, and only when grounded)
- **Invented file paths, components, functions, parameters, APIs, or `high_level` code snippets** not verified against the project or the spec
- **Speculative tasks** (refactors, cleanups, "while we're here") the spec never asked for — these belong in Open questions
- **A code task missing the standing `@.claude/rules/code-standards.md` acceptance criterion**
- Only XL tasks, no checkpoints
- Ignoring dependency order
- Horizontal-only slicing with a big “wire everything” finale
- Where an analytics convention exists: user-facing actions added or changed with no event identified, or events outside the convention
