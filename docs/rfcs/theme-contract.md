# Theme contract

## Context

The site ships three train themes (Interchange, Diorama, Pixel Depot) on one static page. The engine, the page shell and all three themes are built in parallel, so they need a written boundary before any of them exists. The prototypes in `design/train-concepts/` show the boundary is close, but they were never written to share a page: each builds its own world, sets global CSS, and two of them throw at desktop widths.

The contract as code is `src/scene/contract.ts`, `src/scene/world-start.ts`, `src/themes/registry.ts` and `src/rail/types.ts`. Where this document and those files disagree, it is a bug in one of them: raise it through section 12.

Ids such as E30, C13 and Q12 are edge cases, corrections and open questions in the rebuild plan (`.claude/plans/portfolio-rebuild_plan.md`, gitignored).

## Executive Summary

One attribute on `<html>` selects the theme, and CSS alone decides what shows, so no JavaScript still gets a readable page.
One scene runtime owns one world and steps it once per frame; scenes only read it and draw, which is what lets everything carry across a switch.
Each theme plugs in through four fixed files in its own directory, so theme work never touches the page or the engine.
A throwaway spike ran all three real prototype renderers on this contract, and it changed the contract in the four ways listed in section 11.
One default awaits the user's confirmation: where the shared world starts (Q12, section 7).

## 3. Theme identity

| Theme                 | Name, and value of the selection attribute | Link hash      | Section id prefix |
| --------------------- | ------------------------------------------ | -------------- | ----------------- |
| Interchange (default) | `interchange`                              | `#interchange` | `a-`              |
| Diorama               | `diorama`                                  | `#diorama`     | `b-`              |
| Pixel Depot           | `pixel-depot`                              | `#pixel-depot` | `c-`              |

Names come from `design/train-concepts/concepts/combined.html` (line 21). Use `THEME_NAMES`, `sectionId()`, `themeHash()`, `themeFromHash()`, `THEME_BY_HASH` and `resolveThemeName()` rather than writing these out.

## 4. Selection and visibility

- **`data-rail-theme` on `<html>` selects the theme.** It is the only link between selection (Task 5) and scenes (Task 6). Task 5 writes it; the runtime only observes it.
- **`data-theme` on `<html>` stays light or dark,** as in the prototype (`shared/engine.js`, line 451). It is `light`, `dark` or absent, and absent means follow the system. Task 5 writes it.
- **Each theme's outermost element carries `data-rail-theme-root="<name>"`.** `src/layouts/global.css` shows the selected root and hides the rest with `display: none`, which also takes hidden themes out of the accessibility tree (E19).
- **No attribute, no JavaScript or an unknown name all show Interchange** (E1, E2), in the CSS and in `resolveThemeName()`, which takes bare values only.
- **Hashes go through `themeFromHash(location.hash)`.** It returns the theme named by a theme hash (`#diorama`) or a section hash (`#b-about`), so a reload keeps the theme (E5) and a shared section link selects its theme (E6). It returns null when the hash names no theme.
- **The no-flash head script gets `THEME_BY_HASH` at build time through `define:vars`.** That script must be inline and synchronous, so it cannot import `src/scene/contract.ts`. `THEME_BY_HASH` is a plain table of every theme and section hash, and `themeFromHash` is a lookup on it.
- **Storage keys** are in `STORAGE_KEYS`: `rail-selected-theme`, `rail-color-scheme`, `rail-livery`. They replace the prototype's `rail-concept` and its confusingly named `rail-theme`. Every access is guarded (E3).

## 5. Sections

The six keys are `top`, `about`, `work`, `projects`, `skills` and `contact` (`SECTION_KEYS`). Each maps to the id `<prefix><key>` in every theme, so `about` is `a-about`, `b-about` and `c-about`. Every theme has all six. `top` is the theme's `<main>`.

The contract owns the header link labels (`NAV_SECTIONS`: About, Work, Projects, Skills, Contact), because they are tied to these keys. `top` has no header link; the site mark links to it.

**Keeping the section across a switch (E30).** Task 5 does this in one synchronous step:

1. Find the outgoing theme's current key.
   - If the page has scrolled and is at its bottom (`scrollY > 0` and `scrollY + innerHeight >= scrollHeight - 1`), it is `contact`, because a short last section may never reach the viewport top.
   - Otherwise it is the last section in document order whose top is at or above the viewport top plus that section's own `scroll-margin-top` plus 1 px, or `top` if none is. The margin keeps a sticky header from walking back a section per switch, and the 1 px absorbs the fraction a scroll lands short.
