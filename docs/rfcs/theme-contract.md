# Theme contract

## Context

The site ships three train themes (Interchange, Diorama, Pixel Depot) on one static page. The engine, the page shell and all three themes were built in parallel, so this written boundary came before any of them. The prototypes in `design/train-concepts/` show the boundary is close, but they were never written to share a page: each builds its own world, sets global CSS, and two of them throw at desktop widths.

The contract as code is `src/scene/contract.ts`, `src/scene/world-start.ts`, `src/themes/registry.ts` and `src/rail/types.ts`. Where this document and those files disagree, it is a bug in one of them: fix it as section 11 says.

## Executive Summary

One attribute on `<html>` selects the theme, and CSS alone decides what shows, so no JavaScript still gets a readable page.
One scene runtime owns one world and steps it once per frame; scenes only read it and draw, which is what lets everything carry across a switch.
Each theme plugs in through four fixed files in its own directory, so theme work never touches the page or the engine.
Where the shared world starts is one setting, `WORLD_START` (section 7).

## 3. Theme identity

| Theme                 | Name, and value of the selection attribute | Link hash      | Section id prefix |
| --------------------- | ------------------------------------------ | -------------- | ----------------- |
| Interchange (default) | `interchange`                              | `#interchange` | `a-`              |
| Diorama               | `diorama`                                  | `#diorama`     | `b-`              |
| Pixel Depot           | `pixel-depot`                              | `#pixel-depot` | `c-`              |

Names come from `design/train-concepts/concepts/combined.html` (line 21). Use `THEME_NAMES`, `sectionId()`, `themeHash()`, `themeFromHash()`, `THEME_BY_HASH` and `resolveThemeName()` rather than writing these out.

## 4. Selection and visibility

- **`data-rail-theme` on `<html>` selects the theme.** It is the only link between selection (`src/scene/theme.ts`) and scenes (`src/scene/runtime.ts`). `theme.ts` and the inline head script in `src/layouts/Base.astro` write it; the runtime only observes it.
- **`data-theme` on `<html>` stays light or dark,** as in the prototype (`shared/engine.js`, line 451). It is `light`, `dark` or absent, and absent means follow the system. `src/layouts/page-appearance.ts` and the head script write it.
- **Each theme's outermost element carries `data-rail-theme-root="<name>"`.** `src/layouts/global.css` shows the selected root and hides the rest with `display: none`, which also takes hidden themes out of the accessibility tree.
- **No attribute, no JavaScript or an unknown name all show Interchange**, in the CSS and in `resolveThemeName()`, which takes bare values only.
- **Hashes go through `themeFromHash(location.hash)`.** It returns the theme named by a theme hash (`#diorama`) or a section hash (`#b-about`), so a reload keeps the theme and a shared section link selects its theme. It returns null when the hash names no theme. `src/scene/theme.ts` follows the hash once more when it starts, in case a link was clicked before the module ran.
- **The no-flash head script gets `THEME_BY_HASH` at build time through `define:vars`.** That script must be inline and synchronous, so it cannot import `src/scene/contract.ts`. `THEME_BY_HASH` is a plain table of every theme and section hash, and `themeFromHash` is a lookup on it.
- **A hash naming no theme falls back to the saved or default theme.** So a link to `#main` flips a theme that was chosen by link. Every in-page link points at a section id from `sectionId()`, including a skip link, which targets `sectionId(theme, "top")`. Any other id in a theme also carries its prefix, because all three themes share one page, but a link to it would still flip the theme.
- **One source for shared reads.** `showingTheme()`, `themeRootElement()` and `effectiveColorScheme()` in `src/scene/contract.ts` are the only reads of the selected theme, a theme's root and the scheme in effect, so do not write copies. On another page, importing them carries the cost in section 8's "Other pages". Storage guards and the inline head script stay separate on purpose: a theme module has a session fallback and the head script cannot import.
- **Storage keys** are in `STORAGE_KEYS`: `rail-selected-theme`, `rail-color-scheme`, `rail-livery`. They replace the prototype's `rail-concept` and its confusingly named `rail-theme`. Every access is guarded.

## 5. Sections

