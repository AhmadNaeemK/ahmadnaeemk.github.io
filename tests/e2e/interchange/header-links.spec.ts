import { type Page } from "@playwright/test";
import {
  NAV_SECTIONS,
  sectionId,
  THEME_ATTRIBUTE,
  THEME_HOOKS,
} from "../../../src/scene/contract";
import { expect, openScenePage, root, test } from "../scene/helpers";
import { scrollAtRest } from "../selection/support";
import { content, THEME } from "./support";

const SECTION_ID = /^#a-[a-z]+$/;
const PIXEL_FRACTIONS = 0.5;
const VIEWPORT_HEIGHT = 800;

const NARROWEST = 320;

async function siteMark(page: Page) {
  const { profile } = await content;
  return root(page, THEME).getByRole("link", {
    name: `${profile.name}, back to top`,
    exact: true,
  });
}

const expectThemeKept = (page: Page) =>
  expect(page.locator("html")).toHaveAttribute(THEME_ATTRIBUTE, THEME);

for (const width of [1280, 921, 920, 390]) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: VIEWPORT_HEIGHT } });

    test("the site mark's name is the whole phrase, and it can be seen", async ({
      page,
    }) => {
      await openScenePage(page);
      await expect(await siteMark(page)).toBeVisible();
    });

    test("the site mark brings the map back clear of the header, in this theme", async ({
      page,
    }) => {
      await openScenePage(page);
      const themeRoot = root(page, THEME);
      await page.evaluate(() =>
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "instant",
        }),
      );
      await themeRoot
        .locator(`header a[href="#${sectionId(THEME, "top")}"]`)
        .click();
      await scrollAtRest(page);

      const headerBox = await themeRoot.locator("header").first().boundingBox();
      const mapBox = await themeRoot.locator(THEME_HOOKS.canvas).boundingBox();
      if (!headerBox || !mapBox) throw new Error("Nothing to compare.");
      expect(mapBox.y).toBeGreaterThanOrEqual(
        headerBox.y + headerBox.height - PIXEL_FRACTIONS,
      );
      await expect(themeRoot.locator(THEME_HOOKS.canvas)).toBeInViewport();
      await expectThemeKept(page);
    });
  });
}

test("every in-page link in the theme, bar the switcher, targets a section it has", async ({
  page,
}) => {
  await openScenePage(page);
  const links = await root(page, THEME).evaluate((themeRoot, switcher) => {
    const samePage = (link: HTMLAnchorElement) =>
      link.pathname === location.pathname && link.origin === location.origin;
    return [...themeRoot.querySelectorAll<HTMLAnchorElement>("a[href]")]
      .filter((link) => samePage(link) && !link.closest(switcher))
      .map((link) => ({
        href: link.getAttribute("href") ?? "",
        targetInTheme: themeRoot.contains(
          document.getElementById(link.hash.slice(1)),
        ),
      }));
  }, THEME_HOOKS.themeSwitcher);

  // The header's links, the site mark and the hero's "Get in touch".
  expect(links.length).toBeGreaterThanOrEqual(NAV_SECTIONS.length + 2);
  for (const { href, targetInTheme } of links) {
    expect(href).toMatch(SECTION_ID);
    expect(targetInTheme, `${href} should exist in the theme`).toBe(true);
  }
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 920, height: VIEWPORT_HEIGHT },
  { width: 390, height: 844 },
  { width: NARROWEST, height: 640 },
]) {
  test.describe(`at ${viewport.width} px`, () => {
    test.use({ viewport });

    test("each header link lands its section's heading clear of the sticky header", async ({
      page,
    }) => {
      await openScenePage(page);
      const themeRoot = root(page, THEME);
      const nav = themeRoot.getByRole("navigation", { name: "Sections" });
      const header = themeRoot.locator("header").first();

      for (const { key, label } of NAV_SECTIONS) {
        await nav.getByRole("link", { name: label, exact: true }).click();
        await scrollAtRest(page);
        const heading = page.locator(`[id="${sectionId(THEME, key)}"] h2`);
        await expect(heading).toHaveText(new RegExp(label));
        const headerBox = await header.boundingBox();
        const headingBox = await heading.boundingBox();
        if (!headerBox || !headingBox) throw new Error("Nothing to compare.");
        expect(
          headingBox.y,
          `${label}'s heading should clear the header`,
        ).toBeGreaterThanOrEqual(
          headerBox.y + headerBox.height - PIXEL_FRACTIONS,
        );
        expect(headingBox.y).toBeLessThan(viewport.height);
        await expectThemeKept(page);
      }
    });
  });
}

test.describe("the hero's own link", () => {
  test("Get in touch goes to Contact, in this theme", async ({ page }) => {
    await openScenePage(page);
    await root(page, THEME)
      .getByRole("link", { name: "Get in touch", exact: true })
      .click();
    await scrollAtRest(page);
    await expect(
      page.locator(`[id="${sectionId(THEME, "contact")}"] h2`),
    ).toBeInViewport();
    await expectThemeKept(page);
  });
});
