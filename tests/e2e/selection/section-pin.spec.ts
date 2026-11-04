import { expect, type Page } from "@playwright/test";
import {
  SCENE_STATE_ATTRIBUTE,
  SECTION_KEYS,
  sectionId,
  THEME_ROOT_ATTRIBUTE,
  themeHash,
  type SectionKey,
  type ThemeName,
} from "../../../src/scene/contract";
import {
  currentHash,
  expectSceneNotStarted,
  expectSectionAtTop,
  expectShowing,
  frames,
  goToHash,
  HERO_GROWS_WHEN_SCENE_STARTS,
  holdSceneChunks,
  LOADABLE_FONT_URL,
  pickThemeInPlace,
  sceneSettled,
  sectionOffset,
  scrollAtRest,
  scrollToSection,
  serveWithCss,
  switcherChoice,
  tallSectionsCss,
  test,
  themeRoot,
  watchForEvent,
  pastPinSettling,
} from "./support";

const FROM: ThemeName = "interchange";
const TO: ThemeName = "diorama";
const KEY: SectionKey = "projects";
const OFF_TARGET = 300;
const LATE_FONT = "test-late-font";

test.describe.configure({ mode: "parallel" });

const pageClockNow = (page: Page): Promise<number> =>
  page.evaluate(() => Date.now());

/**
 * A switch that has finished, with the pin still holding. Returns the page clock
 * just after the switch's click, which the pin cannot have started later than.
 */
async function switchedAndSettled(page: Page): Promise<number> {
  await serveWithCss(page, tallSectionsCss());
  await page.goto(`/${themeHash(FROM)}`);
  await sceneSettled(page, FROM);
  await scrollToSection(page, FROM, KEY);
  await pickThemeInPlace(page, TO);
  const switchedBy = await pageClockNow(page);
  await expectShowing(page, TO);
  await sceneSettled(page, TO);
  await pastPinSettling(page);
  await expectSectionAtTop(page, TO, KEY);
  return switchedBy;
}

/** Counts from the switch, as an installed clock keeps moving with real time too. */
async function fastForwardPastSwitch(
  page: Page,
  { switchedBy, msAfterSwitch }: { switchedBy: number; msAfterSwitch: number },
): Promise<void> {
  const elapsedMs = (await pageClockNow(page)) - switchedBy;
  await page.clock.fastForward(Math.max(0, msAfterSwitch - elapsedMs));
}

/** Moves away the way a visitor's scroll would, and lets its scroll event fire. */
async function scrollOffTarget(page: Page): Promise<void> {
  await page.evaluate(
    (distance) =>
      new Promise<void>((resolve) => {
        window.addEventListener("scroll", () => resolve(), { once: true });
        window.scrollBy({ top: distance, behavior: "instant" });
      }),
    OFF_TARGET,
  );
  await frames(page);
}

/**
 * Something the pin answers. The value is unchanged, so neither the runtime nor
 * any theme's CSS sees a difference.
 */
async function rewriteSceneState(page: Page, theme: ThemeName): Promise<void> {
  await page.evaluate(
    ({ selector, attribute }) => {
      const root = document.querySelector(selector);
      root?.setAttribute(attribute, root.getAttribute(attribute) ?? "");
    },
    {
      selector: `[${THEME_ROOT_ATTRIBUTE}="${theme}"]`,
      attribute: SCENE_STATE_ATTRIBUTE,
    },
  );
  await frames(page);
}

async function expectPinHeld(page: Page): Promise<void> {
  await rewriteSceneState(page, TO);
  await expectSectionAtTop(page, TO, KEY);
}

async function expectPinEnded(page: Page): Promise<void> {
  await scrollAtRest(page);
  const before = await sectionOffset(page, TO, KEY);
  expect(Math.abs(before)).toBeGreaterThan(OFF_TARGET / 2);
  await rewriteSceneState(page, TO);
  await frames(page, 4);
  expect(Math.abs((await sectionOffset(page, TO, KEY)) - before)).toBeLessThan(
    1,
  );
}

/** The section's `scrollY` at rest: only a layout change moves this, never a scroll. */
const restingScrollY = async (page: Page): Promise<number> =>
  (await sectionOffset(page, TO, KEY)) +
  (await page.evaluate(() => window.scrollY));

