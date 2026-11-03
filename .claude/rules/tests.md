---
description: How and what to test — test user-facing behavior, not implementation details — and which tests to remove. Use when adding, reviewing, or deleting tests.
---

# Testing

Tests exist to protect **behavior**, not to freeze implementation. A test should fail when a flow a user or caller depends on breaks, and stay green when only the implementation changes. If a styling tweak or a refactor breaks a test but nothing a user does or sees changed, that test was asserting the wrong thing.

Test tooling comes from **`.claude/rules/project.md`**. The workflow is **tests-after** (not TDD) unless the human asks otherwise, and in orchestrated runs every test-source add, edit, or delete goes through the **test-engineer** agent.

## Test behavior, not implementation

Write tests around what a user or caller can perceive or do:

- **What the user sees** — text, which state is shown, presence or absence of an element, enabled or disabled controls.
- **Interaction and flow** — clicks, typing, form submit, navigation, and the resulting state or route change.
- **Wiring and data** — API-driven behavior through stubbed boundaries (loading → success → error), callbacks firing with the right arguments.
- **Pure logic** — utilities, reducers, derivation functions: assert inputs → outputs directly. This has the highest value-to-cost ratio, so prefer extracting logic so it can be tested without a DOM or framework.

In UI tests, query the way a user finds things: by role, label, or text. Reach for a test id only when there is no accessible handle.

## Do not assert implementation details

Do not write (and remove existing) tests that assert:

- **Exact style values** — font size, padding, colors, and so on, whether via computed styles or by string-matching emitted CSS. Design correctness is verified against the design source and in the browser.
- **Responsive media-query rules** by string-matching CSS. jsdom does not evaluate media queries, so these assert a string, not anything a user experiences.
- **DOM structure, class names, or generated hashes**, or markup snapshots.
- **Library internals.** Trust the library; test only *your* behavior on top of it.

If a value must be a genuine contract (e.g. a design token), pin it **once at its source** as a plain unit assertion, never by rendering a component and reading back its computed style.

## Which existing tests to remove

Delete a test when it only asserts implementation detail and would not catch a user-facing regression: it reads computed styles, string-matches emitted CSS, snapshots markup, asserts class names, or re-tests third-party library behavior.

Keep it (and expand it if thin) when it exercises what the user sees, interaction, navigation, data flows, or pure logic.

## Coverage and scope

- Cover the meaningful branches of a behavior (empty, loading, error, success, each rendered state), not every line.
- One behavior per test; the description states the **expectation**, not the mechanism ("keeps Next disabled until every account is reconnected", not "sets `canContinue` to false").

## Verification

Run targeted `<test>` for the touched area after changes; `<lint>` and `<typecheck>` must pass. E2E specs, where the project has them, are for cross-page flows worth guarding end-to-end.