2. Write the new `data-rail-theme`.
3. Scroll `sectionId(newTheme, key)` to the top of the viewport without animation. Themes with a sticky header set `scroll-margin-top` on their sections and `<main>`, because `top` is `<main>`.
4. Replace the hash with `history.replaceState`, adding no history entry and firing no `hashchange`, so a stale `#a-about` cannot bring the old theme back on reload. A section hash becomes `#<sectionId(newTheme, key)>`; anything else becomes `themeHash(newTheme)`.

**Staying there on a theme's first show.** Two things keep the section in place while the incoming theme settles:

- **Reservation.** The incoming theme's hero must already hold the scene's height (section 6) and its lazy images must have `width` and `height`.
- **Re-pinning.** Reservation cannot cover everything: controls appear, the HTML line leaves the flow on `board`, and fonts swap late. So after step 4, Task 5 repeats step 3 with the same key whenever the incoming root's `data-scene-state` changes (a `MutationObserver` runs this before the next paint) and whenever `loadedFontFaceCount()`, sampled each frame, goes up. The pin ends at the visitor's first wheel, touch move, pointer press or key press of any kind, at any `hashchange`, and at the next switch. It never ends on a `scroll` event, since its own scrolls fire those too.

## 6. What a theme provides

A theme lives in `src/themes/<name>/` and has four fixed entry points. `src/themes/registry.ts` imports `meta.ts` and `scene.ts`, the page imports `Theme.astro`, and `Theme.astro` imports `tokens.css`, so a theme task changes only its own directory.

| File          | Exports                                                 | Loaded                          |
| ------------- | ------------------------------------------------------- | ------------------------------- |
| `Theme.astro` | The static part, as a component with no props           | Build time                      |
| `meta.ts`     | `meta: ThemeMeta` (label, description, font stylesheet) | With the page                   |
| `scene.ts`    | `createScene: CreateScene`                              | On first show, as its own chunk |
| `tokens.css`  | Custom properties and `color-scheme`, nothing else      | Imported by `Theme.astro`       |

`tokens.css` is separate so another page can take a theme's look without its layout: the 404 page (Task 12) imports all three and sets the saved theme's name on an element's `data-rail-theme-root` and on `data-rail-theme` on `<html>`, because the global CSS hides any root that is not selected. Each file sets at least `--bg`, `--ink`, `--muted` and the `--dd-*` tokens under `[data-rail-theme-root="<name>"]`, in light and dark. Other CSS, such as the stubs' `theme.css`, is the theme's own choice.

**The static part must:**

- Have `data-rail-theme-root="<name>"` on its outermost element, and all six section ids.
- Have one element with `data-rail-hero` and `tabindex="-1"` holding the canvas, controls and "Right now".
- Have one `<canvas data-rail-canvas role="img" aria-label="…">`, whose parent is a block element with no horizontal padding that does not take its width from the canvas. The runtime reads that parent's `clientWidth`. Before any scene loads (section 5), the parent reserves the height the scene will draw at, compact and full, with `aspect-ratio`. It switches between the two with a container query at `COMPACT_SCENE_WIDTH` (600 px, repeated by hand because CSS cannot import it). `container-type: inline-size` goes on the canvas parent's parent, and the canvas parent fills that element's content box, so the query measures exactly what the runtime reads. Not the hero and not the viewport: a padded hero or a max-width wrapper makes those wider than the scene, and the CSS would reserve full height while the scene draws compact.
- Have one `data-rail-static` element inside that parent: what shows when no scene runs (no JavaScript, or a failed load). It fills the reserved box.
- Put its controls in one `data-rail-controls` element, using the prototype's hooks: `data-rail-toggle` with a `data-rail-label` inside, `data-rail-speed="<index>"` for each of `SPEEDS`, and `data-rail-livery="<id>"` for each of `LIVERY_ORDER`, named by `LIVERY_LABELS`. Task 6 binds them and writes their state (below).
- Render `src/components/RightNow.astro` inside the hero. Theme CSS may style its `.now`, `.now__label`, `.now__k` and `.now__v` classes.
- Render `src/components/ThemeSwitcher.astro` with `current="<name>"` in its header. Task 10 replaces the placeholder behind the same props.
- Use the page-helper hooks that Task 5 binds: `data-theme-toggle`, `data-copy` with `data-copy-label`, `data-copy-target`, `data-cv`, `data-year`.

