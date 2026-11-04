import { expect, type Page } from "@playwright/test";
import {
  STORAGE_KEYS,
  THEME_ATTRIBUTE,
  type ThemeName,
} from "../../../src/scene/contract";
import {
  expectShowing,
  fontStylesheetUrl,
  pickTheme,
  seedStorage,
  test,
} from "./support";

function requestCount(requests: string[], theme: ThemeName): number {
  return requests.filter((url) => url === fontStylesheetUrl(theme)).length;
}

async function writeAttribute(page: Page, theme: ThemeName): Promise<void> {
  await page.evaluate(
    ([attribute, name]) =>
      document.documentElement.setAttribute(attribute, name),
    [THEME_ATTRIBUTE, theme],
  );
  await expectShowing(page, theme);
}

test.describe("font stylesheets", () => {
  test("only the showing theme's is requested on load", async ({
    page,
    fontRequests,
  }) => {
    await page.goto("/#diorama");
    await expect.poll(() => requestCount(fontRequests, "diorama")).toBe(1);
    expect(fontRequests).toEqual([fontStylesheetUrl("diorama")]);
  });

  test("a saved theme is what gets requested, not the default", async ({
    page,
    fontRequests,
  }) => {
    await seedStorage(page, { [STORAGE_KEYS.theme]: "pixel-depot" });
    await page.goto("/");
    await expect.poll(() => requestCount(fontRequests, "pixel-depot")).toBe(1);
    expect(fontRequests).toEqual([fontStylesheetUrl("pixel-depot")]);
  });

  test("each is requested once, the first time its theme shows", async ({
    page,
    fontRequests,
  }) => {
    await page.goto("/");
    await expect.poll(() => requestCount(fontRequests, "interchange")).toBe(1);

    await pickTheme(page, "diorama");
    await expect.poll(() => requestCount(fontRequests, "diorama")).toBe(1);
    expect(requestCount(fontRequests, "pixel-depot")).toBe(0);

    await pickTheme(page, "interchange");
    await expectShowing(page, "interchange");
    await pickTheme(page, "diorama");
    await expectShowing(page, "diorama");

    // The last new theme comes after any repeat would have, so this proves there were none.
    await pickTheme(page, "pixel-depot");
    await expect.poll(() => requestCount(fontRequests, "pixel-depot")).toBe(1);
    expect(requestCount(fontRequests, "interchange")).toBe(1);
    expect(requestCount(fontRequests, "diorama")).toBe(1);
  });

  test("a direct attribute write is enough, and repeats nothing", async ({
    page,
    fontRequests,
  }) => {
    await page.goto("/");
    await expect.poll(() => requestCount(fontRequests, "interchange")).toBe(1);

    await writeAttribute(page, "diorama");
    await expect.poll(() => requestCount(fontRequests, "diorama")).toBe(1);

    await writeAttribute(page, "interchange");
    await writeAttribute(page, "diorama");
    await writeAttribute(page, "pixel-depot");
    await expect.poll(() => requestCount(fontRequests, "pixel-depot")).toBe(1);
    expect(requestCount(fontRequests, "interchange")).toBe(1);
    expect(requestCount(fontRequests, "diorama")).toBe(1);
  });
});
