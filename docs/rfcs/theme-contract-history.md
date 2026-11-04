# Theme contract history

## Context

`docs/rfcs/theme-contract.md` says what the theme contract is. This document keeps why it took that shape: what a throwaway spike changed before any theme was built, and each change made while the themes were built.

## Executive Summary

The spike ran all three prototype renderers on the draft contract and changed it in four ways.
The change log follows the rebuild's phases, called waves, each made of numbered tasks. The plan that named them was never committed, so read them as labels for the order things happened in.
Nothing here is a rule, and where this document and the contract differ, the contract is right. Section numbers below are the contract's, as it stands today.

## 3. What the spike showed

All three real prototype renderers ran from their own source, unchanged except for the adapter's text substitutions, on one page in Chromium and WebKit, at 1280 and 375 px, in a throwaway page outside the repo. A mini runtime drove them as `Scene` objects.

The measurements are in the description of the PR that added `theme-contract.md`.

**What it changed in the contract:**

1. **`resize` moved out of the `ResizeObserver` callback.** Run inside it, WebKit reported `ResizeObserver loop completed with undelivered notifications` as a page error, because scenes change the height of what is observed. Deferring it to the next frame removed the error.
2. **Showing a scene now draws immediately,** so no blank frame appears between the attribute change and the first tick.
3. **`textTime` and `textPaused` were added,** with `startStopped` kept separate from them. Verification later added the first-press rule. See section 7.
4. **`Scene.resize` gets the parent's width.** Interchange and Diorama measure the canvas and Pixel Depot its parent. They matched at both widths, except that Pixel Depot's canvas rounds down to whole pixels (1,122 against 1,124), so only the parent is a safe common measure.

**What it could not prove:** page weight on real themes, measured once they existed. Fonts were blocked throughout the spike, so canvas text ran on fallback fonts only.

## 4. Change log

- Wave 2, Task 4, breaking (changed meaning), approved by the coordinator: once a `userStopped` train is at rest, the whole scene holds, including the crowd, steam, dwell and `world.time`, where the prototype stopped only the train (section 7). The flags, control bindings and types are unchanged, so no in-flight task pauses.
- Wave 2, Task 5, additive: section 5 adds a 10-second limit on the pin, 3 settling frames, and a pin for section links opened fresh. Section 6 corrects the sentence on the stubs' placeholders. Section 5 reads the key at `popstate` on a history step, and section 4 follows the hash once more at start. `popstate` also ends a pin (section 5), and `THEME_HOOKS` adds `themeSwitcher` (section 6).
- Wave 2, Task 6, additive: off-screen, a size or colour change gets one `draw` without stepping the world (section 8). Also recorded in section 8: a scene must expect `resize` on show with an unchanged size, and what a throw from `world.update` does.
- Wave 2, Task 6, additive: the chunk rule in section 8. Scene chunks statically import only the `page` chunk, and themes must not work around it.
- Wave 3 base, additive: `showingTheme()`, `themeRootElement()` and `effectiveColorScheme()` move into `src/scene/contract.ts` (section 4). Sections 4, 6, 9 and 10 add what a theme builder needs: in-page links, image rendering, the conformance suite, what to drop when porting CSS, and type errors in a straight port.
- Wave 3 base, breaking in form, approved by the coordinator, with no theme yet affected because Tasks 7 to 9 have not started: a theme's hero holds its height when its scene starts. `data-rail-scene-frame` (`THEME_HOOKS.sceneFrame`) replaces a theme's own `container-type`, holds the controls and `<RightNow />`, and is set up by `src/layouts/global.css`. Controls keep their space with `visibility: hidden` until a scene runs, and at full width "Right now" stays out of the flow from the start (sections 5, 6 and 8).
- Wave 3 base, additive: `src/scene/scene-css-imports.test.ts` scans for CSS imports in `scene.ts`, and section 6 lists everything the conformance suite checks and maps the prototypes' heroes.
- Wave 3 base, breaking in form, approved by the coordinator, with no theme yet affected because Tasks 7 to 9 have not started: on `failed`, "Right now" returns to the flow, replacing the rule that a static hero keeps its last 3 rem clear (section 8). The label holds its widest string with `15ch` on `data-rail-label`, replacing the rule on the toggle's width. The static hero must fit its box at 320 px (section 6).
- Wave 4 base, additive: `getSiteContent()` may be called in section components as well as `Theme.astro`, and facts about Ahmad live in `src/content/` (section 6). The label rule names each theme's own `ch` value and adds `text-align: start`, since `15ch` pushed Interchange's service bar to three rows at 320 px (section 6).
- Wave 4 base, additive: `Base`'s `noindex` prop is for pages with no address of their own (section 6). A sticky header's `scroll-margin-top` clears it in fallback fonts as well as real ones (section 5). `build.cssTarget` keeps `-webkit-backdrop-filter` in the build (section 9).
- Wave 4 base, additive: `RightNow`'s `items` prop is gone, and with all stubs replaced, this document no longer describes them (sections 6, 8, 9, 10 and 11).
- Final audit, additive: section 5 pins clicked section links. Section 6 replaces hand-tuned header heights with a measurement, `--rail-header-height`, with one CSS fallback per layout. Section 8 lets a still scene skip its draw. Section 9 adds metric-matched fallback fonts and corrects what `build.cssTarget` does. The document itself stops citing the rebuild's plan, and this history moves here.