/** Adds a block above the section. */
function insertAboveSection(page: Page, css: string): Promise<void> {
  return page.evaluate(
    ({ id, cssText }) => {
      const block = document.createElement("div");
      block.style.cssText = cssText;
      block.innerHTML = '<span style="display: inline-block"></span>';
      document.getElementById(id)?.before(block);
    },
    { id: sectionId(TO, KEY), cssText: css },
  );
}

const loadLateFont = (page: Page): Promise<void> =>
  page.evaluate(
    async ({ family, url }) => {
      const face = new FontFace(family, `url(${url})`);
      document.fonts.add(face);
      await face.load();
    },
    { family: LATE_FONT, url: LOADABLE_FONT_URL },
  );

test.describe("what ends a pin", () => {
  test("a scroll event does not, since the pin's own scrolls fire it too", async ({
    page,
  }) => {
    await switchedAndSettled(page);
    await scrollOffTarget(page);
    expect(Math.abs(await sectionOffset(page, TO, KEY))).toBeGreaterThan(
      OFF_TARGET / 2,
    );
    await expectPinHeld(page);
  });

  const ENDERS: {
    name: string;
    eventType: string;
    act: (page: Page) => Promise<void>;
  }[] = [
    {
      name: "a key press of any kind",
      eventType: "keydown",
      // Shift scrolls nothing. The delay is for WebKit, which drops a zero-length
      // press under a requestAnimationFrame loop.
      act: (page) => page.keyboard.press("Shift", { delay: 120 }),
    },
    {
      name: "the wheel",
      eventType: "wheel",
      act: async (page) => {
        await page.mouse.move(200, 200);
        await page.mouse.wheel(0, 10);
      },
    },
    {
      name: "a pointer press",
      eventType: "pointerdown",
      // Press only: a full click could land on a link.
      act: async (page) => {
        await page.mouse.move(200, 200);
        await page.mouse.down();
      },
    },
    {
      name: "a back step to the same hash",
      eventType: "popstate",
      // No hashchange comes of this, so nothing else would end the pin.
      act: (page) =>
        page.evaluate(() => {
          history.pushState(history.state, "", location.href);
          history.back();
        }),
    },
    {
      name: "a touch move",
      eventType: "touchmove",
      // Neither browser here can drive a real touch drag in a desktop context.
      act: (page) =>
        page.evaluate(() => {
          document.body.dispatchEvent(
            new Event("touchmove", { bubbles: true }),
          );
        }),
    },
  ];

  for (const { name, eventType, act } of ENDERS) {
    test(`${name} does`, async ({ page }) => {
      await switchedAndSettled(page);
      const seen = await watchForEvent(page, eventType);
      await act(page);
      await seen();
      await scrollOffTarget(page);
      await expectPinEnded(page);
    });
  }

  test("a hashchange does, and the new section is where the page stays", async ({
    page,
  }) => {
    await switchedAndSettled(page);
    const target: SectionKey = "contact";
    const seen = await watchForEvent(page, "hashchange");
    await page.evaluate(
      (hash) => {
        location.hash = hash;
      },
      `#${sectionId(TO, target)}`,
    );
    await seen();
    await expectSectionAtTop(page, TO, target);

    await rewriteSceneState(page, TO);
    await frames(page, 4);
    await expectSectionAtTop(page, TO, target);
  });

  test("a second switch starts its own, on the section in view by then", async ({
    page,
  }) => {
    await switchedAndSettled(page);
    const later: SectionKey = "skills";
    await scrollToSection(page, TO, later);

    await pickThemeInPlace(page, "pixel-depot");
    await expectShowing(page, "pixel-depot");
    await sceneSettled(page, "pixel-depot");
    await pastPinSettling(page);
    await expectSectionAtTop(page, "pixel-depot", later);

    await scrollOffTarget(page);
    await rewriteSceneState(page, "pixel-depot");
    await expectSectionAtTop(page, "pixel-depot", later);
  });
});

test.describe("the time limit on a pin", () => {
  // Well past settling, and with seconds to spare for a slow machine's checks.
  const HELD_CHECK_MS = 6_000;
  const PIN_TIME_LIMIT_MS = 10_000;

  test("it holds well past settling with no input, and ends at 10 seconds", async ({
    page,
  }) => {
    await page.clock.install();
    const switchedBy = await switchedAndSettled(page);

    await fastForwardPastSwitch(page, {
      switchedBy,
      msAfterSwitch: HELD_CHECK_MS,
    });
    await scrollOffTarget(page);
    await expectPinHeld(page);

    await fastForwardPastSwitch(page, {
      switchedBy,
      msAfterSwitch: PIN_TIME_LIMIT_MS,
    });
    await scrollOffTarget(page);
    await expectPinEnded(page);
  });
});