The six keys are `top`, `about`, `work`, `projects`, `skills` and `contact` (`SECTION_KEYS`). Each maps to the id `<prefix><key>` in every theme, so `about` is `a-about`, `b-about` and `c-about`. Every theme has all six. `top` is the theme's `<main>`.

The contract owns the header link labels (`NAV_SECTIONS`: About, Work, Projects, Skills, Contact), because they are tied to these keys. `top` has no header link; the site mark links to it.

**Keeping the section across a switch.** `src/scene/theme.ts` does this in one synchronous step:

1. Find the outgoing theme's current key. On a history step, read it at `popstate`: WebKit restores the scroll before `hashchange`, to a position saved for the other theme.
   - If the page has scrolled and is at its bottom (`scrollY > 0` and `scrollY + innerHeight >= scrollHeight - 1`), it is `contact`, because a short last section may never reach the viewport top.
   - Otherwise it is the last section in document order whose top is at or above the viewport top plus that section's own `scroll-margin-top` plus 1 px, or `top` if none is. The margin keeps a sticky header from walking back a section per switch, and the 1 px absorbs the fraction a scroll lands short.
2. Write the new `data-rail-theme`.
3. Scroll `sectionId(newTheme, key)` to the top of the viewport without animation. Themes with a sticky header set `scroll-margin-top` on their sections and `<main>`, because `top` is `<main>`, from the measured height in section 6.
4. Replace the hash with `history.replaceState`, adding no history entry and firing no `hashchange`, so a stale `#a-about` cannot bring the old theme back on reload. A section hash becomes `#<sectionId(newTheme, key)>`; anything else becomes `themeHash(newTheme)`.

**Staying there on a theme's first show.** Two things keep the section in place while the incoming theme settles:

- **Reservation.** A theme's whole `data-rail-hero` holds its height when the scene starts, on a switch and on a plain first load, by following section 6. Its lazy images must have `width` and `height`.
- **Re-pinning.** Reservation cannot cover late font swaps or a failed load. So after step 4, `theme.ts` repeats step 3 with the same key whenever the incoming root's `data-scene-state` changes (a `MutationObserver` runs this before the next paint) and whenever the section's resting scroll position (its top in the document, less its `scroll-margin-top`), measured each frame, has moved by more than 1 px. That position changes only when layout does, so a late font that moves nothing, or a local fallback face WebKit marks as loaded on first use, causes no scroll. The pin ends at the visitor's first wheel, touch move, pointer press or key press of any kind, at any `hashchange` or `popstate` (a step between entries with the same hash fires only `popstate`), at the next switch, and 10 seconds after it started, so it does not measure the page forever with no input. It never ends on a `scroll` event, since its own scrolls fire those too.
- **Settling.** For the first 3 frames of a pin, `theme.ts` repeats step 3 unconditionally. A smooth scroll from a section link survives the switch's instant scroll in Chromium and carries the page away from the section, and it cannot be stopped synchronously before step 1. One frame was enough in every run; the other two are margin.
- **Section links on load.** A section link opened fresh (navigation type `navigate`) is a first show too, so `theme.ts` pins that section from page start, under the same rules. A reload or a history step is not pinned, because the browser restores the visitor's own scroll position.
- **Section links clicked.** A clicked link that changes the hash to a section of the showing theme gets a pin too, so a font or scene that moves the section during its smooth scroll cannot leave it off target. The press that makes the click ends any earlier pin, and the click records the section's resting position, because a font can land before the link's `hashchange`, where this pin starts. It has no settling frames and does not answer `data-scene-state`, either of which would cut that smooth scroll short. When the position has moved, it scrolls again with `behavior: "auto"`, which carries on from where the page is, smoothly unless the visitor prefers reduced motion. It otherwise follows the same rules. A pin may not see a scrollbar drag or assistive-technology scrolling, so a layout move during one can pull the page back once; this limit is accepted.

## 6. What a theme provides

A theme lives in `src/themes/<name>/` and has four fixed entry points. `src/themes/registry.ts` imports `meta.ts` and `scene.ts`, the page imports `Theme.astro`, and `Theme.astro` imports `tokens.css`, so a change to one theme stays in its own directory.

