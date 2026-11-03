---
description: Stack add-on for React projects, extending code-standards.md. List it under "Stack add-ons" in project.md; remove it for non-React projects.
---

# React add-on

Extends **`.claude/rules/code-standards.md`** for React code. Where this file and nearby code disagree, match nearby code and flag the mismatch.

## Components

- Give each component one primary responsibility. Parent components orchestrate: **parse inputs → call hooks → render**.
- Keep heavy logic out of JSX. Move repeated data or UI logic into custom hooks, colocated with the feature or shared when used across features.
- Avoid boolean props that radically change behavior (e.g. `isEditMode` driving unrelated branches); prefer separate components, composition, or a discriminated union of props.
- Declare prop types the way the project does (TypeScript types or PropTypes, if used).
- Side effects belong in `useEffect`, event handlers, or mutation callbacks.

**Component length**

| Lines      | Read as                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------- |
| **50–150** | The sweet spot: mild state, a custom hook or two, and JSX. Aim here.                        |
| **150–300** | Acceptable for complex containers or pages that orchestrate sub-components.                |
| **Over 300** | A code smell. The component is doing too much, so refactor before adding to it.           |

When a component drifts past its band, pull out styles, helpers, and hooks first. If it is still long, it has more than one responsibility, so extract sub-components.

## Styling

- Use the project's styling approach and its design tokens rather than one-off values (see **`.claude/rules/design-system.md`**).
- **Scrollable lists:** apply spacing to the individual items, not the scroll container. Padding on the container offsets the scrollbar and clips it against the content.

## Rendering and performance

- Lists need **stable `key`** values (ids, not the array index when the list can reorder).
- Use `React.memo`, `useMemo`, and `useCallback` when profiling or when a child is clearly expensive; avoid them preemptively.
- Avoid inline object or array literals in dependency arrays or props when they cause needless rerenders in hot paths.
- Include every value a memo or effect reads in its dependency array.
- Avoid `dangerouslySetInnerHTML` unless unavoidable; if used, sanitize with a vetted approach.

## Hooks

- Call hooks only at the top level of components and custom hooks, never in loops or conditions. Resolve hook values at the top and pass them into plain helpers.
