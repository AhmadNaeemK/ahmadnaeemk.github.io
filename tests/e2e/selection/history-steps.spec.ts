import { expect, type Page } from "@playwright/test";
import { sectionId, type SectionKey } from "../../../src/scene/contract";
import {
  currentHash,
  expectSectionAtTop,
  expectShowing,
  frames,
  sceneSettled,
  scrollAtRest,
  scrollToSection,
  serveWithCss,
  tallSectionsCss,
  test,
  watchForEvent,
  goToHash,
  pastPinSettling,
} from "./support";

declare global {
  interface Window {
    testDropPopstate?: boolean;
  }
}

// tallSectionsCss gives each theme its own section heights, so a position saved for
// one theme lands on a different section in the other. That is how the section used
// to walk in WebKit: work, projects, skills, contact, one more per step.
const CYCLES = 4;

/** A first entry at `open`, with its scene started and nothing left moving. */
async function openOnInterchange(page: Page, open: string): Promise<void> {
  await serveWithCss(page, tallSectionsCss());
  await page.goto(open);
  await expectShowing(page, "interchange");
  await sceneSettled(page, "interchange");
}

async function goToDiorama(page: Page): Promise<void> {
  await goToHash(page, "#diorama");
  await expectShowing(page, "diorama");
  await sceneSettled(page, "diorama");
  await pastPinSettling(page);
}

async function steppedBackToInterchange(page: Page): Promise<void> {
  await page.goBack();
  await expectShowing(page, "interchange");
  await sceneSettled(page, "interchange");
  await scrollAtRest(page);
}

async function steppedForwardToDiorama(page: Page): Promise<void> {
  await page.goForward();
  await expectShowing(page, "diorama");
  await sceneSettled(page, "diorama");
  await scrollAtRest(page);
}

test.describe.configure({ mode: "parallel" });

test.describe("back and forward across theme hashes", () => {
  const STARTS: { open: string; key: SectionKey }[] = [
    { open: "/#interchange", key: "work" },
    { open: "/#interchange", key: "skills" },
    { open: "/", key: "work" },
    { open: "/", key: "projects" },
  ];

  for (const { open, key } of STARTS) {
    test(`stays on ${key} over several cycles from ${open}`, async ({
      page,
    }) => {
      await openOnInterchange(page, open);
      await scrollToSection(page, "interchange", key);
      await frames(page);
      await goToDiorama(page);
      await expectSectionAtTop(page, "diorama", key);

      for (let cycle = 0; cycle < CYCLES; cycle += 1) {
        await steppedBackToInterchange(page);
        await expectSectionAtTop(page, "interchange", key);
        await steppedForwardToDiorama(page);
        await expectSectionAtTop(page, "diorama", key);
      }
    });

    test(`the theme scrolled keeps ${key} when the first entry never scrolled, from ${open}`, async ({
      page,
    }) => {
      await openOnInterchange(page, open);
      await goToDiorama(page);
      await scrollToSection(page, "diorama", key);
      await frames(page);

      for (let cycle = 0; cycle < CYCLES; cycle += 1) {
        // Interchange's own entry was saved at the top of the page, so what it reads
        // is not asserted: the section to keep is the one the visitor scrolled to.
        await steppedBackToInterchange(page);
        await steppedForwardToDiorama(page);
        await expectSectionAtTop(page, "diorama", key);
      }
    });
  }
});