test.describe("what a pin answers", () => {
  test("the incoming scene's first show, which moves the page", async ({
    page,
  }) => {
    await serveWithCss(
      page,
      `${tallSectionsCss()}\n${HERO_GROWS_WHEN_SCENE_STARTS}`,
    );
    await page.goto(`/${themeHash(FROM)}`);
    await sceneSettled(page, FROM);
    const release = await holdSceneChunks(page);
    await scrollToSection(page, FROM, KEY);

    await pickThemeInPlace(page, TO);
    // Late enough that only the pin, and not the switch's own settling, can help.
    await pastPinSettling(page);
    await expectSceneNotStarted(page, TO);
    await expectSectionAtTop(page, TO, KEY);

    await release();
    await sceneSettled(page, TO);
    await frames(page);
    await expectSectionAtTop(page, TO, KEY);
  });

  test("a font arriving late that moves the section", async ({ page }) => {
    await switchedAndSettled(page);
    // Its one line is as tall as its first font says, and the fallback's is taller.
    await insertAboveSection(page, `font: 400px/normal "${LATE_FONT}", serif`);
    await frames(page);
    await expectSectionAtTop(page, TO, KEY);
    const before = await restingScrollY(page);

    await loadLateFont(page);
    await frames(page, 3);

    // Otherwise the font moved nothing, and this tested nothing.
    expect(Math.abs((await restingScrollY(page)) - before)).toBeGreaterThan(10);
    await expectSectionAtTop(page, TO, KEY);
  });

  test("not a font that moves nothing", async ({ page }) => {
    await switchedAndSettled(page);
    await scrollOffTarget(page);
    const before = await sectionOffset(page, TO, KEY);

    await loadLateFont(page);
    await frames(page, 3);

    expect(
      Math.abs((await sectionOffset(page, TO, KEY)) - before),
    ).toBeLessThan(1);
    // Still running, so it chose not to scroll.
    await expectPinHeld(page);
  });
});

test.describe("a fresh section link", () => {
  test("stays on target through the scene's first show", async ({ page }) => {
    await serveWithCss(
      page,
      `${tallSectionsCss()}\n${HERO_GROWS_WHEN_SCENE_STARTS}`,
    );
    const release = await holdSceneChunks(page);
    // Not "load": WebKit holds that back for a pending dynamic import.
    await page.goto(`/#${sectionId(TO, KEY)}`, {
      waitUntil: "domcontentloaded",
    });
    await expectShowing(page, TO);
    await pastPinSettling(page);
    await expectSceneNotStarted(page, TO);
    await expectSectionAtTop(page, TO, KEY);

    await release();
    await sceneSettled(page, TO);
    await frames(page);
    await expectSectionAtTop(page, TO, KEY);
  });

  test("gives way to the visitor once they act", async ({ page }) => {
    await serveWithCss(page, tallSectionsCss());
    await page.goto(`/#${sectionId(TO, KEY)}`);
    await sceneSettled(page, TO);
    await pastPinSettling(page);
    await page.keyboard.press("Shift", { delay: 120 });
    await scrollOffTarget(page);
    await expectPinEnded(page);
  });
});

test.describe("a section link opened in a new tab", () => {
  test("leaves no pin for a later history step onto its hash", async ({
    page,
    context,
  }) => {
    const SHIFT = 240;
    context.on("page", (opened) => void opened.close());
    await serveWithCss(page, tallSectionsCss());
    await page.goto(`/${themeHash(TO)}`);
    await sceneSettled(page, TO);
    const linkedHash = `#${sectionId(TO, KEY)}`;
    const hereHash = `#${sectionId(TO, "contact")}`;
    await goToHash(page, linkedHash);
    await goToHash(page, hereHash);
    await scrollAtRest(page);

    const clicked = await watchForEvent(page, "click");
    await themeRoot(page, TO)
      .getByRole("navigation", { name: "Sections" })
      .getByRole("link", { name: "Projects", exact: true })
      .click({ modifiers: ["ControlOrMeta"] });
    await clicked();
    expect(await currentHash(page)).toBe(hereHash);

    const stepped = await watchForEvent(page, "hashchange");
    await page.evaluate(() => history.back());
    await stepped();
    expect(await currentHash(page)).toBe(linkedHash);
    await scrollAtRest(page);

    // A pin would scroll the page after the section. Without one, it stays moved.
    const before = await sectionOffset(page, TO, KEY);
    await insertAboveSection(page, `height: ${SHIFT}px`);
    await frames(page, 4);
    await scrollAtRest(page);
    expect(
      Math.abs((await sectionOffset(page, TO, KEY)) - before - SHIFT),
    ).toBeLessThan(2);
  });
});

