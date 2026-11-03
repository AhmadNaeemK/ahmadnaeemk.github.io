---
name: browser-verification
description: Verifier workflow for driving browser checks against a running app as part of sign-off. Works with whatever browser tool the session has (built-in browser, Playwright MCP, Chrome); anything worth keeping becomes a committed E2E spec when the project has E2E tooling. The agent is the runner, not the owner — the verification layer is tool-agnostic by design.
---

# Browser verification (sign-off)

Drive browser checks against a running app as part of sign-off. Two-tier model:

| Tier                     | Tool                                      | Lifetime              | Purpose                                                   |
| ------------------------ | ----------------------------------------- | --------------------- | --------------------------------------------------------- |
| **Ad-hoc / exploratory** | Any browser tool available in the session | Session only          | Confirm AC, smoke-check surfaces, investigate regressions |
| **Committed spec**       | The project's `<e2e>` tooling, if any     | Permanent (CI-backed) | Regression guard for any check worth keeping              |

The agent runs both tiers. It does not own the spec; committed code is the artefact.

## Choosing a browser tool

Use what the session offers. Commonly: the built-in browser pane, a Playwright MCP server (`browser_*` tools), or Claude in Chrome. Prefer an accessibility-tree or page-text read over screenshots for verifying text and structure.

Pick a browser profile by **flow type**:

| Flow                 | Use                                   | When                                                         |
| -------------------- | ------------------------------------- | ------------------------------------------------------------ |
| **Unauthenticated**  | A clean session with no saved sign-in | Login, signup, public routes, anything that must not reuse auth |
| **Authenticated**    | A session with saved test credentials | In-app surfaces; use a test account, never real credentials  |

**Login wall?** Switch to the authenticated profile, or validate only unauthenticated behavior. Do not loop on automated OAuth popups. If stored auth is missing or expired, ask the user to refresh it.

---

## Prerequisites

1. **App is reachable.** Start `<dev>` from `.claude/rules/project.md` or use the URL the user gave. If it is not up, stop and ask.
2. **Acceptance criteria are loaded.** Read them from the plan file or fetch the ticket per `.claude/rules/issue-tracker.md`. Each AC item becomes one browser check.

---

## Phase 1 — Ad-hoc checks

1. **Navigate** to the route under test.
2. **Read, then act.** Get the current page structure before any structural action, and prefer element references over coordinate clicks.
3. **Assert per AC item:**
   - Visible text, elements, and state (enabled, disabled, checked, selected)
   - URL changes after navigation
   - Error states and empty states
   - Console output, to surface JS errors
   - Network requests, to verify API calls and status codes
   - Screenshots, as evidence for failures or for the sign-off table
4. **Output a sign-off table:**

```markdown
## Browser sign-off — <ticket key or plan task>

| AC   | Check               | Result            | Notes                |
| ---- | ------------------- | ----------------- | -------------------- |
| AC-1 | <what was verified> | ✅ Pass / ❌ Fail | <screenshot or note> |
| AC-2 | …                   | …                 | …                    |

**Verdict:** ✅ Ready to merge / ❌ Blocked — see notes above
```

If any AC item **fails**, stop and report it before proceeding. Do not sign off.

---

## Phase 2 — Promote to a committed spec

**Skip this phase when `<e2e>` is `none` in `project.md`.** Note in the report that the check stays manual.

Promote a check when **any** of these apply:

- It covers a **critical user path** (login, onboarding, checkout, settings save)
- The same check will be needed for **future work** on the same surface
- The bug that prompted the work is a **regression risk**
- The AC is complex enough that a one-off manual step is error-prone
- The ticket or team asks for E2E coverage

**Spec conventions**

- Follow the layout and patterns of existing specs; name files after the feature and behavior.
- Prefer role-based locators (`getByRole`, `getByText`, `getByLabel`) over fragile CSS or XPath.
- Stub unstable external calls such as OAuth popups.
- Keep each test focused on one AC item.

**Minimal Playwright template** (adapt if the project uses another tool)

```js
import { expect, test } from '@playwright/test';

test.describe('<Feature>: <short description>', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/<route>');
    await expect(page.getByRole('heading', { name: /<heading>/i })).toBeVisible();
  });

  test('Verify <AC item>', async ({ page }) => {
    await page.getByRole('button', { name: /<label>/i }).click();
    await expect(page.getByText(/<expected text>/i)).toBeVisible();
  });
});
```

The spec must be green via `<e2e> <spec-path>` before it is committed.

---

## Verifier integration

When invoked as part of the orchestrator or verifier loop, this skill replaces or augments the static plan-file check for UI work. The verifier should:

1. Read the AC from the ticket or plan file
2. Confirm the app URL and whether each check is unauthenticated or authenticated
3. Run Phase 1 and record results in the sign-off table
4. Decide whether Phase 2 is needed; write and green the spec if so
5. Return the sign-off table and spec path (if any) to the orchestrator

**The verifier does not sign off if any AC item fails.** It surfaces the gap and hands back to the builder.

---

## Pre-flight checklist

- [ ] App URL is reachable
- [ ] AC loaded and all items enumerated
- [ ] A browser tool is available, with the right profile for each flow
- [ ] Sign-off table produced with one row per AC item
- [ ] Failing items documented with evidence
- [ ] Promotion decision made and justified (or skipped because `<e2e>` is `none`)
- [ ] New spec, if written, is green before commit
