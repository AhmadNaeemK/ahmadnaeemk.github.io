---
name: unit-testing
description: Unit testing for pure logic, helpers, hooks, and isolated components with mocked boundaries. Use when a test needs no network stubs, router, or full provider stack. Includes a Jest + React Testing Library recipe.
---

# Unit testing

Prove behavior at the **lowest** level: functions, modules, and components with externals mocked. Use **integration-testing** when the code needs stubbed HTTP, providers, or routing. Test tooling comes from `.claude/rules/project.md`; what to test comes from `.claude/rules/tests.md`.

## Rules

1. Every test asserts something meaningful; names read like specs.
2. Run `<test> <path>` before stopping; fix failures and re-run.
3. Never mock the unit under test; mock boundaries (modules, clock, browser or OS APIs).
4. Prefer assertions on observable results over internals.
5. One concept per test; no shared mutable state; avoid snapshots unless every change is deliberately reviewed.

## Files

Follow the test file patterns in `project.md` and the placement used by neighboring tests. Keep fixtures next to the tests that use them, as factories with overridable defaults.

## Structure

Group by unit, then by condition, then by expectation. Arrange → act → assert.

## Pre-flight

- [ ] Assertions in every test; no leaked mock state
- [ ] `<test> <file>` green after each logical chunk

---

## Recipe: Jest + React Testing Library

Use this section when `project.md` lists these tools, and match the installed versions (for example, `renderHook` ships in RTL 13.1+, and `userEvent.setup()` in `user-event` 14+).

**Queries:** `getByRole` (+ `{ name: /pattern/i }`) → `getByLabelText` → `getByPlaceholderText` → `getByText` / `findByText` → display value queries → `getByTestId` (last). Use `within` for duplicates, `queryBy*` for absence, `findBy*` after async, and `waitFor` for state that changes over time.

**Interactions:** prefer `userEvent` over `fireEvent`.

**Matchers:** `toBeInTheDocument`, `toBeDisabled` / `toBeEnabled` / `toBeVisible` / `toBeChecked`, `toHaveTextContent` / `toHaveValue`, `toHaveAttribute`, and spy matchers with `expect.objectContaining` where helpful.

**Replaceable mock:**

```js
const mockGetUser = jest.fn(() => ({ name: 'Ada' }));
jest.mock('./user-service', () => ({
  getUser: () => mockGetUser(),
}));
```

**Partial mock** (spread actual, override one export), useful for analytics, feature flags, and heavy UI:

```js
jest.mock('./analytics', () => ({
  ...jest.requireActual('./analytics'),
  track: jest.fn(),
}));
```

**Timers:** `beforeEach` → `jest.useFakeTimers()` + `jest.setSystemTime(...)`; `afterEach` → `jest.useRealTimers()`.

**Fixture factory:** `export const createUser = (overrides = {}) => ({ ...defaults, ...overrides });`

**Error boundary:** spy on `console.error`, throw in a child, assert the fallback, then `spy.mockRestore()`.

**Accessibility spot-checks:** `toHaveAccessibleName`, and `type="submit"` on submit buttons when relevant.