| File          | Exports                                                 | Loaded                          |
| ------------- | ------------------------------------------------------- | ------------------------------- |
| `Theme.astro` | The static part, as a component with no props           | Build time                      |
| `meta.ts`     | `meta: ThemeMeta` (label, description, font stylesheet) | With the page                   |
| `scene.ts`    | `createScene: CreateScene`                              | On first show, as its own chunk |
| `tokens.css`  | Custom properties and `color-scheme`, nothing else      | Imported by `Theme.astro`       |

`tokens.css` is separate so another page can take a theme's look without its layout: the 404 page imports all three and sets the saved theme's name on an element's `data-rail-theme-root` and on `data-rail-theme` on `<html>`, because the global CSS hides any root that is not selected. Each file sets at least `--bg`, `--ink`, `--muted` and the `--dd-*` tokens under `[data-rail-theme-root="<name>"]`, in light and dark. Other CSS, such as each theme's `theme.css`, is the theme's own choice.

**Header clearance.** A section link has to land below a sticky header, whose height depends on fonts, wrapping and the visitor's text size. So `src/scene/theme.ts` measures the shown header, the `header` around `THEME_HOOKS.themeSwitcher`, and writes it to `HEADER_HEIGHT_PROPERTY` (`--rail-header-height`) on the theme root: on a switch, before every scroll to a section, and from a `ResizeObserver` for font swaps and zoom. A theme's `scroll-margin-top` reads that variable with one fallback per layout, as in `var(--rail-header-height, var(--top-height))`. The fallback serves only a page with no JavaScript, where a section's own top padding covers the difference. The observer cannot loop, because the variable feeds only `scroll-margin-top`.

**Other pages.** A page with no address of its own, such as the 404 page, passes `noindex` to `Base`. It then gets `<meta name="robots" content="noindex">` and no canonical link or `og:url`.

**The static part must:**

- Have `data-rail-theme-root="<name>"` on its outermost element, and all six section ids.
- Have one element with `data-rail-hero` and `tabindex="-1"`, holding one `data-rail-scene-frame` element at any depth. The frame holds the canvas parent, the controls below it, and `<RightNow />` as a direct child. Only `.now` is bound by selector (`[data-rail-scene-frame] > .now`), so the others may nest. The controls must sit below the canvas parent: at full width the line overlays the frame's bottom edge while the scene loads, so without a controls slot there it lands on the static hero. `src/layouts/global.css` makes the frame a size container named `rail-scene` and the line's positioning parent, so a theme sets neither `position` nor its own `container-type` on it.
- Have one `<canvas data-rail-canvas role="img" aria-label="…">`, with `display: block`, whose parent is a block element, not a flex container, with no horizontal padding that fills the frame's content box. A flex parent would shrink the static hero, so a canvas narrower than its parent centres with `margin-inline: auto`. The runtime reads that parent's `clientWidth`, so the frame's size queries measure exactly the same width. Before any scene loads, the parent reserves the height the scene will draw at, compact and full, with `aspect-ratio` and a container query at `COMPACT_SCENE_WIDTH` (600 px, repeated by hand because CSS cannot import it). Never a viewport query: a padded hero or a max-width wrapper makes the viewport wider than the scene, and the CSS would reserve full height while the scene draws compact. A canvas that snaps to whole pixels, as Pixel Depot's does, can outgrow that reservation by up to its pixel size, so its parent also sets `overflow: hidden`.
- Have one `data-rail-static` element inside that parent: what shows when no scene runs (no JavaScript, or a failed load). It fills the reserved box and must fit it without clipping at 320 px, where the box is about 90 px tall. A taller one grows the parent and moves the hero when the scene starts, and `overflow: hidden` on the parent would cut its text off while passing every check, so shorten the content instead.
- Put its controls in one `data-rail-controls` element in the frame, using the prototype's hooks: `data-rail-toggle` with a `data-rail-label` inside, `data-rail-speed="<index>"` for each of `SPEEDS`, and `data-rail-livery="<id>"` for each of `LIVERY_ORDER`, named by `LIVERY_LABELS`. `src/scene/controls.ts` binds them and writes their state (below). It rewrites the toggle's label, so the label holds the width of the widest of its three strings in the theme's own font, or a press can rewrap the controls and move the page. Which string is widest depends on the font, and an icon and gap sit beside the label, so size the label and not the toggle: `[data-rail-label] { display: inline-block; min-inline-size: <n>ch; text-align: start; }`. A button centres its text, so without `text-align` the gap to the icon changes with the string. Diorama and Pixel Depot use `15ch`. Interchange uses `12ch`, because `15ch` pushed its service bar to three rows at 320 px. Measure a theme's own value, since `ch` differs by font; expect a toggle wider than the prototype's.
- Render `<RightNow />` from `src/components/RightNow.astro` as a direct child of the frame. It takes no props and reads `getSiteContent()` itself. Each item has a `.now__v` value, and a `.now__k` label only when `now.txt` gives it one, so `NowItem.label` is optional and a billboard draws a plain item as its value alone. Theme CSS may style its `.now`, `.now__label`, `.now__k` and `.now__v` classes, but not its position: at full width the line is out of the flow from the start, overlaying the frame's bottom edge until the billboard takes over, and it returns to the flow on `failed`.
- Render `src/components/ThemeSwitcher.astro` with `current="<name>"` in its header. It keeps `data-theme-switcher` (`THEME_HOOKS.themeSwitcher`) on its outer element: after a switch, focus goes to its `[aria-current="true"]` element, or otherwise its first `a` or `button`, so one of those must be focusable while the switcher is closed.
- Use the page-helper hooks that `src/layouts/page-appearance.ts` and `src/layouts/page-helpers.ts` bind: `data-theme-toggle`, `data-copy` with `data-copy-label`, `data-copy-target`, `data-cv`, `data-year`.

