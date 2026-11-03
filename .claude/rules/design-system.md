---
description: Rules for implementing UI against a design system and design tokens, including designs in Figma. Token locations come from project.md.
---

# Design system

Token locations and asset directories come from **`.claude/rules/project.md`**. When a task links a Figma design, also follow the **`figma-design-extraction` skill** (`.claude/skills/figma-design-extraction/SKILL.md`).

## Implementing from a design

Fetch **exact** values from the source; never eyeball or measure them off a screenshot. For Figma, in brief:

1. Call `get_design_context` with the target `fileKey` + `nodeId`: the authoritative source for dimensions, spacing, typography, fills, radius, and effects.
2. If the response is truncated, call `get_metadata` first to get the node map, then re-fetch specific nodes.
3. Call `get_variable_defs` on the node to read the **bound design-token variables**, so each value maps to the correct token instead of a hardcoded value.
4. Call `get_screenshot` for **visual reference only**, not as a measurement or color source.
5. Download any assets from the Figma MCP localhost endpoint before starting.
6. Translate the output into **this project's stack and conventions**. MCP-generated code is reference only.
7. Validate the rendered UI against the fetched values before marking the work complete.

## Styling rules

- **Use the project's styling approach** consistently; do not introduce a second one.
- **Never hardcode** colors, font properties, spacing, radii, shadows, or breakpoint widths. Reference the design tokens.
- **Use the project's text and button primitives** rather than styling raw elements to look like them.
- **Breakpoints:** express every media query through the project's breakpoint tokens. If a design covers a width no breakpoint accounts for, add the breakpoint first.

## Never approximate a missing design value

**When a design value has no exact match in the tokens, register a new token. Never map it to the closest existing one.** This applies to colors, typography, spacing, radii, shadows, and breakpoints alike.

- ❌ "The design says 28px, the scale has 25px and 30px, so use 30px and move on."
- ❌ "The design says `#424242`, the secondary text color is `#555555`, close enough."
- ✅ Add the 28px variant or the `#424242` token to the token source, then reference it.

Approximating bakes design drift into the codebase and is effectively invisible in review: the component looks plausible while being wrong, and the next person inherits the wrong value as if it were intentional.

- In an implementation plan, the token addition is an **acceptance criterion of the task that needs it**, not a prerequisite, an open question, or a follow-up ticket.
- Do not silently widen scope: add the one value the design calls for, not a speculative family around it.
- If a value genuinely cannot be fetched (no access, truncated node), it is **blocked**. Raise it rather than estimating from a screenshot.

## Adding a token

1. Grep the token source first, and reuse an existing token rather than adding a duplicate.
2. Add the raw value to the token source with a comment naming where it came from (for Figma, the node id).
3. Expose it through the theme and any type declarations the project keeps.
4. Reference it from the component through the theme. Never inline the raw value.
5. **Name it after its role** (`cardHeading`, `overlayTitle`), not its metric (`serif28`), because a metric name goes stale the moment the design changes.

Do not maintain a parallel token list in documentation; it drifts.

## Components

- Check the shared component directories in `project.md` for an existing component before creating a new one.
- Keep a component's styles and helpers next to it when it is non-trivial.

## Icons and assets

- Use the icon library the project already uses. Do not install another one.
- If the design's icon does not exist there, export the SVG from the design source rather than approximating with a similar icon.
- Do not create placeholder assets; download them from the design source into the project's asset directory.