**Control state.** Task 6 writes these attributes, on every theme's controls so a hidden theme is right when shown, and theme CSS styles from them. The prototype stylesheets use `[data-state="stop"]` on the toggle and `[aria-pressed="true"]` on speed and livery buttons.

| Element            | Task 6 writes                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `data-rail-toggle` | `data-state`, `aria-pressed`, `aria-label` and the `data-rail-label` text, from the table in section 7 |
| `data-rail-speed`  | `aria-pressed="true"` on the button for `speedIndex`, and on none while `userStopped`                  |
| `data-rail-livery` | `aria-pressed="true"` on the button for `liveryId`                                                     |

Task 5 writes `aria-pressed` and `aria-label` on `data-theme-toggle`: pressed means dark.

**Content.** All content comes from `getSiteContent()` in `src/content/site.ts`, called in `Theme.astro`'s frontmatter. Do not call `getCollection` directly: the integrity checks for empty collections, `order` and the PNG portrait run only through that call. Nothing passes content down as props, so the page never changes when a theme does.

**Images.** Use `loading="lazy"`, so a hidden theme's images do not load, with `width` and `height`, so they cannot move the page when they arrive. `profile.portraitPixels` comes back as plain `{ url, width, height }`: render it with a plain `<img>` and `image-rendering: pixelated`, and never through Astro's `<Image>`, which would resize or re-encode it (E23).

**The stubs** use placeholder "Right now" items because `getSiteContent()` is not on their branch. Tasks 7 to 9 replace them.

## 7. The shared world

| Question                     | Answer                                                                                                                                                                                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who creates it               | The scene runtime, once, at start                                                                                                                                                                                                                                                                  |
| Who steps it                 | The scene runtime, once per frame, and only while a scene is running. Nothing else ever holds `update`                                                                                                                                                                                             |
| What scenes may read         | `WorldView`: only what the prototype renderers read. Letters, bridge, tunnels, portals, stations, cars, people, puffs, livery and clocks. The route, speed and stop state are not in it                                                                                                            |
| What scenes may change       | Nothing. `SceneContext.world` is a `WorldView`, which has no control methods                                                                                                                                                                                                                       |
| How the world changes        | Controls in the theme's markup, which Task 6 binds to `toggleStop`, `setSpeed` and `setLivery`. Task 6 reads `speedIndex`, `userStopped` and `textPaused` from `World` and re-syncs the controls after each call. There is no change event, because only these calls change what the controls show |
| How the train is hit-tested  | `Scene.hitTrain`, per theme. `WorldView.hitTrain` is a readonly property, so replacing it as `concepts/b/render.js` (line 427) does fails to compile                                                                                                                                               |
| What carries across a switch | Everything, because nothing is per theme: position, stop state, speed and livery are one object. The current section is kept by section 5                                                                                                                                                          |

**Q12: where the world starts.** The prototypes differ (seeds 11, 23, 31; liveries metro, steam, toy). Work proceeds on this default, and the user confirms it on return. `WORLD_START` in `src/scene/world-start.ts` holds the planner's recommendation and is the one place to change: one seed (11, the default theme's), a saved livery wins, otherwise a first visit gets the default livery of the theme shown first. An invalid saved livery counts as no saved livery (E16).

**Text clock (E18, Q4).** Billboard text rolls on `world.textTime`, never `world.time`, and has no reduced-motion branch anywhere. Text rolls for everyone until a visitor pauses it.

`userStopped` and `textPaused` give three reachable states. A reduced-motion visitor starts in the second, with the scene still and the text rolling. Their first press pauses the text and does not start the train, so pausing never requires adding motion.

**What `userStopped` means.** The scene goes still when the train comes to rest, not at the press. A moving train brakes for up to about 2.75 s from the top speed, and everything runs as normal until it stops. From then on the crowd, the steam, any dwell at a station and `world.time` all hold, so a scene that animates from `world.time` freezes with no code of its own. A reduced-motion start is already at rest, so it is still from the first frame. `world.textTime` obeys `textPaused` alone, so a press pauses text at once. If a braking train reaches a station, passengers start getting on and off as usual on that frame, then hold where they are. Starting again resumes exactly where things left off, with no jump. A livery change still applies at once. A livery change at rest leaves any steam already in the air where it is until the train restarts.

