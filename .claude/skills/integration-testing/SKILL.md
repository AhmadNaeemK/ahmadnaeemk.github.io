---
name: integration-testing
description: Integration testing for code that crosses real boundaries — API-driven UI, forms, routes, providers, or data layers — with external services stubbed. Use when a test needs network stubs, a router, or a provider stack. Includes an MSW recipe.
---

# Integration testing

Exercise code **with** its real wiring (providers, routing, data layer), stubbing only what is external. Prefer **unit** tests when you do not need this stack. Assertion style, fixtures, and naming follow **unit-testing** unless noted below. Test tooling comes from `.claude/rules/project.md`.

## Rules

1. Stub external services at the boundary (HTTP, third-party SDKs), not your own modules.
2. Keep each test isolated: reset stubs and state between tests, and restore a baseline for anything most tests need.
3. Give each file one render or setup helper with defaults, so tests override only what differs.
4. Assert what a user or caller observes, including loading, success, and error paths.

## Forms

Flow: render → wait until ready → fill → assert submit is enabled → submit → assert side effects. Clear pre-filled fields before typing, and wait for validation messages rather than asserting them synchronously.

## Pre-flight

- [ ] Assertions in every test
- [ ] Stubs reset between tests and torn down at the end
- [ ] No hardcoded URLs where the project centralizes endpoints
- [ ] `<test> <file>` green after each logical chunk

---

## Recipe: Mock Service Worker (v2)

Use this section when the project uses MSW, or propose adding it when a project needs HTTP stubs and has nothing better.

**Lifecycle**

```js
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
  server.use(getUserHandler());
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  server.use(getUserHandler());
  jest.clearAllMocks();
});

afterAll(() => server.close());
```

**Handlers:** named factories, one file per domain. Optional `delayMs`, `status` (≥ 400 → error JSON), and `onPatch` / `onPost` callbacks to capture request bodies.

```js
import { delay, http, HttpResponse } from 'msw';

export const getItemHandler = (url, body, options = {}) =>
  http.get(url, async () => {
    if (options.delayMs) await delay(options.delayMs);
    if (options.status >= 400) {
      return HttpResponse.json({ detail: 'Error' }, { status: options.status });
    }
    return HttpResponse.json(body);
  });

export const patchItemHandler = (url, responseBody, options = {}) =>
  http.patch(url, async ({ request }) => {
    options.onPatch?.(await request.json());
    return HttpResponse.json(responseBody);
  });
```

**Per test:** `server.use(getItemHandler(url, body, { status: 500 }))`, then assert with `findBy*`. **Payload assertions:** set `onPatch` to capture a variable, act, then `expect(captured).toEqual(expect.objectContaining({ … }))`.
