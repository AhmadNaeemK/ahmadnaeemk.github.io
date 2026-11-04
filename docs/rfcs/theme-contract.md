# Theme contract

## Context

The site ships three train themes (Interchange, Diorama, Pixel Depot) on one static page. The engine, the page shell and all three themes were built in parallel, so this written boundary came before any of them. The prototypes in `design/train-concepts/` show the boundary is close, but they were never written to share a page: each builds its own world, sets global CSS, and two of them throw at desktop widths.

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
- **Hashes go through `themeFromHash(location.hash)`.** It returns the theme named by a theme hash (`#diorama`) or a section hash (`#b-about`), so a reload keeps the theme (E5) and a shared section link selects its theme (E6). It returns null when the hash names no theme. Task 5 follows the hash once more when its module starts, in case a link was clicked before the module ran.
- **The no-flash head script gets `THEME_BY_HASH` at build time through `define:vars`.** That script must be inline and synchronous, so it cannot import `src/scene/contract.ts`. `THEME_BY_HASH` is a plain table of every theme and section hash, and `themeFromHash` is a lookup on it.
- **A hash naming no theme falls back to the saved or default theme.** So a link to `#main` flips a theme that was chosen by link. Every in-page link points at a section id from `sectionId()`, including a skip link, which targets `sectionId(theme, "top")`. Any other id in a theme also carries its prefix, because all three themes share one page, but a link to it would still flip the theme.
- **One source for shared reads.** `showingTheme()`, `themeRootElement()` and `effectiveColorScheme()` in `src/scene/contract.ts` are the only reads of the selected theme, a theme's root and the scheme in effect, so do not write copies. On another page, importing them carries the cost in section 8's "Other pages". Storage guards and the inline head script stay separate on purpose: a theme module has a session fallback and the head script cannot import.
- **Storage keys** are in `STORAGE_KEYS`: `rail-selected-theme`, `rail-color-scheme`, `rail-livery`. They replace the prototype's `rail-concept` and its confusingly named `rail-theme`. Every access is guarded (E3).

## 5. Sections

The six keys are `top`, `about`, `work`, `projects`, `skills` and `contact` (`SECTION_KEYS`). Each maps to the id `<prefix><key>` in every theme, so `about` is `a-about`, `b-about` and `c-about`. Every theme has all six. `top` is the theme's `<main>`.

The contract owns the header link labels (`NAV_SECTIONS`: About, Work, Projects, Skills, Contact), because they are tied to these keys. `top` has no header link; the site mark links to it.

**Keeping the section across a switch (E30).** Task 5 does this in one synchronous step:

1. Find the outgoing theme's current key. On a history step, read it at `popstate`: WebKit restores the scroll before `hashchange`, to a position saved for the other theme.
   - If the page has scrolled and is at its bottom (`scrollY > 0` and `scrollY + innerHeight >= scrollHeight - 1`), it is `contact`, because a short last section may never reach the viewport top.
   - Otherwise it is the last section in document order whose top is at or above the viewport top plus that section's own `scroll-margin-top` plus 1 px, or `top` if none is. The margin keeps a sticky header from walking back a section per switch, and the 1 px absorbs the fraction a scroll lands short.
2. Write the new `data-rail-theme`.
3. Scroll `sectionId(newTheme, key)` to the top of the viewport without animation. Themes with a sticky header set `scroll-margin-top` on their sections and `<main>`, because `top` is `<main>`. The margin has to clear the header with the theme's real fonts and with fallback fonts, which are often wider and wrap the header at different widths. Too high only adds a gap above the section, so take the taller result. A section's own top padding may cover the difference, as long as the heading stays clear.
4. Replace the hash with `history.replaceState`, adding no history entry and firing no `hashchange`, so a stale `#a-about` cannot bring the old theme back on reload. A section hash becomes `#<sectionId(newTheme, key)>`; anything else becomes `themeHash(newTheme)`.

**Staying there on a theme's first show.** Two things keep the section in place while the incoming theme settles:

