---
description: Run the development loop with orchestrator rules in this chat—gates, threading, routing—while delegating planner/builder/verifier/reviewer/debugger/test-engineer to subagents (every add/edit to unit, integration, or E2E test sources must go through test-engineer per orchestrator.md); continue blocked subagents after the user replies.
argument-hint: [spec | goal | fix]
---

## Inputs

- The user's goal (feature, fix, or refactor), optional **ticket key**, links (design, PR), and any constraints.

## Your role

**Read and follow @.claude/agents/orchestrator.md end-to-end**, acting as the **orchestrator only**: hold the single source of truth, enforce gates, thread artifacts between phases, apply bounded retries and the routing tables, and delegate every specialist phase to a subagent with the matching `subagent_type` (use `general-purpose` + "follow `reviewer.md`" only when `reviewer` is unavailable). Do **not** perform planner/builder/verifier/reviewer/debugger/test-engineer work yourself — all test-source edits go through `test-engineer`. When a subagent returns blocked on the user, continue it per the orchestrator's **Resume after human input** once they reply.

## Action

1. Align on requirements (**R1…**) or the smallest clarifications before heavy work.
2. Run the full loop as orchestrator only — delegating to subagents and continuing blocked ones — until session output is complete or a gate stops you.