| State                  | `userStopped` | `textPaused` | Scene              | Text   | `data-state` | `aria-pressed` | Label           | Press gives |
| ---------------------- | ------------- | ------------ | ------------------ | ------ | ------------ | -------------- | --------------- | ----------- |
| Running (normal start) | false         | false        | Runs               | Rolls  | `go`         | `false`        | Stop the train  | Stopped     |
| Reduced-motion start   | true          | false        | Still              | Rolls  | `stop`       | `false`        | Pause the text  | Stopped     |
| Stopped                | true          | true         | Still once at rest | Paused | `stop`       | `true`         | Start the train | Running     |

- **`createWorld`:** `startStopped: true` gives the reduced-motion start, and false gives running. The world is never in the reduced-motion start again after leaving it.
- **Compact widths are the one exception, and it lives in Task 6's binding, not the engine.** When `size.compact` is true on a reduced-motion start, nothing moves, so "Pause the text" would have nothing to pause. The control shows `data-state="stop"`, `aria-pressed="true"` and "Start the train", and a press calls `toggleStop(false)`, giving Running. Wide widths keep the table. If the width changes in this state, the control follows the current width.
- **`toggleStop(force?)`:** sets both flags to `force ?? !textPaused`. The press on the train and the Space key go through the same binding as the control.
- **`setSpeed(index)`:** clears both flags, because choosing a speed asks for motion.
- **`userStopped: false` with `textPaused: true`** cannot happen.

## 8. Scene lifecycle

`scene.ts` exports `createScene(context)`, returning a `Scene`. Types are in `src/scene/contract.ts`. The runtime's only entry point is `startSceneRuntime()` from `src/scene/runtime.ts`, called by the page.

| Method                     | When the runtime calls it                                                                                                                                                                 | The scene must                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `createScene`              | First time the theme is shown                                                                                                                                                             | Not assume a size. Hold no timers or observers of its own                                                                  |
| `resize(size)`             | On being shown, and at the start of the next frame after a size change. Never while hidden or at zero width                                                                               | Set the canvas's attributes and style. `size.width` is the parent's `clientWidth`; `size.compact` means skip the billboard |
| `draw()`                   | Once right after being shown, then once per frame while running                                                                                                                           | Draw, animating from `world.time`. Never change the world                                                                  |
| `hitTrain(point, radius)`  | On pointer move (`HIT_RADIUS.hover`, 16) and click (`HIT_RADIUS.click`, 20). `point` is canvas-relative CSS pixels; `radius` is world units, as in `shared/engine.js` (lines 403 and 408) | Convert the point with its own projection and compare in world units                                                       |
| `applyColorScheme(scheme)` | Always before the first `draw`, on being shown if the scheme changed, and on any change while showing                                                                                     | Re-read tokens with `readToken`. Values are already correct, so no deferred read is needed                                 |
| `onFontsReady()`           | At the next frame after `loadedFontFaceCount()` rises while showing, and on being shown if it rose while hidden. Not for fonts loaded before `createScene`                                | Drop any cached text measurement (E15)                                                                                     |

**Rules the runtime keeps:**

- **It runs only the showing scene.** Others are kept, paused and undrawn. Nothing is torn down.
- **One rule decides running:** a loaded scene for the selected theme, canvas on screen, and tab visible. There is no separate flag for any of the three, which is what fixes E10.
- **Last selection wins** (E11). A late import of a theme that is no longer selected starts nothing.
- **It samples fonts rather than listening.** `loadingdone` never fired in Playwright's WebKit, and `document.fonts.ready` resolved before the font loaded. A count of loaded faces rose in both browsers, stayed flat for a 404, and cannot be missed by a pause, as a `document.fonts.status` change could.
- **`resize` never runs inside the `ResizeObserver` callback,** only at the start of the next frame.
- **Showing a scene is one task:** resize, colours, then `draw`, so no blank frame appears.

**`data-scene-state` on the theme root** is written by the runtime only. Absent means never started.

| Value                 | Meaning                          | What shows                          |
| --------------------- | -------------------------------- | ----------------------------------- |
| absent or `loading`   | No scene yet                     | Static hero, no canvas, no controls |
| `running` or `paused` | Scene loaded                     | Canvas and controls, no static hero |
| `failed`              | Import or any scene method threw | Static hero, no canvas, no controls |