- **Reservation.** A theme's whole `data-rail-hero` holds its height when the scene starts, on a switch and on a plain first load, by following section 6. Its lazy images must have `width` and `height`.
- **Re-pinning.** Reservation cannot cover late font swaps or a failed load. So after step 4, Task 5 repeats step 3 with the same key whenever the incoming root's `data-scene-state` changes (a `MutationObserver` runs this before the next paint) and whenever `loadedFontFaceCount()`, sampled each frame, goes up. The pin ends at the visitor's first wheel, touch move, pointer press or key press of any kind, at any `hashchange` or `popstate` (a step between entries with the same hash fires only `popstate`), at the next switch, and 10 seconds after it started, so it does not sample fonts forever with no input. It never ends on a `scroll` event, since its own scrolls fire those too.
- **Settling.** For the first 3 frames of a pin, Task 5 repeats step 3 unconditionally. A smooth scroll from a section link survives the switch's instant scroll in Chromium and carries the page away from the section, and it cannot be stopped synchronously before step 1. One frame was enough in every run; the other two are margin.
- **Section links on load.** A section link opened fresh (navigation type `navigate`) is a first show too, so Task 5 pins that section from page start, under the same rules. A reload or a history step is not pinned, because the browser restores the visitor's own scroll position.

## 6. What a theme provides

A theme lives in `src/themes/<name>/` and has four fixed entry points. `src/themes/registry.ts` imports `meta.ts` and `scene.ts`, the page imports `Theme.astro`, and `Theme.astro` imports `tokens.css`, so a theme task changes only its own directory.

| File          | Exports                                                 | Loaded                          |
| ------------- | ------------------------------------------------------- | ------------------------------- |
| `Theme.astro` | The static part, as a component with no props           | Build time                      |
| `meta.ts`     | `meta: ThemeMeta` (label, description, font stylesheet) | With the page                   |
| `scene.ts`    | `createScene: CreateScene`                              | On first show, as its own chunk |
| `tokens.css`  | Custom properties and `color-scheme`, nothing else      | Imported by `Theme.astro`       |

`tokens.css` is separate so another page can take a theme's look without its layout: the 404 page imports all three and sets the saved theme's name on an element's `data-rail-theme-root` and on `data-rail-theme` on `<html>`, because the global CSS hides any root that is not selected. Each file sets at least `--bg`, `--ink`, `--muted` and the `--dd-*` tokens under `[data-rail-theme-root="<name>"]`, in light and dark. Other CSS, such as each theme's `theme.css`, is the theme's own choice.

**Other pages.** A page with no address of its own, such as the 404 page, passes `noindex` to `Base`. It then gets `<meta name="robots" content="noindex">` and no canonical link or `og:url`.

**The static part must:**

