---
description: Language- and framework-neutral code standards — clean code, architecture, performance, security, and time handling. Applies to all code in the repository; stack add-ons listed in project.md extend it.
---

# Code standards

Apply these when writing or reviewing code. Match nearby files in the same feature or folder; when in doubt, prefer consistency with siblings over generic patterns. Stack, layout, and commands come from **`.claude/rules/project.md`**.

## Stack and structure

- **Do not swap libraries ad hoc.** Use the framework, data layer, and UI libraries in `project.md`. Adding a dependency needs a reason and a manifest update.
- **Follow the layout in `project.md`.** Keep a module's pieces (types, styles, helpers, tests) together rather than spread across unrelated folders.
- **Respect boundaries.** Reuse through shared modules instead of reaching into another feature's internals. Avoid circular imports and "god" modules.
- **Match the import style** already used nearby: order, aliases, and named vs default exports.

---

## 1. Clean code

**Naming**

- Names must be intention-revealing and distinct: communicate *what* and *why*, not *how*.
- Avoid vague names such as `data`, `obj`, `temp`, `result`, `helper`, `val`, `x`, `info`, or unqualified `response` (prefer e.g. `userResponse`, `orderPayload`).

**Functions**

- Each function does one clear job. A module with several reasons to change should be split.
- Prefer **few parameters**; for several related values use a single options object instead of long positional lists.
- Avoid **boolean parameters that radically change behavior**; prefer separate functions, composition, or a discriminated union.
- Side effects belong in obvious places, not hidden inside helpers that look pure.

**Comments**

- Comment only non-obvious *why* (invariants, workarounds, security or product constraints). Do not restate the code or leave commented-out code.

**DRY**

- Do not duplicate validation rules, cache-key shapes, or API mapping logic; centralize them.

**Conciseness**

- Remove pointless intermediate variables; prefer early returns and small helpers over deep nesting.

**Magic strings and identifiers**

- Do not scatter raw literals for routes, event names, roles, or API discriminator values. Use constants or enums, consistent with existing modules.

**Branching**

- Replace long `if/else` chains on a single discriminant with a map to handlers or config when it improves clarity.

---

## 2. Architecture

**Thin entry points, logic elsewhere**

- Entry points (pages, route handlers, CLI commands) orchestrate: **parse inputs → call logic → render or respond**. Business rules belong in focused modules where they can be tested without the framework.

**File size and modules**

- Avoid monolith files. If a file grows large or mixes unrelated concerns, split it into a folder of focused modules.

**SOLID**

- **Single responsibility** — one main reason to change per module.
- **Open/closed** — extend via composition and configuration, not sprawling conditionals.
- **Liskov** — wrappers and subtypes honor the contracts callers expect.
- **Interface segregation** — small interfaces; avoid "options for everything" base modules.
- **Dependency inversion** — high-level code depends on typed or well-named interfaces, not raw transport details.

---

## 3. Performance

- Do not fire **N identical requests** in a loop; batch or structure the call at the list level.
- Do not load unbounded collections into memory without pagination or streaming when the data can be large.
- Avoid obvious **O(n²)** patterns over large inputs; precompute maps or sort once.
- Optimize when profiling or an obvious hot path calls for it; avoid preemptive micro-optimization.
- Prefer lazy loading for heavy, rarely used code when the codebase already does so for similar cases.

---

## 4. Security and safety

**Secrets and configuration**

- No API keys, tokens, or secrets in source. Use the project's environment configuration, and remember anything shipped to a browser is public.

**Injection and untrusted input**

- Do not pipe untrusted strings into HTML, SQL, shell commands, or `eval`. Use parameterization and vetted sanitizers.

**Auth and data exposure**

- Do not log **passwords, tokens, or full session objects**. Redact PII in logs unless required and approved.
- Only expose fields the user is allowed to see.

**Input validation**

- Validate input at the boundary. Client-side checks are for usability; the server must enforce anything security-critical.

**Network and dependencies**

- Do not disable TLS verification in application code. Avoid unsafe deserialization.

**Error handling**

- User-facing error copy should be **safe and generic** where stack traces or internal paths would leak implementation detail. Use the project's existing error handling.

---

## 5. Time and dates

- Store and transmit timestamps in UTC.
- Display them in the user's chosen timezone and format when the project has those preferences; do not treat the machine's timezone as the source of truth where a preference exists.

---

## Verification

After substantive changes, run `<lint>` and `<typecheck>`, plus targeted `<test>` when behavior is covered by nearby tests.
