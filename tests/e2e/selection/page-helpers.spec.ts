import { expect, type Page } from "@playwright/test";
import { themeHash } from "../../../src/scene/contract";
import { test, THEMES, themeRoot } from "./support";

declare global {
  interface Window {
    copiedText?: string;
  }
}

function stubClipboard(page: Page, outcome: "accepts" | "refuses") {
  return page.addInitScript((result) => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        async writeText(text: string) {
          if (result === "refuses")
            throw new DOMException("No", "NotAllowedError");
          window.copiedText = text;
        },
      },
    });
  }, outcome);
}

test.describe("year", () => {
  test("every data-year element gets the current year, in all themes", async ({
    page,
  }) => {
    // Markup already says this year, so only a year it cannot say proves the write.
    await page.clock.setFixedTime(new Date("2031-06-15T12:00:00Z"));
    await page.goto("/");
    const years = page.locator("[data-year]");
    expect(await years.count()).toBeGreaterThanOrEqual(THEMES.length);
    await expect
      .poll(async () => new Set(await years.allTextContents()))
      .toEqual(new Set(["2031"]));
  });
});

test.describe("copy email", () => {
  for (const theme of THEMES) {
    test(`copies the address in ${theme}`, async ({ page }) => {
      await stubClipboard(page, "accepts");
      await page.goto(`/${themeHash(theme)}`);
      const button = themeRoot(page, theme).locator("[data-copy]").first();
      const label = button.locator("[data-copy-label]");
      const resting = await label.textContent();
      await button.click();
      await expect(label).not.toHaveText(resting ?? "");
      expect(await page.evaluate(() => window.copiedText)).toBe(
        await button.getAttribute("data-copy"),
      );
    });

    test(`selects the address for a manual copy in ${theme} when refused`, async ({
      page,
    }) => {
      await stubClipboard(page, "refuses");
      await page.goto(`/${themeHash(theme)}`);
      const root = themeRoot(page, theme);
      const button = root.locator("[data-copy]").first();
      const label = button.locator("[data-copy-label]");
      const resting = await label.textContent();
      await button.click();
      await expect(label).not.toHaveText(resting ?? "");
      await expect(label).not.toHaveText("Copied");
      const address = await root
        .locator("[data-copy-target]")
        .first()
        .textContent();
      expect(await page.evaluate(() => getSelection()?.toString())).toBe(
        address,
      );
    });
  }

  for (const presses of [1, 2]) {
    test(`the label returns to rest after ${presses} press(es)`, async ({
      page,
    }) => {
      await stubClipboard(page, "accepts");
      await page.goto("/");
      const button = themeRoot(page, "interchange")
        .locator("[data-copy]")
        .first();
      const label = button.locator("[data-copy-label]");
      const resting = await label.textContent();
      for (let press = 0; press < presses; press += 1) {
        await button.click();
        await expect(label).not.toHaveText(resting ?? "");
      }
      await expect(label).toHaveText(resting ?? "");
    });
  }
});

test.describe("CV link", () => {
  for (const theme of THEMES) {
    test(`downloads a PDF that exists in ${theme}`, async ({ page }) => {
      await page.goto(`/${themeHash(theme)}`);
      const link = themeRoot(page, theme).locator("[data-cv]:visible").first();
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("download", /.*/);
      const response = await page.request.get(
        (await link.getAttribute("href")) ?? "",
      );
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("pdf");
    });
  }
});