test.describe("a reload", () => {
  test("keeps the visitor's own scroll, and starts no pin", async ({
    page,
    browserName,
  }) => {
    await serveWithCss(page, tallSectionsCss());
    await page.goto(`/#${sectionId(TO, KEY)}`);
    await sceneSettled(page, TO);
    await pastPinSettling(page);
    await page.keyboard.press("Shift", { delay: 120 });
    await scrollOffTarget(page);
    const scrolled = await page.evaluate(() => window.scrollY);

    await page.reload();
    await expectShowing(page, TO);
    await sceneSettled(page, TO);
    await pastPinSettling(page);
    await scrollAtRest(page);
    // Playwright's WebKit restores no scroll on reload: it goes to the fragment
    // with or without this page's scripts, so only the pin can be checked there.
    if (browserName === "chromium") {
      expect(
        Math.abs((await page.evaluate(() => window.scrollY)) - scrolled),
      ).toBeLessThanOrEqual(2);
    }

    await scrollOffTarget(page);
    await expectPinEnded(page);
  });
});

test.describe("a switch during a smooth scroll", () => {
  // On the first show, the scene's state change re-pins and hides any drift, so
  // each theme here has already been shown once.
  for (const { from, to } of [
    { from: "interchange", to: "diorama" },
    { from: "pixel-depot", to: "interchange" },
  ] as const) {
    test(`${from} to ${to} holds the section on every frame of the second show`, async ({
      page,
    }) => {
      await serveWithCss(page, tallSectionsCss());
      await page.goto(`/${themeHash(from)}`);
      await sceneSettled(page, from);
      await pickThemeInPlace(page, to);
      await sceneSettled(page, to);
      await pickThemeInPlace(page, from);
      await expectShowing(page, from);
      await sceneSettled(page, from);
      await pastPinSettling(page);
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );

      const choice = await switcherChoice(page, to).elementHandle();
      const run = await page.evaluate(
        async ({ link, hash }) => {
          const nextFrame = () =>
            new Promise((resolve) => requestAnimationFrame(resolve));

          // A section link's smooth scroll, under way when the switch happens.
          location.hash = hash;
          const target = document.getElementById(hash.slice(1));
          for (
            let frame = 0;
            frame < 300 && window.scrollY < 1500;
            frame += 1
          ) {
            await nextFrame();
          }
          const distanceLeft = target?.getBoundingClientRect().top ?? 0;

          // In its own task, as a real click arrives. Inside a frame callback the
          // switch's instant scroll stops the animation and hides this bug.
          await new Promise<void>((resolve) =>
            setTimeout(() => {
              (link as HTMLElement | null)?.click();
              resolve();
            }),
          );
          const landedOn = document.getElementById(location.hash.slice(1));

          const offsets: number[] = [];
          for (let frame = 0; frame < 45; frame += 1) {
            await nextFrame();
            offsets.push(
              landedOn
                ? landedOn.getBoundingClientRect().top -
                    parseFloat(getComputedStyle(landedOn).scrollMarginTop)
                : Number.NaN,
            );
          }
          return { distanceLeft, hash: location.hash, offsets };
        },
        { link: choice, hash: `#${sectionId(from, "contact")}` },
      );

      // Otherwise the scroll had already finished, and this tested nothing.
      expect(run.distanceLeft).toBeGreaterThan(500);
      // The section the scroll had reached, moved over to the new theme.
      expect(SECTION_KEYS.map((key) => `#${sectionId(to, key)}`)).toContain(
        run.hash,
      );
      expect(
        Math.max(...run.offsets.map((offset) => Math.abs(offset))),
      ).toBeLessThanOrEqual(1.5);
    });
  }
});