- Have `data-rail-theme-root="<name>"` on its outermost element, and all six section ids.
- Have one element with `data-rail-hero` and `tabindex="-1"`, holding one `data-rail-scene-frame` element at any depth. The frame holds the canvas parent, the controls below it, and `<RightNow />` as a direct child. Only `.now` is bound by selector (`[data-rail-scene-frame] > .now`), so the others may nest. The controls must sit below the canvas parent: at full width the line overlays the frame's bottom edge while the scene loads, so without a controls slot there it lands on the static hero. `src/layouts/global.css` makes the frame a size container named `rail-scene` and the line's positioning parent, so a theme sets neither `position` nor its own `container-type` on it.
- Have one `<canvas data-rail-canvas role="img" aria-label="…">`, with `display: block`, whose parent is a block element, not a flex container, with no horizontal padding that fills the frame's content box. A flex parent would shrink the static hero, so a canvas narrower than its parent centres with `margin-inline: auto`. The runtime reads that parent's `clientWidth`, so the frame's size queries measure exactly the same width. Before any scene loads, the parent reserves the height the scene will draw at, compact and full, with `aspect-ratio` and a container query at `COMPACT_SCENE_WIDTH` (600 px, repeated by hand because CSS cannot import it). Never a viewport query: a padded hero or a max-width wrapper makes the viewport wider than the scene, and the CSS would reserve full height while the scene draws compact. A canvas that snaps to whole pixels, as Pixel Depot's does (Task 9), can outgrow that reservation by up to its pixel size, so its parent also sets `overflow: hidden`.
- Have one `data-rail-static` element inside that parent: what shows when no scene runs (no JavaScript, or a failed load). It fills the reserved box and must fit it without clipping at 320 px, where the box is about 90 px tall. A taller one grows the parent and moves the hero when the scene starts, and `overflow: hidden` on the parent would cut its text off while passing every check, so shorten the content instead.
- Put its controls in one `data-rail-controls` element in the frame, using the prototype's hooks: `data-rail-toggle` with a `data-rail-label` inside, `data-rail-speed="<index>"` for each of `SPEEDS`, and `data-rail-livery="<id>"` for each of `LIVERY_ORDER`, named by `LIVERY_LABELS`. Task 6 binds them and writes their state (below). Task 6 rewrites the toggle's label, so the label holds the width of the widest of its three strings in the theme's own font, or a press can rewrap the controls and move the page. Which string is widest depends on the font, and an icon and gap sit beside the label, so size the label and not the toggle: `[data-rail-label] { display: inline-block; min-inline-size: <n>ch; text-align: start; }`. A button centres its text, so without `text-align` the gap to the icon changes with the string. Diorama and Pixel Depot use `15ch`. Interchange uses `12ch`, because `15ch` pushed its service bar to three rows at 320 px. Measure a theme's own value, since `ch` differs by font; expect a toggle wider than the prototype's.
- Render `<RightNow />` from `src/components/RightNow.astro` as a direct child of the frame. It takes no props and reads `getSiteContent()` itself. Theme CSS may style its `.now`, `.now__label`, `.now__k` and `.now__v` classes, but not its position: at full width the line is out of the flow from the start, overlaying the frame's bottom edge until the billboard takes over, and it returns to the flow on `failed`.
- Render `src/components/ThemeSwitcher.astro` with `current="<name>"` in its header. It keeps `data-theme-switcher` (`THEME_HOOKS.themeSwitcher`) on its outer element: after a switch, focus goes to its `[aria-current="true"]` element, or otherwise its first `a` or `button`, so one of those must be focusable while the switcher is closed.
- Use the page-helper hooks that Task 5 binds: `data-theme-toggle`, `data-copy` with `data-copy-label`, `data-copy-target`, `data-cv`, `data-year`.

**Porting the prototypes' heroes.** Check the ratios against each `render.js` if a view changes.

| Theme       | Frame     | Canvas parent                                                                         | Reserved ratio, full and compact |
| ----------- | --------- | ------------------------------------------------------------------------------------- | -------------------------------- |
| Interchange | `.map`    | A new wrapper around the canvas                                                       | `768 / 300`, `768 / 262`         |
| Diorama     | `.layout` | A new wrapper around the canvas                                                       | `820 / 282`, `820 / 262`         |
| Pixel Depot | `.screen` | `.screen__view`, changed from flex to block, with `margin-inline: auto` on the canvas | `768 / 302`, `768 / 264`         |

**Control state.** Task 6 writes these attributes, on every theme's controls so a hidden theme is right when shown, and theme CSS styles from them. The prototype stylesheets use `[data-state="stop"]` on the toggle and `[aria-pressed="true"]` on speed and livery buttons.

| Element            | Task 6 writes                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `data-rail-toggle` | `data-state`, `aria-pressed`, `aria-label` and the `data-rail-label` text, from the table in section 7 |
| `data-rail-speed`  | `aria-pressed="true"` on the button for `speedIndex`, and on none while `userStopped`                  |
| `data-rail-livery` | `aria-pressed="true"` on the button for `liveryId`                                                     |

Task 5 writes `aria-pressed` and `aria-label` on `data-theme-toggle`: pressed means dark.

**Content.** All content comes from `getSiteContent()` in `src/content/site.ts`, called in the frontmatter of `Theme.astro` or of any section component inside the theme. Do not call `getCollection` directly: the integrity checks for empty collections, `order` and the PNG portrait run only through that call. The page passes no content to a theme, so the page never changes when a theme does. Facts about Ahmad live in `src/content/`; only a theme's own voice, such as UI hints and section names, stays in its files.

**Images.** Every image must load lazily, so a hidden theme's images do not load, and have `width` and `height`, so they cannot move the page when they arrive.