`paused` means loaded but not selected. A selected theme whose canvas is off-screen or whose tab is hidden stays `running`, and only its loop stops ticking, so scrolling never rewrites this attribute.

**Failure (E12).** A rejected import or a throw from any scene method counts as a failed load. The runtime logs it, forgets the scene and sets `failed`. Selecting another theme and coming back retries. The spike saw that retry succeed in Chromium and WebKit after a failed import.

**`data-now` on the hero** has one rule, in the runtime, for all three themes: `board` when a scene is loaded and `size.compact` is false, otherwise `html`. Absent (no JavaScript) behaves like `html`. Motion preferences play no part. `src/layouts/global.css` visually hides the HTML line on `board`, and screen readers keep it.

## 9. Tokens, CSS and fonts

- **Every theme rule sits under `[data-rail-theme-root="<name>"]`,** including what the prototypes put on `:root`, `html`, `body` and `*` (C9). `design/train-concepts/scope_css.py` shows the mapping. This covers tokens too, so scenes read them with `readToken`, from the theme root.
- **How to scope is the theme's choice.** The stubs wrap `tokens.css` and `theme.css` each in a nested rule (Baseline since 2023), which the build leaves as is.
- **Dark rules** go in two places, as in the prototypes: `:root[data-theme="dark"] &` and `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) & }`.
- **The theme root carries the page background and `color-scheme`.**
- **Each theme sets `--dd-bg`, `--dd-fg`, `--dd-muted` and `--dd-line`,** which the switcher reads.
- **Shared tokens and global CSS** live in `src/layouts/`. All themes' CSS loads on every visit (C8) and counts toward the budget.
- **Canvas colours come from tokens,** not literals, so a scheme change reaches them.
- **Fonts.** Each theme names one Google Fonts stylesheet in `meta.fontStylesheet`, and Task 5 requests it only when that theme is shown. Self-host only a font with no Google match. Canvas text must stay legible with fallback fonts (E15).

## 10. Engine API

`src/rail/index.ts` is the only import path for the engine. `src/rail/types.ts` holds its types and names no DOM type.

| Export                                       | Notes                                                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createWorld(options)`                       | `seed`, `livery` and `startStopped` are all required. Returns `World`                                                                                   |
| `sample(segment, step?)`                     | Only above-ground segments, so no null points. Each point carries `seg`, so `elevationAt` works on it; readonly, so Diorama keeps its own `{ ...p, z }` |
| `marquee(canvas, text, options)`             | Options object `{ x, baseline, width, time, speed }`, not the prototype's positional numbers. No reduced-motion branch (C10)                            |
| `marqueeSegments(canvas, segments, options)` | New (C13). Options object                                                                                                                               |
| `nowCycle(time, count, period?)`             | Returns `{ index, alpha }`, not the prototype's `{ i, a }`. No reduced-motion branch                                                                    |
| `DEFAULT_LIVERY`, `isLiveryId`               |                                                                                                                                                         |
| `LIVERY_ORDER`, `LIVERY_LABELS`              | From `shared/content.py` (lines 137–138): control order and names                                                                                       |
| `SPEEDS`, `TAU`                              | `SPEEDS` lets a theme render its speed buttons at build time                                                                                            |

**These shapes win over the prototype's,** so Tasks 4 and 7 to 9 follow this section and `src/rail/types.ts`:

- **`marqueeSegments` drops its last argument.** It is `0` at both call sites and no definition of it exists anywhere in the repo.
- **The theme tasks pass `world.textTime`** where the prototypes pass `world.time`.

**Where every prototype helper goes:**

| Prototype                                                                                                                             | Goes to                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `createWorld`, `sample`, `TAU`, `marquee`, `nowCycle`                                                                                 | Engine API (Task 4)                                                                                 |
| Route, station, passenger and PRNG internals of `shared/engine.js`, and `LIVERIES`, `head`, `v`, `mode`, `dwell`, `total`, `capacity` | Task 4, private to `src/rail/`                                                                      |
| `onChange` and its `emit` calls                                                                                                       | Not ported. Nothing outside the control sync used them, and Task 6 re-syncs after each control call |
| `tick` frame counter in `concepts/c/render.js` (line 346)                                                                             | Task 9, from `world.time`                                                                           |
| `marqueeSegments` (undefined in the prototype)                                                                                        | Engine API (Task 4)                                                                                 |
| `bindControls`, `bindCanvasInput`, `runLoop`                                                                                          | Task 6                                                                                              |
| `cssVar`                                                                                                                              | Task 6, as `SceneContext.readToken`                                                                 |
| `nowItems`                                                                                                                            | Task 6, as `SceneContext.nowItems`                                                                  |
| `nowText`                                                                                                                             | Task 6 leaves it out: no renderer calls it                                                          |
| `reduceMotion` (not exported, read at `concepts/a/render.js` line 227)                                                                | Task 6 reads the preference once, for `startStopped`. Nothing else may read it                      |
| `bindTheme`                                                                                                                           | Task 5, which writes `data-theme`. Scenes hear of changes through `applyColorScheme`                |
| `bindPageHelpers`                                                                                                                     | Task 5, without the prototype viewer's `window.claude` download branch                              |
| `dataset.now` writes in renderers                                                                                                     | Task 6, one rule (section 8)                                                                        |
| Saving the livery                                                                                                                     | Task 6, in the control binding                                                                      |
| `hitTrain` radii 16 and 20 in `bindCanvasInput`                                                                                       | `HIT_RADIUS`, used by Task 6                                                                        |

**Stubs and who replaces them:**

| Stub                                                                 | Replaced by                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/rail/stub.ts`                                                   | Task 4                                                                         |
| `src/scene/runtime.ts`                                               | Task 6. It has no controls, pointer or keyboard input, or off-screen pause yet |
| `src/themes/interchange/{Theme.astro,scene.ts,tokens.css,theme.css}` | Task 7                                                                         |
| `src/themes/diorama/{Theme.astro,scene.ts,tokens.css,theme.css}`     | Task 8                                                                         |
| `src/themes/pixel-depot/{Theme.astro,scene.ts,tokens.css,theme.css}` | Task 9                                                                         |
| `src/components/ThemeSwitcher.astro`                                 | Task 10                                                                        |