**Porting the prototypes' heroes.** Check the ratios against each `render.js` if a view changes.

| Theme       | Frame     | Canvas parent                                                                         | Reserved ratio, full and compact |
| ----------- | --------- | ------------------------------------------------------------------------------------- | -------------------------------- |
| Interchange | `.map`    | A new wrapper around the canvas                                                       | `768 / 300`, `768 / 262`         |
| Diorama     | `.layout` | A new wrapper around the canvas                                                       | `820 / 282`, `820 / 262`         |
| Pixel Depot | `.screen` | `.screen__view`, changed from flex to block, with `margin-inline: auto` on the canvas | `768 / 302`, `768 / 264`         |

**Control state.** `src/scene/controls.ts` writes these attributes, on every theme's controls so a hidden theme is right when shown, and theme CSS styles from them. The prototype stylesheets use `[data-state="stop"]` on the toggle and `[aria-pressed="true"]` on speed and livery buttons.

| Element            | `controls.ts` writes                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `data-rail-toggle` | `data-state`, `aria-pressed`, `aria-label` and the `data-rail-label` text, from the table in section 7 |
| `data-rail-speed`  | `aria-pressed="true"` on the button for `speedIndex`, and on none while `userStopped`                  |
| `data-rail-livery` | `aria-pressed="true"` on the button for `liveryId`                                                     |

`src/layouts/page-appearance.ts` writes `aria-pressed` and `aria-label` on `data-theme-toggle`: pressed means dark.

**Content.** All content comes from `getSiteContent()` in `src/content/site.ts`, called in the frontmatter of `Theme.astro` or of any section component inside the theme. Do not call `getCollection` directly: the integrity checks for empty collections, `order` and the PNG portrait run only through that call. The page passes no content to a theme, so the page never changes when a theme does. Facts about Ahmad live in `src/content/`; only a theme's own voice, such as UI hints and section names, stays in its files.

**Images.** Every image must load lazily, so a hidden theme's images do not load, and have `width` and `height`, so they cannot move the page when they arrive.

| Content                  | Render with                                                                                                                                                                       | `alt`                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `profile.portrait`       | `<Image src={profile.portrait} alt={…} />` from `astro:assets`                                                                                                                    | `profile.portraitAlt`, or `""` beside a text alternative, as in the prototype |
| `profile.contactPhoto`   | `<Image>`                                                                                                                                                                         | `""`, decorative beside the contact details                                   |
| A project's `logo`       | `<Image>`                                                                                                                                                                         | `` `${project.name} logo` ``                                                  |
| `profile.portraitPixels` | A plain `<img>` with `src={portraitPixels.url}`, its `width` and `height`, `loading="lazy"` and `image-rendering: pixelated`. Never `<Image>`, which would resize or re-encode it | As the prototype                                                              |

