---
description: Find root cause for a tracked ticket or a described bug; present a fix plan and implement only after developer approval—aligned with the debugging skill, code standards, and the project's verification commands.
argument-hint: [ticket-key | bug-description]
---

# /fix — Root-cause fix (ticket or description)

Investigates the **root cause** of an issue, presents it with a **fix plan**, and implements only after developer approval.

## When to use

Developer runs `/fix` with a **ticket key** or a **free-text** issue description and reproduction steps.

## Mandatory rules

All fixes must comply with **`@.claude/rules/code-standards.md`** and any stack add-on listed in **`.claude/rules/project.md`**.

Follow the triage order and guardrails in **`@.claude/skills/debugging-and-error-recovery/SKILL.md`** (reproduce → localize → reduce → fix → guard → verify). For role boundaries and optional agent handoffs, see **`@.claude/agents/debugger.md`**.

## Process

### Phase 1 — Understand the issue

1. **Intake** — If a **ticket key** is given: fetch the ticket (description, acceptance criteria, comments, linked issues), following **`@.claude/rules/issue-tracker.md`**. Otherwise use the provided description and reproduction steps from chat.
2. **Clarify** — If the issue is ambiguous or reproduction steps are missing, ask targeted questions before heavy investigation. Do not guess.

### Phase 2 — Investigate root cause

3. **Explore the code** — Search for related modules; trace the code path involved. Read relevant tests, error handling, and data flow. Cite file paths and line numbers where it helps.
4. **Form hypotheses** — From exploration, list one or more plausible causes.
5. **Narrow to root cause** — Trace hypotheses until you identify the **root cause** (why behavior is wrong), not only a surface symptom. If new gaps appear, ask the developer.

### Phase 3 — Present root cause + fix plan (no code changes yet)

6. **Present to the developer:**

   - **Root cause** — Plain language, tied to specific code paths and why the behavior is incorrect.
   - **Fix plan** — Numbered steps: which files change, what changes in each, and why.
   - **Risk** — What could regress, what else might be affected.
   - **Tests to add** — Regression coverage (unit, integration, or E2E as appropriate) that would fail without the fix and pass with it.

7. **Wait for approval** — Do **not** edit application or test source until the developer **explicitly approves** the fix plan (silence is not approval).

### Phase 4 — Implement and test (after approval)

8. **Implement** — Apply the approved plan with **minimal** changes that address the root cause; stay within **`code-standards.md`** and existing project patterns.
9. **Add regression tests** — Implement the agreed tests (follow **`@.claude/skills/unit-testing/SKILL.md`** and **`@.claude/skills/integration-testing/SKILL.md`** when editing tests). If the session is running under orchestrator rules that reserve test files for **`test-engineer`**, document the scenario and delegate test authorship instead of editing those files yourself.
10. **Run tests** — Run **targeted** checks first, then widen as needed, for example:

    ```bash
    <test> path/to/file.test.js
    <test> <single-test filter, per your test runner>
    <lint> && <typecheck>
    ```

    Use **`<build>`**, **`<dev>`**, or **`<e2e>`** when the bug is build-time, UI-only, or journey-level (see **`.claude/rules/project.md`**). Skip any command marked `none`.

## Verification

| Phase       | Check                                                                |
| ----------- | -------------------------------------------------------------------- |
| Understand  | Issue is clear; ambiguities resolved with the developer              |
| Investigate | Root cause ties to a specific path, not only a surface symptom       |
| Present     | Fix plan, risk, and tests stated; **explicit** approval before edits |
| Implement   | Fix applied; regression guard in place; targeted verification passed |

## Input

**Ticket key** **or** paste **issue description** / reproduction steps below.

---

Ticket or description:

```text

```
