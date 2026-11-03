---
description: Implement one numbered plan task using the default tests-after slice from the orchestrator (builder → verifier → test-engineer writes meaningful tests)—delegate specialists, mandatory test-engineer for test sources, resume rules—without running the full multi-task orchestration loop.
argument-hint: <plan-path> <task-number> [review-gate=on|off]
---

## Inputs

- **Plan file:** exact path (e.g. `.claude/plans/edit-profile-form_plan.md`). Subagents must **read the plan file**; do not rely on chat history alone.
- **Task number:** which `## Task N:` in the plan this run implements (the user names **N**).
- **Requirements** (**R1…**) and constraints: thread from the plan and user message; smallest clarifications only before heavy work.
- **`review-gate=on|off`** (optional, default **`off`**) — enables the **commit-review gate** (see **Commit-review gate** below). Omitted or **`off`** ⇒ the standard single commit approval; the **orchestrated flow always passes `off`** (the orchestrator owns its own gates).

## Your role (task slice coordinator only)

**Behave exactly as** @.claude/agents/orchestrator.md **for a single plan task's implementation slice**—same **Per-task loop (tests-after)**, **Test file ownership**, **Subagent invocation**, **Resume after human input**, **Bounded retries**, and **routing after verification**. **No per-task project build:** the pre-commit checks in `.claude/rules/project.md` cover each commit; run the full **`<build>`** (orchestrator **Final build gate**) once when the plan's tasks are complete, not after this single task. This is the **default**: **tests-after, not test-first TDD**. For an explicit test-first slice, ask for one — the test-engineer supports a test-first (red) mode on request.

**Delegate** each specialist phase with a subagent of the matching `subagent_type` (`builder`, `verifier`, `test-engineer`, `debugger`; **`general-purpose`** with "follow `reviewer.md`" only if **`reviewer`** is unavailable). **Do not** do planner, builder, verifier, debugger, test-engineer, or reviewer work yourself (no impersonation). **All** new or updated **unit**, **integration**, or **E2E** **test sources** go through **`test-engineer`**—never **builder** / **debugger** / your own edits to those files.

### In scope for this command

- **One** numbered task **N** end-to-end: **`builder`** (implement) → **`verifier`** → **`test-engineer`** (meaningful tests for the completed behavior, plus any **TestRequest** scenarios) → follow **routing after verification** (**`debugger`** as needed) until this slice's **VerificationReport** is acceptable and its tests are green (or explicitly waived) or retries are exhausted. No per-task `<build>`—the pre-commit checks cover the commit.
- **Commit flow** for this task when it is **done**: same **missing implementation or detail** + **human approval** + **one commit** rules as in orchestrator **Git commits**—unless the user explicitly defers / batches / skips commits (document in session output). When **`review-gate=on`**, the **Commit-review gate** below also applies before each commit.

### Commit-review gate (`review-gate=on`)

When **`review-gate=on`**, **forward it to `builder`** in the subagent prompt and let the agent own the behavior (see [builder.md](../agents/builder.md) **Commit-review gate**): after implementing, the builder presents its **diff** plus how-to-verify and signals **`AWAITING CODE REVIEW`** instead of a ready-to-commit summary. Your job as coordinator is the part only a coordinator can do:

- When the builder returns awaiting-review, **relay its diff to the user and hold the commit**—do **not** stage or commit until they approve the code. On requested changes, **re-dispatch `builder`** to revise within the retry budget, then re-present.
- Only after the user approves does the normal commit approval proceed (one commit per completed checklist item, per orchestrator **Git commits**).
- Scope is the **builder's implementation** only; **`test-engineer`** test changes follow the standard commit-approval flow.

When **`review-gate=off`** (default, and always in the **orchestrated flow**), don't forward the flag; follow the standard commit-approval flow—the orchestrator provides its own gates.

### Out of scope (unless the user explicitly expands)

- **Full** product loop from greenfield requirements through **planner** for a new plan (use **orchestrate** or invoke **`planner`** separately if there is no usable plan file).
- **Final diff review** across the whole feature branch is **not** mandatory after this single task (orchestrator requires it only when **all** plan tasks are complete). Offer **`reviewer`** only if the user asks or if they state all planned work is finished.

### Preconditions

- The **plan file** must describe **Task N** with acceptance criteria; the user must have **approved proceeding with Task N** (either prior **Plan approval** for the file or an explicit in-chat instruction to implement **Task N** only).
- **Never** invoke **`builder`** without **Plan-level** consent for this work—same standard as orchestrator.

## Human input without losing specialist context

1. **Gates you hold in this chat:** **commit approval**, **code approval at each Commit-review gate when `review-gate=on`**, verifier **blocked**, missing inputs—**stop**, wait for the user, then invoke the **next** Task per orchestrator routing.

2. **Blocked subagent:** When a subagent returns **blocked** or **awaiting human input**, follow orchestrator **Resume after human input**: record its agent ID, then continue it with the user's answer; if no ID, start a **new** subagent with a self-contained prompt including the answer and artifacts.

## Action

1. Confirm **plan path**, **task number N**, resolve **`review-gate`** (default **`off`**), and any **`Tests: not required`** note from the plan (or ask the smallest clarifying question).
2. Run **only** the **Per-task loop (tests-after)** slice and verification loop for **Task N** as orchestrator describes—delegating specialists to subagents until this task's slice is verified and its tests are green (or stopped on a gate / retry cap).
3. Close with a **short session summary**: task **N**, verification outcome, paths touched, test commands run, open gaps, and whether a **commit** was created or is still pending approval.
