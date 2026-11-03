---
name: figma-design-extraction
description: Mandatory workflow for grounding UI work in EXACT Figma values fetched from nodes and variables via the Figma MCP—never eyeballed or measured off a screenshot. Use when planning UI tasks from a Figma link and when verifying an implementation against a design. Pull spacing, color, typography, radius, borders, and effects from get_design_context + get_variable_defs, map each to a theme token, and treat get_screenshot as a visual cross-check only. Prevents drift between Figma and the shipped UI.
---

# Figma Design Extraction (exact values, not guesses)

Screenshots lie about numbers. A 14 px label looks like 16 px, `#F7FAFF` looks like white, a 12 px gap looks like 16 px. **Eyeballing a screenshot is the root cause of Figma↔implementation drift.** This skill mandates fetching the **actual** values from Figma nodes and variables via the MCP, so every spacing, color, font, and radius in the plan or the verification report traces to a real Figma value—not an approximation.

## Core rule

> **Fetch the value. Never guess it.** Any numeric or token-level design decision (size, spacing, color, font, weight, line-height, radius, border, shadow) must come from `get_design_context` / `get_variable_defs` on the node—not from reading a `get_screenshot` image. Screenshots are for **visual cross-check only** (does the composed result look right), never for measurement or color-picking.

If a value cannot be fetched (MCP truncates, node missing, no access), **flag it as blocked / open question**—do not fill the gap by estimating from the picture.

## When to use

| Phase         | Use it to…                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Planning**  | Ground each UI task's acceptance criteria in exact values + the theme tokens they map to (see planning skill **§1b**). |
| **Building**  | Read exact values before writing styles; map to design tokens per `@.claude/rules/design-system.md`.                   |
| **Verifying** | Compare each implemented value against the fetched Figma value; report concrete mismatches, not "looks close."         |

## Extraction workflow

1. **Resolve `fileKey` + `nodeId` from the URL.**
   - `figma.com/design/<fileKey>/…?node-id=12-34` → `fileKey` = the path segment; `nodeId` = `12:34` (**convert hyphens to colons**).
   - Branch URL `…/branch/<branchKey>/…` → use the **branch key** as `fileKey`.
   - `figma.com/make/<makeFileKey>/…` → use `makeFileKey`; prefer `get_design_context`; **do not** call `get_metadata`.
   - `figma.com/board/…` (FigJam) → use `get_figjam`.
2. **Map the tree if the node is unknown or the response truncates.** Call `get_metadata` on the page or a parent node (e.g. `0:1`) to get the node map, pick the precise child `nodeId`s, then re-fetch. (Skip `get_metadata` for Figma Make files.)
3. **`get_design_context`** on the target node → the authoritative layout + style values: dimensions, auto-layout padding/gap/direction, fills, strokes, corner radius, typography, and effects. This is your **measurement source**.
4. **`get_variable_defs`** on the same node → the **bound design-token variables** (e.g. a fill bound to `color/bg/accordion-header`, spacing bound to `space/200`). This is what lets you map a raw value to the **right theme token** instead of hardcoding a hex/px. Always run it before deciding "this is `theme.palette.X`".
5. **`get_screenshot`** last → visual reference of the exact variant, to sanity-check that the numbers you pulled compose into the design you expect. **Not** a value source.
6. **Download assets** (icons, images) from the Figma MCP localhost endpoint; use them directly per `@.claude/rules/design-system.md` **Asset/Icon Rules**—do not substitute look-alikes.

## What to extract (checklist)

For each node in scope, capture the **exact** value for every property that applies:

| Property                                                   | From                                       | Map to (theme)                                                             |
| ---------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| Width / height / constraints                               | `get_design_context`                       | layout / breakpoints; note fixed vs fill/hug                               |
| Padding / gap / margin                                     | `get_design_context` (auto-layout)         | spacing token (confirm the grid, don't assume it)                          |
| Fill / text / border color                                 | `get_variable_defs` → `get_design_context` | color token via the bound variable; new token → follow the rule workflow   |
| Font family / size / weight / line-height / letter-spacing | `get_design_context`                       | typography token / variant (never one-off font props)                      |
| Corner radius                                              | `get_design_context`                       | radius token                                                               |
| Stroke width / style                                       | `get_design_context`                       | border token                                                               |
| Shadows / blur / effects                                   | `get_design_context`                       | shadow token                                                               |
| States (hover/active/focus/disabled)                       | the corresponding variant node             | each state's own fetched values                                            |
| Responsive variants                                        | the frame per breakpoint                   | the project's breakpoint tokens — one named band per frame width           |
| Icons / images                                             | Figma MCP localhost asset                  | download to the project's asset directory (`project.md`)                   |

## Map to tokens — never hardcode

- A value with a **bound Figma variable** (from `get_variable_defs`) maps to the matching design token. Match by the variable's semantic name, not by eyeballing the hex.
- A **raw value with no bound variable** that must become a token → follow `@.claude/rules/design-system.md` **"Never approximate a missing design value"**: register it in the token source, then reference it.
- Never write a raw hex/px/font value into a component or style file. See the hard rules in `design-system.md`.

## Output — the extracted-values table

Emit a table others can act on and audit. Include the **node id** so anyone can reopen the exact source.

```markdown
### Figma values — <component / frame name> (`fileKey` node `12:34`)

| Property    | Figma value           | Bound variable            | Theme token / target                 |
| ----------- | --------------------- | ------------------------- | ------------------------------------ |
| Header bg   | #F7FAFF               | color/bg/accordion-header | palette.bgAccordionHeader            |
| Row padding | 12px 16px             | space/150, space/200      | spacing(1.5) / spacing(2)            |
| Title       | Inter 16/24 600       | text/heading/sm           | typography variant `…`               |
| Radius      | 8px                   | radius/md                 | radius.md                            |
| Hover bg    | #EEF4FF               | color/bg/accordion-hover  | palette.bgAccordionHeaderHover       |

Unresolved (blocked, not guessed): <property> — <why> (e.g. node truncated / no MCP access)
```

- **Planning:** embed this table (or the token mappings) in the relevant task's acceptance criteria so the builder implements against numbers, not vibes.
- **Verifying:** fetch the same table from Figma, then compare it to the implemented styles / rendered UI; any row that differs is a **fail** with the specific mismatch. Pair with the live render check in the **browser-verification** skill.

## Guardrails / anti-patterns

- ❌ Measuring spacing or font size off a `get_screenshot` image. ✅ Read it from `get_design_context`.
- ❌ Color-picking a hex from a screenshot. ✅ Read the fill + its bound variable from `get_variable_defs`.
- ❌ Assuming the 8px grid / a radius / a weight because it "looks standard." ✅ Confirm the fetched value.
- ❌ Hardcoding the fetched hex/px into a component. ✅ Map to a design token (add one if missing).
- ❌ Silently approximating an unfetchable value. ✅ List it under **Unresolved** and raise an open question / block.
- ❌ Skipping `get_variable_defs` and mapping a raw hex to "the closest palette color." ✅ Let the bound variable name pick the token.