| Content                  | Render with                                                                                                                                                                             | `alt`                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `profile.portrait`       | `<Image src={profile.portrait} alt={…} />` from `astro:assets`                                                                                                                          | `profile.portraitAlt`, or `""` beside a text alternative, as in the prototype |
| `profile.contactPhoto`   | `<Image>`                                                                                                                                                                               | `""`, decorative beside the contact details                                   |
| A project's `logo`       | `<Image>`                                                                                                                                                                               | `` `${project.name} logo` ``                                                  |
| `profile.portraitPixels` | A plain `<img>` with `src={portraitPixels.url}`, its `width` and `height`, `loading="lazy"` and `image-rendering: pixelated`. Never `<Image>`, which would resize or re-encode it (E23) | As the prototype                                                              |

`<Image>` sets `loading="lazy"` and the image's own `width` and `height` by default. Size it in CSS.

**Conformance suite.** `tests/e2e/conformance/themes.spec.ts`, run with `npx playwright test tests/e2e/conformance`, which builds first. Theme tasks must keep it green and cannot edit it: a change goes through section 12. For every theme it checks:

- **In light and dark at 320, 390, 768, 1280 and 1920 px:** exactly one "Right now" shown, no sideways scrolling, the `<html>` `color-scheme`, no serious axe violations, all six sections reachable and no page errors.
- **The hero when the scene starts:** the whole `data-rail-hero` holds its height at 320, 390, 620, 640, 768, 1280 and 1920 px, with and without reduced motion, and the toggle's label cannot rewrap the controls at 320 px.
- **Before the scene runs:** the controls are hidden and out of reach.
- **After a failure at 1280 and 1920 px:** the static hero's text stays clear of "Right now".
- **Tokens and headers:** the `--dd-*` tokens are set on all four colour routes (light, dark by the system, dark by a pick, light by a pick on a dark system), and a switched-to section's heading clears any pinned header on desktop and phone.
- **Also:** a saved scheme beats the system's, one "Right now" survives a resize across widths, and no theme's CSS reaches outside its root.

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
| `resize(size)`             | On being shown, even with an unchanged size, and at the start of the next frame after a size change. Never while hidden or at zero width                                                  | Set the canvas's attributes and style. `size.width` is the parent's `clientWidth`; `size.compact` means skip the billboard |
| `draw()`                   | Once right after being shown, then once per frame while running. Off-screen, once after a size or colour change                                                                           | Draw, animating from `world.time`. Never change the world                                                                  |
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
- **`resize` also runs on show with an unchanged size,** so a scene caches any costly work by size.
- **Off-screen, a size or colour change gets one `draw` without stepping the world,** because a resize clears the canvas and the next view of it would otherwise be blank.

**`data-scene-state` on the theme root** is written by the runtime only. Absent means never started.

| Value                                | Meaning                          | What shows                                                                                                                                                                 |
| ------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| absent, with no JavaScript           | No scene is coming               | Static hero and "Right now" in the flow. Controls take no space. No canvas                                                                                                 |
| absent with JavaScript, or `loading` | No scene yet                     | Static hero and "Right now". Controls keep their space, unseen and out of the tab order and accessibility tree. No canvas                                                  |
| `running` or `paused`                | Scene loaded                     | Canvas and controls, no static hero                                                                                                                                        |
| `failed`                             | Import or any scene method threw | Static hero and "Right now" in the flow. Controls leave the flow. No canvas. The hero changes once, by about the line's height minus the controls' slot, only on a failure |

At full width before a scene runs, "Right now" overlays the frame's bottom edge, over the empty controls slot. With the prototypes' CSS and fonts and today's content, it rises above that slot onto the static hero's bottom by 23 px on Interchange at a 600 px frame and 12 px on Pixel Depot at 600 to 640 px. A longer "Right now" item rises further. That is accepted, because it lasts only while the scene loads. If the `page` chunk itself fails, it stays that way, with an empty controls slot.

`paused` means loaded but not selected. A selected theme whose canvas is off-screen or whose tab is hidden stays `running`, and only its loop stops ticking, so scrolling never rewrites this attribute.