test.describe("a section hash on a history step", () => {
  test("keeps its own key, not the section read as the step began", async ({
    page,
  }) => {
    await openOnInterchange(page, `/#${sectionId("interchange", "work")}`);
    await pastPinSettling(page);
    await goToHash(page, `#${sectionId("diorama", "projects")}`);
    await expectShowing(page, "diorama");
    await sceneSettled(page, "diorama");

    for (let cycle = 0; cycle < CYCLES; cycle += 1) {
      await steppedBackToInterchange(page);
      await expectSectionAtTop(page, "interchange", "work");
      expect(await currentHash(page)).toBe(
        `#${sectionId("interchange", "work")}`,
      );
      await steppedForwardToDiorama(page);
      await expectSectionAtTop(page, "diorama", "projects");
      expect(await currentHash(page)).toBe(
        `#${sectionId("diorama", "projects")}`,
      );
    }
  });

  test("hands its key to the theme hash the next step lands on", async ({
    page,
  }) => {
    await openOnInterchange(page, `/#${sectionId("interchange", "work")}`);
    await pastPinSettling(page);
    await scrollToSection(page, "interchange", "skills");
    await frames(page);
    await goToDiorama(page);
    await expectSectionAtTop(page, "diorama", "skills");

    await steppedBackToInterchange(page);
    await expectSectionAtTop(page, "interchange", "work");
    await steppedForwardToDiorama(page);
    await expectSectionAtTop(page, "diorama", "work");
  });
});

test.describe("after a history step", () => {
  test("a typed hash uses the live position, not the step's", async ({
    page,
  }) => {
    await openOnInterchange(page, "/#interchange");
    await scrollToSection(page, "interchange", "work");
    await frames(page);
    await goToDiorama(page);
    await steppedBackToInterchange(page);
    await expectSectionAtTop(page, "interchange", "work");

    await scrollToSection(page, "interchange", "skills");
    await frames(page);
    await goToHash(page, "#pixel-depot");
    await expectShowing(page, "pixel-depot");
    await sceneSettled(page, "pixel-depot");
    await expectSectionAtTop(page, "pixel-depot", "skills");
  });
});

test.describe("a popstate with no hashchange", () => {
  /** Leaves interchange at `work` having read a step that changed no hash. */
  async function poppedWithoutHashchange(page: Page): Promise<void> {
    await openOnInterchange(page, "/#interchange");
    await scrollToSection(page, "interchange", "work");
    await frames(page);

    const popped = await watchForEvent(page, "popstate");
    await page.evaluate(() => {
      history.pushState(history.state, "", location.href);
      history.back();
    });
    await popped();
    await frames(page);
    await expectShowing(page, "interchange");
  }

  test("leaves nothing for the next hash to reuse", async ({ page }) => {
    await poppedWithoutHashchange(page);
    await scrollToSection(page, "interchange", "skills");
    await frames(page);

    await goToHash(page, "#diorama");
    await expectShowing(page, "diorama");
    await sceneSettled(page, "diorama");
    await expectSectionAtTop(page, "diorama", "skills");
  });

  test("does not stop the next history step reading its own section", async ({
    page,
  }) => {
    await openOnInterchange(page, "/#interchange");
    await scrollToSection(page, "interchange", "work");
    await frames(page);
    await goToDiorama(page);

    const popped = await watchForEvent(page, "popstate");
    await page.evaluate(() => {
      history.pushState(history.state, "", location.href);
      history.back();
    });
    await popped();
    await frames(page);

    await steppedBackToInterchange(page);
    await expectSectionAtTop(page, "interchange", "work");
    await steppedForwardToDiorama(page);
    await expectSectionAtTop(page, "diorama", "work");
  });

  test("leaves nothing for a hash whose own popstate never arrives", async ({
    page,
  }) => {
    // Both browsers here fire popstate before every fragment navigation's
    // hashchange, which replaces the old reading. Only a navigation with no popstate
    // can meet that reading, so this drops the event before the page hears it.
    await page.addInitScript(() => {
      window.addEventListener(
        "popstate",
        (event) => {
          if (window.testDropPopstate) event.stopImmediatePropagation();
        },
        { capture: true },
      );
    });
    await poppedWithoutHashchange(page);
    await scrollToSection(page, "interchange", "skills");
    await frames(page);

    await page.evaluate(() => {
      window.testDropPopstate = true;
      location.hash = "#diorama";
    });
    await expectShowing(page, "diorama");
    await sceneSettled(page, "diorama");
    await expectSectionAtTop(page, "diorama", "skills");
  });
});