## 11. What the spike showed

All three real prototype renderers ran from their own source, unchanged except for the adapter's text substitutions, on one page in Chromium and WebKit, at 1280 and 375 px, in a throwaway page outside the repo. A mini runtime drove them as `Scene` objects.

The measurements are in the description of the PR that added this document.

**What it changed in the contract:**

1. **`resize` moved out of the `ResizeObserver` callback.** Run inside it, WebKit reported `ResizeObserver loop completed with undelivered notifications` as a page error, because scenes change the height of what is observed. Deferring it to the next frame removed the error.
2. **Showing a scene now draws immediately,** so no blank frame appears between the attribute change and the first tick.
3. **`textTime` and `textPaused` were added,** with `startStopped` kept separate from them. Verification later added the first-press rule. See section 7.
4. **`Scene.resize` gets the parent's width.** Interchange and Diorama measure the canvas and Pixel Depot its parent. They matched at both widths, except that Pixel Depot's canvas rounds down to whole pixels (1,122 against 1,124), so only the parent is a safe common measure.

**What it could not prove:** no-flash and no-JavaScript in Astro, chunk splitting and page weight on real themes. Tasks 5, 6 and 13 cover those. The skeleton in this PR does show no-JavaScript, lazy chunks and last-selection-wins on stubs. Fonts were blocked throughout, so E15 ran on fallback fonts only. Interchange and Diorama measure text every frame, so they should pick up a late font, but that was not run.

## 12. Changing this contract

The agent that finds a gap stops work on that seam, reports it, and does not work around it locally. The orchestrator dispatches one small branch from the wave's base, and it merges into that base first (local `git merge`, pushed).

- **Additive** (a new optional hook or field): updates contract and stubs. No pause; other tasks merge the base in when convenient.
- **Breaking** (rename, removal, changed meaning): the coordinator approves it and reports it in the wave summary. Affected in-flight tasks pause, the change updates contract, types, stubs and the conformance suite together, and they merge the base in before continuing.
- Each change adds a line to the change log below. A second breaking change in one wave stops the wave for a code review of the whole contract, with the outcome in the wave summary.
- Bugs in `src/scene/` or `src/rail/` found in Wave 3 go the same way, since nobody owns those paths in that wave.

### Change log

- Wave 2, Task 4, breaking (changed meaning), approved by the coordinator: once a `userStopped` train is at rest, the whole scene holds, including the crowd, steam, dwell and `world.time`, where the prototype stopped only the train (section 7). The flags, control bindings and types are unchanged, so no in-flight task pauses.