`<Image>` sets `loading="lazy"` and the image's own `width` and `height` by default. Size it in CSS.

**Conformance suite.** `tests/e2e/conformance/themes.spec.ts`, run with `npx playwright test tests/e2e/conformance`, which builds first. A change to a theme must keep it green. Changing the suite itself is a contract change (section 11). For every theme it checks:

- **In light and dark at 320, 390, 768, 1280 and 1920 px:** exactly one "Right now" shown, no sideways scrolling, the `<html>` `color-scheme`, no serious axe violations, all six sections reachable and no page errors.
- **The hero when the scene starts:** the whole `data-rail-hero` holds its height at 320, 390, 620, 640, 768, 1280 and 1920 px, with and without reduced motion, and the toggle's label cannot rewrap the controls at 320 px.
- **Before the scene runs:** the controls are hidden and out of reach.
- **After a failure at 1280 and 1920 px:** the static hero's text stays clear of "Right now".
- **Tokens and headers:** the `--dd-*` tokens are set on all four colour routes (light, dark by the system, dark by a pick, light by a pick on a dark system), and a switched-to section's heading clears any pinned header on desktop and phone.
- **Also:** a saved scheme beats the system's, one "Right now" survives a resize across widths, and no theme's CSS reaches outside its root.

## 7. The shared world

| Question                     | Answer                                                                                                                                                                                                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who creates it               | The scene runtime, once, at start                                                                                                                                                                                                                                                                     |
| Who steps it                 | The scene runtime, once per frame, and only while a scene is running. Nothing else ever holds `update`                                                                                                                                                                                                |
| What scenes may read         | `WorldView`: only what the prototype renderers read. Letters, bridge, tunnels, portals, stations, cars, people, puffs, livery and clocks. The route, speed and stop state are not in it                                                                                                               |
| What scenes may change       | Nothing. `SceneContext.world` is a `WorldView`, which has no control methods                                                                                                                                                                                                                          |
| How the world changes        | Controls in the theme's markup, which `controls.ts` binds to `toggleStop`, `setSpeed` and `setLivery`. It reads `speedIndex`, `userStopped` and `textPaused` from `World` and re-syncs the controls after each call. There is no change event, because only these calls change what the controls show |
| How the train is hit-tested  | `Scene.hitTrain`, per theme. `WorldView.hitTrain` is a readonly property, so replacing it as `concepts/b/render.js` (line 427) does fails to compile                                                                                                                                                  |
| What carries across a switch | Everything, because nothing is per theme: position, stop state, speed and livery are one object. The current section is kept by section 5                                                                                                                                                             |

