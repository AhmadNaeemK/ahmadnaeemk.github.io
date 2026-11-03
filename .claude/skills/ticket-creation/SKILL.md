---
name: ticket-creation
description: Draft and create scoped tickets from an RFC or equivalent context, in whichever issue tracker project.md names. Use when creating issues or tickets.
---

# Ticket creation

Create **frontend, backend, or otherwise scoped tickets** in the project's tracker.

## When to use

Run `/create-ticket` to produce scoped tickets. It works **after `/spec`** when an RFC already exists, or **independently**: the skill ensures the required context is in place before drafting.

## Mandatory first step

Read and apply **`.claude/rules/issue-tracker.md`** (placement, issue types, title style) and the tracker named in **`.claude/rules/project.md`**. Do **not** duplicate those rules here.

---

## Process

### 1. Ensure context is available

Before drafting any ticket these three things **must** be established. Check the conversation history, any linked RFC, or user-provided materials.

| Required knowledge                                     | Where to find it                                 |
| ------------------------------------------------------ | ------------------------------------------------ |
| **Problem context** — why we are doing this            | RFC `## Context`, conversation, or user input    |
| **Decided solution** — what approach was chosen        | RFC `## Executive Summary` / approach discussion |
| **Step-by-step implementation plan** — how to build it | RFC implementation guide / detailed change list  |

- **RFC available** (path or URL provided, or `/spec` was run in this session): read it and extract the three items above.
- **No RFC:** ask the user to supply (a) the problem context, (b) the decided solution, and (c) a step-by-step implementation plan, or to point to an existing RFC. Do not proceed until all three are confirmed.

### 2. Determine scope

Ask (or infer from the RFC or conversation) whether the work needs a **frontend ticket**, a **backend ticket**, or **both**. For projects without that split, use the frontend template for user-visible work and the backend template otherwise.

### 3. Draft descriptions

#### Frontend ticket template

```markdown
## Context

<High-level problem/goal. End with a one-liner summary of the chosen solution.>

## Acceptance Criteria

1. <Impact-oriented outcome — written for manual testing>
2. …

## Technical Notes

- **RFC**: <path or URL>
- **Implementation steps** (from RFC):
  1. <Key step>
  2. …
- <Architectural, security, or privacy decisions relevant to this work>
```

- **Context**: state the problem first, then one sentence on the solution. Keep it brief enough for someone outside the team to follow.
- **Acceptance Criteria**: each point describes a user-visible impact or behavior change, phrased from the end user's perspective.
- **Technical Notes**: link the RFC, surface the relevant implementation steps, and call out architectural, security, or privacy decisions.

#### Backend ticket template

```markdown
## Context

<High-level problem/goal. End with a one-liner summary of the chosen solution.>

## Tasks

1. <Step from the implementation plan — link to RFC section where applicable>
2. …

## Acceptance Criteria

1. <Dev-testing perspective — expected API responses, state changes, edge cases>
2. <User-visible perspective when applicable — observable behavior>

## Error Handling _(include for API changes)_

- <Expected error codes, messages, and recovery behavior>

## Security & Privacy Considerations _(when applicable)_

- <Auth/permission changes, PII handling, new attack surface, compliance>

## Performance Considerations _(when applicable)_

- <Latency budgets, query limits, throughput targets>
```

- **Tasks**: the implementation guide at summary level, linked to the RFC. Don't enumerate every line of code.
- **Acceptance Criteria**: write from a dev-testing lens, and include user-facing points when the change has visible side effects.
- **Error Handling**: required when the ticket introduces or modifies an API.
- **Security & Privacy** and **Performance**: include when the change touches those concerns.

### 4. Issue type and title

Apply the issue type and title rules from `issue-tracker.md`.

### 5. Review

Present the full draft(s) in chat. **Do not create** until the user explicitly confirms each ticket.

### 6. Create

Create each ticket with the tool `project.md` names, and return a **URL** for every created ticket.

---

## Verification

| Check                  | Evidence                                                             |
| ---------------------- | -------------------------------------------------------------------- |
| Context established    | Problem, solution, and implementation plan confirmed before drafting |
| Correct template       | Template matches each ticket's scope                                 |
| No routing duplication | Tracker and placement resolved via `project.md` and `issue-tracker.md` |
| RFC linked             | RFC link present in Technical Notes or Tasks, when an RFC exists     |
| User confirmed         | Drafts approved before any create call                               |

## Inputs

Provide any combination of:

- **RFC path or URL** (if one exists)
- **Scope** — frontend, backend, or both
- **Project or board**, if not the default
- **Title hints** or labels
- Additional context not captured in an RFC
