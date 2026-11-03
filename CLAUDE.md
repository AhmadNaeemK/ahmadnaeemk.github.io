# Claude Code project instructions

## Project conventions

**Always applied** (imported into every session):

- **Project profile (stack, commands, branches, layout):** @.claude/rules/project.md
- **Code standards:** @.claude/rules/code-standards.md
- **React add-on:** @.claude/rules/react.md

**Referenced** by the commands, skills, and agents that use them:

- **Design system:** `.claude/rules/design-system.md`
- **Issue tracker:** `.claude/rules/issue-tracker.md`
- **Spec documents:** `.claude/rules/spec-docs.md`
- **Commit conventions:** `.claude/rules/commit-conventions.md`
- **Testing:** `.claude/rules/tests.md`

## Agents

Specialist sub-agents live in `.claude/agents/`. The orchestrator coordinates a gated tests-after loop:

| Agent             | Purpose                                                               |
| ----------------- | --------------------------------------------------------------------- |
| `orchestrator`    | Gated loop: plan → implement → verify → meaningful tests → review     |
| `planner`         | Breaks work into ordered tasks, writes `.claude/plans/{slug}_plan.md` |
| `builder`         | Implements code from a plan                                           |
| `test-engineer`   | Writes/updates all test sources (unit, integration, E2E)              |
| `verifier`        | Validates implementation against plan and requirements                |
| `reviewer`        | Standards-first diff review against code-standards.md                 |
| `review-resolver` | Resolves GitHub PR review comments systematically                     |
| `debugger`        | Systematic root-cause debugging                                       |

**Scope boundary (mandatory).** Every specialist agent carries a **Scope boundary (mandatory)** section: work another role owns is handed back via a fixed `HANDOFF` block, never performed (flag-then-proceed is prohibited). Subagents return the block to the orchestrator, which re-dispatches; inline (`behave as`) agents present it to the user and ask. Read-only lookups are always allowed.

## Slash commands

| Command           | Purpose                                                  |
| ----------------- | -------------------------------------------------------- |
| `/orchestrate`    | Run the full tests-after orchestration loop              |
| `/research`       | Research a question and propose a solution, in chat only |
| `/plan`           | Create an implementation plan                            |
| `/build`          | Run a single plan task through the tests-after slice     |
| `/review`         | Review staged changes, a branch, or a GitHub PR          |
| `/resolve-review` | Resolve all comments on a GitHub PR                      |
| `/fix`            | Root-cause fix for a bug or ticket                       |
| `/spec`           | Create an RFC from a problem statement                   |
| `/create-pr`      | Run CI-parity checks and open a GitHub PR                |
| `/create-ticket`  | Draft and create tickets in the project's tracker        |

## Key directories

- `.claude/plans/` — Implementation plan files (read by agents; gitignored)
- `.claude/agents/` — Sub-agent definitions
- `.claude/commands/` — Slash command definitions
- `.claude/skills/` — Reference skill documents
- `.claude/rules/` — Project coding conventions

See `.claude/README.md` for the workflow diagrams and how to adopt this setup in another repository.

## Shell output discipline (always apply)

Tool results stay in the context window for the **whole session**, so filter at the source: never print bulk output intending to read it later. Applies to subagents too.

- **Bound every listing:** end exploratory `find` / `grep` / `ls` with `| head -50`. If only the size matters, use `| wc -l` instead of printing rows.
- **Aggregate, don't enumerate:** prefer `| awk '{…}' | sort | uniq -c` to describe a shape over printing every row of it.
- **Slice files, don't dump them:** `sed -n '120,180p'`, or `Read` with `offset`/`limit`. Never `cat` a file over ~50 lines to inspect part of it.
- **Narrow wide matches:** `grep -rn … | cut -c1-140`.
- **Park bulk results on disk:** write to the scratchpad, print a count, then `grep` the file for detail.
- **Print verdicts, not transcripts,** for verification commands: pipe `<test>`, `<lint>`, and `<build>` through `| tail -20` or a `grep` for the summary lines, and run `git status --porcelain | wc -l` before printing the list itself.
- **When output size is unknown, measure first:** `… | wc -l`, then decide.