**Where the world starts.** The prototypes differ (seeds 11, 23, 31; liveries metro, steam, toy). `WORLD_START` in `src/scene/world-start.ts` is the one place to change: one seed (11, the default theme's), a saved livery wins, otherwise a first visit gets the default livery of the theme shown first. An invalid saved livery counts as no saved livery.

**Text clock.** Billboard text rolls on `world.textTime`, never `world.time`, and has no reduced-motion branch anywhere. Text rolls for everyone until a visitor pauses it.

`userStopped` and `textPaused` give three reachable states. A reduced-motion visitor starts in the second, with the scene still and the text rolling. Their first press pauses the text and does not start the train, so pausing never requires adding motion.

**What `userStopped` means.** The scene goes still when the train comes to rest, not at the press. A moving train brakes for up to about 2.75 s from the top speed, and everything runs as normal until it stops. From then on the crowd, the steam, any dwell at a station and `world.time` all hold, so a scene that animates from `world.time` freezes with no code of its own. A reduced-motion start is already at rest, so it is still from the first frame. `world.textTime` obeys `textPaused` alone, so a press pauses text at once. If a braking train reaches a station, passengers start getting on and off as usual on that frame, then hold where they are. Starting again resumes exactly where things left off, with no jump. A livery change still applies at once. A livery change at rest leaves any steam already in the air where it is until the train restarts.

| State                  | `userStopped` | `textPaused` | Scene              | Text   | `data-state` | `aria-pressed` | Label           | Press gives |
| ---------------------- | ------------- | ------------ | ------------------ | ------ | ------------ | -------------- | --------------- | ----------- |
| Running (normal start) | false         | false        | Runs               | Rolls  | `go`         | `false`        | Stop the train  | Stopped     |
| Reduced-motion start   | true          | false        | Still              | Rolls  | `stop`       | `false`        | Pause the text  | Stopped     |
| Stopped                | true          | true         | Still once at rest | Paused | `stop`       | `true`         | Start the train | Running     |

- **`createWorld`:** `startStopped: true` gives the reduced-motion start, and false gives running. The world is never in the reduced-motion start again after leaving it.
- **Compact widths are the one exception, and it lives in `src/scene/controls.ts`, not the engine.** When `size.compact` is true on a reduced-motion start, nothing moves, so "Pause the text" would have nothing to pause. The control shows `data-state="stop"`, `aria-pressed="true"` and "Start the train", and a press calls `toggleStop(false)`, giving Running. Wide widths keep the table. If the width changes in this state, the control follows the current width.
- **`toggleStop(force?)`:** sets both flags to `force ?? !textPaused`. The press on the train and the Space key go through the same binding as the control.
- **`setSpeed(index)`:** clears both flags, because choosing a speed asks for motion.
- **`userStopped: false` with `textPaused: true`** cannot happen.

## 8. Scene lifecycle

`scene.ts` exports `createScene(context)`, returning a `Scene`. Types are in `src/scene/contract.ts`. The runtime's only entry point is `startSceneRuntime()` from `src/scene/runtime.ts`, called by the page.

| Method                     | When the runtime calls it                                                                                                                                                                 | The scene must                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `createScene`              | First time the theme is shown                                                                                                                                                             | Not assume a size. Hold no timers or observers of its own                                                                  |
| `resize(size)`             | On being shown, even with an unchanged size, and at the start of the next frame after a size change. Never while hidden or at zero width                                                  | Set the canvas's attributes and style. `size.width` is the parent's `clientWidth`; `size.compact` means skip the billboard |
| `draw()`                   | Once right after being shown, then once per frame while running and while what it draws from changes. Off-screen, once after a size or colour change                                      | Draw, animating only from `world.time` and `world.textTime`. Never change the world                                        |
| `hitTrain(point, radius)`  | On pointer move (`HIT_RADIUS.hover`, 16) and click (`HIT_RADIUS.click`, 20). `point` is canvas-relative CSS pixels; `radius` is world units, as in `shared/engine.js` (lines 403 and 408) | Convert the point with its own projection and compare in world units                                                       |
| `applyColorScheme(scheme)` | Always before the first `draw`, on being shown if the scheme changed, and on any change while showing                                                                                     | Re-read tokens with `readToken`. Values are already correct, so no deferred read is needed                                 |
| `onFontsReady()`           | At the next frame after `loadedFontFaceCount()` rises while showing, and on being shown if it rose while hidden. Not for fonts loaded before `createScene`                                | Drop any cached text measurement                                                                                           |

**Rules the runtime keeps:**

- **A still scene is not redrawn.** The loop keeps running, but a frame draws only if `world.time`, `world.textTime` or `world.liveryId` changed since the last draw, which leaves a stopped train at rest with its text paused undrawn. A resize and a colour or font change each repaint once, and so does coming back on screen or to the tab. So a scene animating from any other clock would freeze.
- **It runs only the showing scene.** Others are kept, paused and undrawn. Nothing is torn down.
- **One rule decides running:** a loaded scene for the selected theme, canvas on screen, and tab visible. There is no separate flag for any of the three, because a stored flag lets a tab refocus overwrite the off-screen state.
- **Last selection wins.** A late import of a theme that is no longer selected starts nothing.
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

**Failure.** A rejected import or a throw from any scene method counts as a failed load. The runtime logs it, forgets the scene and sets `failed`, so the static hero and HTML line show, and other themes stay selectable. Selecting another theme and coming back retries in place, with the same URL. A throw from `world.update` is an engine bug, not a failed load: it stays an uncaught error, the theme stays `running` with its canvas frozen, and the next wake (scroll, refocus or switch) tries again.

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

- **Why.** In WebKit, a shared chunk that loads on demand and fails leaves every scene that imports it failed, with no recovery in place. If a scene chunk has any such dependency, Vite also adds a `modulepreload` link for that scene, and after a failure WebKit stops fetching it. A retry in place succeeds only because scene chunks have no such dependencies.
- **What themes get.** Code only one scene reaches stays in that scene's chunk. Code two scenes share moves to `page` with no action needed, so it loads on every first visit. Keep large code private to a scene.
- **What themes must not do.** Do not work around this: no `import()` and no CSS import in `scene.ts` or its helpers, no chunking settings of your own, and no retry or refresh logic in a theme.
- **Other pages.** An entry script's own body stays out of `page`, so importing `page` never starts the runtime. But every module an entry script imports goes to `page`, even one private to that script. So a script on another page with one imported helper loads all of `page`, including the engine, and the helper joins the home page's chunk. So avoid module imports in other pages' scripts, as the 404 page does, or accept that cost.

**`data-now` on the hero** has one rule, in the runtime, for all three themes: `board` when a scene is loaded and `size.compact` is false, otherwise `html`. Absent (no JavaScript) behaves like `html`. Motion preferences play no part. `src/layouts/global.css` visually hides the HTML line on `board`, and screen readers keep it. At compact widths the line is in the flow before and after the scene starts. At full width it is out of the flow before and after, so neither case moves the hero. On `failed` it is in the flow at every width, as with no JavaScript.

## 9. Tokens, CSS and fonts

- **Every theme rule sits under `[data-rail-theme-root="<name>"]`,** including what the prototypes put on `:root`, `html`, `body` and `*`. `design/train-concepts/scope_css.py` shows the mapping. This covers tokens too, so scenes read them with `readToken`, from the theme root.
- **How to scope is the theme's choice.** The themes write nested rules (Baseline since 2023). The build leaves them nested. `build.cssTarget` in `astro.config.mjs` names browser versions for which the minifier adds the `-webkit-backdrop-filter` Safari before 18 needs and removes `-webkit-mask`, which none of them needs, and has nothing else to rewrite. So write only the standard property.
- **Dark rules** go in two places, as in the prototypes: `:root[data-theme="dark"] &` and `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) & }`.
- **The theme root carries the page background and `color-scheme`.**
- **Each theme sets `--dd-bg`, `--dd-fg`, `--dd-muted` and `--dd-line`,** which the switcher reads.
- **Shared tokens and global CSS** live in `src/layouts/`. All themes' CSS loads on every visit and counts toward the page-weight budget of 100 KB compressed for HTML, CSS and the first theme's JavaScript, excluding images and fonts.
- **Canvas colours come from tokens,** not literals, so a scheme change reaches them.
- **Porting a prototype's `style.css`.** Drop what `src/layouts/global.css` owns: `html { scroll-behavior }` with its reduced-motion rule, `body::before`, and the rules from `shared/now.css`. `shared/switcher.css` went into `src/components/ThemeSwitcher.astro`. Keep the rest under the theme root: `:root` custom properties and `color-scheme` go to `tokens.css`, `body` type and colour rules go on the root itself, `* { box-sizing }` becomes the root and `& *`, and `a { color: inherit }` becomes `& a`. Viewport media queries may stay for page layout, but the scene's reserved height uses the container query in section 6.
- **Fonts.** Each theme names one Google Fonts stylesheet in `meta.fontStylesheet`, and `src/layouts/page-appearance.ts` requests it only when that theme is shown. Self-host only a font with no Google match. Canvas text must stay legible with fallback fonts.
- **Fallback fonts.** So a late font moves the page less, every web font has a metric-matched face in `src/layouts/fallback-fonts.css`, named right after it in the theme's stack: a local font with `size-adjust` and ascent and descent overrides. This narrows a shift rather than removing it: a line can still wrap differently at some widths, above all inside a `ch` width, which follows each font's own `0`, and Safari's support for the override descriptors has not been verified. A new web font adds its own. Those rules are the one thing outside a theme root, because `@font-face` cannot nest.

## 10. Engine API

`src/rail/index.ts` is the only import path for the engine. `src/rail/types.ts` holds its types and names no DOM type.

| Export                                       | Notes                                                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createWorld(options)`                       | `seed`, `livery` and `startStopped` are all required. Returns `World`                                                                                   |
| `sample(segment, step?)`                     | Only above-ground segments, so no null points. Each point carries `seg`, so `elevationAt` works on it; readonly, so Diorama keeps its own `{ ...p, z }` |
| `marquee(canvas, text, options)`             | Options object `{ x, baseline, width, time, speed }`, not the prototype's positional numbers. No reduced-motion branch                                  |
| `marqueeSegments(canvas, segments, options)` | Options object                                                                                                                                          |
| `nowCycle(time, count, period?)`             | Returns `{ index, alpha }`, not the prototype's `{ i, a }`. No reduced-motion branch                                                                    |
| `DEFAULT_LIVERY`, `isLiveryId`               |                                                                                                                                                         |
| `LIVERY_ORDER`, `LIVERY_LABELS`              | From `shared/content.py` (lines 137–138): control order and names                                                                                       |
| `SPEEDS`, `TAU`                              | `SPEEDS` lets a theme render its speed buttons at build time                                                                                            |

**These shapes win over the prototype's,** so the engine and the themes follow this section and `src/rail/types.ts`:

- **`marqueeSegments` drops its last argument.** It is `0` at both call sites and no definition of it exists anywhere in the repo.
- **Themes pass `world.textTime`** where the prototypes pass `world.time`.

**What a straight port trips on under `strict`:**

- **`world.pointAt` can return null,** underground. Stations are above ground, so a port guards it with `if (!point) continue;`.
- **`Platform` is a union.** Narrow on `platform.type` before reading `x` or `cx`.
- **`coach`, `coach2` and `coachRoof` are optional in `LiveryColors`.** Fall back as the prototype does with `||`: `colors.coach ?? colors.body`, `colors.coach2 ?? colors.body` and `colors.coachRoof ?? colors.roof`.
- **Sampled points are readonly,** and `hitTrain` cannot be replaced. Use `{ ...p, z }` and `Scene.hitTrain`.

**Where every prototype helper goes:**

| Prototype                                                                                                                             | Goes to                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `createWorld`, `sample`, `TAU`, `marquee`, `nowCycle`                                                                                 | Engine API                                                                                          |
| Route, station, passenger and PRNG internals of `shared/engine.js`, and `LIVERIES`, `head`, `v`, `mode`, `dwell`, `total`, `capacity` | Private to `src/rail/`                                                                              |
| `onChange` and its `emit` calls                                                                                                       | Not ported. Nothing outside the control sync used them, and `controls.ts` re-syncs after each call  |
| `tick` frame counter in `concepts/c/render.js` (line 346)                                                                             | Pixel Depot, from `world.time`                                                                      |
| `marqueeSegments` (undefined in the prototype)                                                                                        | Engine API                                                                                          |
| `bindControls`, `bindCanvasInput`, `runLoop`                                                                                          | `src/scene/controls.ts`, `input.ts` and `runtime.ts`                                                |
| `cssVar`                                                                                                                              | `src/scene/loaded-scene.ts`, as `SceneContext.readToken`                                            |
| `nowItems`                                                                                                                            | `src/scene/loaded-scene.ts`, as `SceneContext.nowItems`                                             |
| `nowText`                                                                                                                             | Left out: no renderer calls it                                                                      |
| `reduceMotion` (not exported, read at `concepts/a/render.js` line 227)                                                                | `src/scene/runtime.ts` reads the preference once, for `startStopped`. Nothing else may read it      |
| `bindTheme`                                                                                                                           | `src/layouts/page-appearance.ts`, which writes `data-theme`. Scenes hear through `applyColorScheme` |
| `bindPageHelpers`                                                                                                                     | `src/layouts/page-helpers.ts`, without the prototype viewer's `window.claude` download branch       |
| `dataset.now` writes in renderers                                                                                                     | `src/scene/runtime.ts`, one rule (section 8)                                                        |
| Saving the livery                                                                                                                     | `src/scene/controls.ts`, in the control binding                                                     |
| `hitTrain` radii 16 and 20 in `bindCanvasInput`                                                                                       | `HIT_RADIUS`, used by `src/scene/input.ts`                                                          |

## 11. Changing this contract

Change the contract, its types (`src/scene/contract.ts`, `src/rail/types.ts`) and the conformance suite together, in one change, with every theme it affects. Whoever finds a gap fixes it that way rather than working around it in one theme.

`docs/rfcs/theme-contract-history.md` records why the contract took this shape and how it changed.