**Failure (E12).** A rejected import or a throw from any scene method counts as a failed load. The runtime logs it, forgets the scene and sets `failed`, so the static hero and HTML line show, and other themes stay selectable. Selecting another theme and coming back retries in place, with the same URL. A throw from `world.update` is an engine bug, not a failed load: it stays an uncaught error, the theme stays `running` with its canvas frozen, and the next wake (scroll, refocus or switch) tries again.

| What failed                                                    | What happens                                                                                                                                                               | What recovers it                                                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| A scene method threw                                           | `failed`                                                                                                                                                                   | Coming back                                                                               |
| A scene chunk's request failed, on first load or later         | `failed`, each time while still offline                                                                                                                                    | Coming back once the network returns, or a reload                                         |
| A scene chunk returned 404 on first load                       | `failed`                                                                                                                                                                   | Coming back once the chunk returns, or a reload                                           |
| A scene chunk no longer exists, on a page from before a deploy | `failed` for every theme not yet loaded, and retries keep failing. Themes already loaded keep working                                                                      | Only a reload, and **nothing tells the visitor to reload**: they just see the static hero |
| A scene chunk is slow or stalled                               | `loading` with the static hero, and no timeout. Other themes stay selectable, and a late arrival starts nothing. While the request stays hung, coming back stays `loading` | Its arrival while selected, or coming back after it arrives                               |
| The `page` chunk failed on first load                          | No runtime: the selected theme's static hero, with no state attribute                                                                                                      | A reload                                                                                  |

Those results come from real sockets in Chromium and Playwright's WebKit, on the real engine. Safari itself was not run.

**Chunk rule (`scene-chunks.mjs`).** A scene chunk may statically import only the `page` chunk, which holds the `import()` calls and loads with the page. The build shapes chunks this way, but it does not reject a scene's own `import()` or CSS import. `tests/e2e/scene/chunk-rule.spec.ts` catches an `import()` and a large CSS import. Astro inlines a tiny CSS import, which passes that spec, so the rule itself is: no CSS import in `scene.ts`. `src/scene/scene-css-imports.test.ts` scans the source for it.

- **Why.** In WebKit, a shared chunk that loads on demand and fails leaves every scene that imports it failed, with no recovery in place. If a scene chunk has any such dependency, Vite also adds a `modulepreload` link for that scene, and after a failure WebKit stops fetching it. The spike's retry succeeded only because its chunks had no dependencies.
- **What themes get.** Code only one scene reaches stays in that scene's chunk. Code two scenes share moves to `page` with no action needed, so it loads on every first visit. Keep large code private to a scene.
- **What themes must not do.** Do not work around this: no `import()` and no CSS import in `scene.ts` or its helpers, no chunking settings of your own, and no retry or refresh logic in a theme.
- **Other pages.** An entry script's own body stays out of `page`, so importing `page` never starts the runtime. But every module an entry script imports goes to `page`, even one private to that script. So a script on another page with one imported helper loads all of `page`, including the engine, and the helper joins the home page's chunk. So avoid module imports in other pages' scripts, as the 404 page does, or accept that cost.

**`data-now` on the hero** has one rule, in the runtime, for all three themes: `board` when a scene is loaded and `size.compact` is false, otherwise `html`. Absent (no JavaScript) behaves like `html`. Motion preferences play no part. `src/layouts/global.css` visually hides the HTML line on `board`, and screen readers keep it. At compact widths the line is in the flow before and after the scene starts. At full width it is out of the flow before and after, so neither case moves the hero. On `failed` it is in the flow at every width, as with no JavaScript.

## 9. Tokens, CSS and fonts

