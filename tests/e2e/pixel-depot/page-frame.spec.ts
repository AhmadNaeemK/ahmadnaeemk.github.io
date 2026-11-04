import type { Page } from "@playwright/test";
import { sectionId, themeHash } from "../../../src/scene/contract";
import { expect, root, scrollPage, test } from "../scene/helpers";
import { THEME } from "./support";

const INSETS = { top: 44, left: 30, right: 30, bottom: 20 };
const SCROLLED_PAST_HERO = 900;

const header = (page: Page) => root(page, THEME).locator("header");

const headerTop = async (page: Page) =>
  (await header(page).boundingBox())?.y ?? Number.NaN;

test.describe("the sticky header and safe-area insets", () => {
  test("sits at the top of the page with no inset", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/${themeHash(THEME)}`);
    await scrollPage(page, SCROLLED_PAST_HERO);
    await expect.poll(() => headerTop(page)).toBe(0);
  });

  test.describe("with insets", () => {
    test.beforeEach(async ({ page, browserName }) => {
      test.skip(browserName !== "chromium", "Needs a Chromium CDP override.");
      const session = await page.context().newCDPSession(page);
      await session.send("Emulation.setSafeAreaInsetsOverride", {
        insets: INSETS,
      });
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(`/${themeHash(THEME)}`);
    });

    test("at the top of the page, the header stays clear of the scene", async ({
      page,
    }) => {
      await scrollPage(page, 0);
      const headerBox = await header(page).boundingBox();
      const sceneBox = await root(page, THEME).locator(".screen").boundingBox();
      if (!headerBox || !sceneBox) throw new Error("Nothing to measure.");
      expect(headerBox.y + headerBox.height).toBeLessThanOrEqual(sceneBox.y);
    });

    test("pins below the top inset once scrolled", async ({ page }) => {
      await scrollPage(page, SCROLLED_PAST_HERO);
      await expect.poll(() => headerTop(page)).toBe(INSETS.top);
    });

    test("a section link lands its heading clear of the pinned header", async ({
      page,
    }) => {
      await header(page)
        .locator(`a[href="#${sectionId(THEME, "work")}"]`)
        .click();
      const heading = root(page, THEME)
        .locator(`#${sectionId(THEME, "work")}`)
        .locator("h2")
        .first();
      await expect.poll(() => headerTop(page)).toBe(INSETS.top);
      await expect
        .poll(async () => {
          const headingBox = await heading.boundingBox();
          const headerBox = await header(page).boundingBox();
          if (!headingBox || !headerBox) return Number.NaN;
          return headingBox.y - (headerBox.y + headerBox.height);
        })
        .toBeGreaterThanOrEqual(0);
    });

    test("keeps the header's content out of the side insets", async ({
      page,
    }) => {
      // Narrow enough that the centred content has no margin, so only the gutter holds it in.
      await page.setViewportSize({ width: 600, height: 720 });
      const box = await header(page).locator("a").first().boundingBox();
      expect(box?.x).toBeGreaterThanOrEqual(INSETS.left);
    });
  });
});

test.describe("in-page links", () => {
  test("every one targets a c- section in this theme", async ({ page }) => {
    await page.goto(`/${themeHash(THEME)}`);
    const links = await root(page, THEME)
      .locator('a[href^="#"]:not([data-theme-switcher] a)')
      .evaluateAll((anchors) =>
        anchors.map((anchor) => {
          const href = anchor.getAttribute("href") ?? "";
          const target = document.getElementById(href.slice(1));
          const themeRoot = anchor.closest("[data-rail-theme-root]");
          return {
            href,
            inThisTheme: Boolean(target && themeRoot?.contains(target)),
          };
        }),
      );
    expect(links.length).toBeGreaterThan(5);
    for (const { href, inThisTheme } of links) {
      expect(href).toMatch(/^#c-/);
      expect(inThisTheme, href).toBe(true);
    }
  });
});
