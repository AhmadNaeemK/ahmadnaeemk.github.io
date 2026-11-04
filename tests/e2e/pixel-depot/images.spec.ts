import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sectionId, themeHash } from "../../../src/scene/contract";
import { expect, openScenePage, root, showTheme, test } from "../scene/helpers";
import { THEME } from "./support";

const PORTRAIT_FILE = resolve("src/content/assets/photos/portrait-px.png");
const PORTRAIT_REQUEST = /portrait-px/;

test.describe("the pixel portrait", () => {
  test("is the file itself in a plain lazy img", async ({ page }) => {
    await page.goto(`/${themeHash(THEME)}`);
    const portrait = root(page, THEME).locator('img[src*="portrait-px"]');
    await expect(portrait).toHaveAttribute("loading", "lazy");
    const src = await portrait.getAttribute("src");
    expect(src).not.toContain("/_image");

    await portrait.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        portrait.evaluate((image: HTMLImageElement) => [
          image.naturalWidth,
          image.naturalHeight,
        ]),
      )
      .toEqual([40, 50]);
    const served = await page.request.get(src ?? "");
    expect(served.ok()).toBe(true);
    expect(
      Buffer.compare(await served.body(), readFileSync(PORTRAIT_FILE)),
    ).toBe(0);
  });
});

test.describe("images on the page", () => {
  test("the portrait is not fetched while Interchange shows, until this theme does", async ({
    page,
  }) => {
    const portraitRequests: string[] = [];
    page.on("request", (request) => {
      if (PORTRAIT_REQUEST.test(request.url())) {
        portraitRequests.push(request.url());
      }
    });

    await openScenePage(page);
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForLoadState("networkidle");
    expect(portraitRequests).toEqual([]);

    await showTheme(page, THEME);
    await root(page, THEME)
      .locator('img[src*="portrait-px"]')
      .scrollIntoViewIfNeeded();
    await expect.poll(() => portraitRequests.length).toBeGreaterThan(0);
  });

  test("the contact photo leaves no stray gap below it, beyond its margins", async ({
    page,
  }) => {
    await page.goto(`/${themeHash(THEME)}`);
    const { gap, margins } = await root(page, THEME)
      .locator(`#${sectionId(THEME, "contact")} img`)
      .first()
      .evaluate((photo) => {
        const next = photo.nextElementSibling;
        if (!next) throw new Error("Nothing follows the contact photo.");
        const marginOf = (element: Element, side: "Bottom" | "Top") =>
          Number.parseFloat(getComputedStyle(element)[`margin${side}`]);
        return {
          gap:
            next.getBoundingClientRect().top -
            photo.getBoundingClientRect().bottom,
          margins: Math.max(marginOf(photo, "Bottom"), marginOf(next, "Top")),
        };
      });
    expect(gap).toBeCloseTo(margins, 0);
  });

  test("none is inlined into the HTML", async ({ page }) => {
    const html = await (await page.request.get("/")).text();
    expect(html).not.toContain("data:image");
  });
});