- **Every theme rule sits under `[data-rail-theme-root="<name>"]`,** including what the prototypes put on `:root`, `html`, `body` and `*` (C9). `design/train-concepts/scope_css.py` shows the mapping. This covers tokens too, so scenes read them with `readToken`, from the theme root.
- **How to scope is the theme's choice.** The themes write nested rules (Baseline since 2023). The build leaves them nested. `build.cssTarget` in `astro.config.mjs` names browser versions the minifier has nothing to rewrite for, apart from the `-webkit-backdrop-filter` Safari before 18 needs, which it would otherwise strip. Write both forms wherever a theme uses `backdrop-filter`.
- **Dark rules** go in two places, as in the prototypes: `:root[data-theme="dark"] &` and `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) & }`.
- **The theme root carries the page background and `color-scheme`.**
- **Each theme sets `--dd-bg`, `--dd-fg`, `--dd-muted` and `--dd-line`,** which the switcher reads.
- **Shared tokens and global CSS** live in `src/layouts/`. All themes' CSS loads on every visit (C8) and counts toward the budget.
- **Canvas colours come from tokens,** not literals, so a scheme change reaches them.
- **Porting a prototype's `style.css`.** Drop what `src/layouts/global.css` owns: `html { scroll-behavior }` with its reduced-motion rule, `body::before`, and the rules from `shared/now.css`. `shared/switcher.css` went into `src/components/ThemeSwitcher.astro`. Keep the rest under the theme root: `:root` custom properties and `color-scheme` go to `tokens.css`, `body` type and colour rules go on the root itself, `* { box-sizing }` becomes the root and `& *`, and `a { color: inherit }` becomes `& a`. Viewport media queries may stay for page layout, but the scene's reserved height uses the container query in section 6.
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

**These shapes win over the prototype's,** so the engine and the themes follow this section and `src/rail/types.ts`:

- **`marqueeSegments` drops its last argument.** It is `0` at both call sites and no definition of it exists anywhere in the repo.
- **The theme tasks pass `world.textTime`** where the prototypes pass `world.time`.

**What a straight port trips on under `strict`:**

- **`world.pointAt` can return null,** underground. Stations are above ground, so a port guards it with `if (!point) continue;`.
- **`Platform` is a union.** Narrow on `platform.type` before reading `x` or `cx`.
- **`coach`, `coach2` and `coachRoof` are optional in `LiveryColors`.** Fall back as the prototype does with `||`: `colors.coach ?? colors.body`, `colors.coach2 ?? colors.body` and `colors.coachRoof ?? colors.roof`.
- **Sampled points are readonly,** and `hitTrain` cannot be replaced. Use `{ ...p, z }` and `Scene.hitTrain`.

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

## 11. What the spike showed

All three real prototype renderers ran from their own source, unchanged except for the adapter's text substitutions, on one page in Chromium and WebKit, at 1280 and 375 px, in a throwaway page outside the repo. A mini runtime drove them as `Scene` objects.

The measurements are in the description of the PR that added this document.

**What it changed in the contract:**

1. **`resize` moved out of the `ResizeObserver` callback.** Run inside it, WebKit reported `ResizeObserver loop completed with undelivered notifications` as a page error, because scenes change the height of what is observed. Deferring it to the next frame removed the error.
2. **Showing a scene now draws immediately,** so no blank frame appears between the attribute change and the first tick.
3. **`textTime` and `textPaused` were added,** with `startStopped` kept separate from them. Verification later added the first-press rule. See section 7.
4. **`Scene.resize` gets the parent's width.** Interchange and Diorama measure the canvas and Pixel Depot its parent. They matched at both widths, except that Pixel Depot's canvas rounds down to whole pixels (1,122 against 1,124), so only the parent is a safe common measure.

**What it could not prove:** page weight on real themes, which Task 13 measures. Fonts were blocked throughout the spike, so E15 ran on fallback fonts only.

## 12. Changing this contract

The agent that finds a gap stops work on that seam, reports it, and does not work around it locally. The orchestrator dispatches one small branch from the wave's base, and it merges into that base first (local `git merge`, pushed).

- **Additive** (a new optional hook or field): updates the contract and whatever implements it. No pause; other tasks merge the base in when convenient.
- **Breaking** (rename, removal, changed meaning): the coordinator approves it and reports it in the wave summary. Affected in-flight tasks pause, the change updates contract, types, themes and the conformance suite together, and they merge the base in before continuing.
- Each change adds a line to the change log below. A second breaking change in one wave stops the wave for a code review of the whole contract, with the outcome in the wave summary.
- Bugs in `src/scene/` or `src/rail/` go the same way in any wave where nobody owns those paths.

### Change log

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
- Wave 4 base, additive: `RightNow`'s `items` prop is gone, and with all stubs replaced, this document no longer describes them (sections 6, 8, 9, 10 and 12).
