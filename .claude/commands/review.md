---
description: Standards-first diff review (staged, branch, or GitHub PR) against code-standards.md and optional ticket Acceptance Criteria—same behavior as the reviewer agent; complements verifier (plan/requirements proof).
argument-hint: [pr-url | branch | (staged)]
---

# /review — Code review

A **diff-first** standards review (enforce **`@.claude/rules/code-standards.md`**, classify findings **blocker** | **should-fix** | **nit**, optionally map **ticket AC**). This is **not** plan-based verification — for that use **`@.claude/agents/verifier.md`**.

**Action:** Read and follow **`@.claude/agents/reviewer.md`** end-to-end for the review target below. Do not cherry-pick sections of that file.

## Inputs (provide at least one review target)

| Input              | Required?               | What to pass                                                                                            |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| **Review target**  | **Yes** (pick one mode) | See **modes** below.                                                                                    |
| **Ticket key** | No                      | e.g. `PROJ-123` — fetch AC and map each criterion to the diff (pass / partial / gap / unclear).         |
| **Extra context**  | No                      | Links, screenshots, “focus on X”, risk areas, or reviewer questions—the agent uses these to prioritize. |

### Review target modes (choose one)

| Mode              | When to use                                             | What the user should include in the message                                                                                           |
| ----------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Self-review**   | Changes are **staged**; reviewing before commit.        | Nothing else, or say “staged” / “self-review”. Agent uses **`git diff --staged`** (empty → user must stage files).                    |
| **Branch review** | Compare a feature branch to a base (local or `origin`). | **Base** and **feature** ref names, e.g. `main` vs `feature/PROJ-123-foo`, or `origin/main ... origin/feature/foo`.         |
| **PR review**     | Review a GitHub pull request diff.                      | **Full PR URL** for this repo, e.g. `https://github.com/<org>/<repo>/pull/123`. Agent uses **`gh pr diff`** when available. |

**Orchestrator note:** If this review is the **final** branch diff after all plan tasks, the orchestrator diffs against **`<base-branch>`** from `project.md` (or a different base named in the handoff / user message).

## Inputs template (paste below)

- **Mode:** self-review | branch | PR
- **Branch base / feature** _(branch mode only):_
- **PR URL** _(PR mode only):_
- **ticket key** _(optional):_
- **Notes** _(optional):_

```text

```
