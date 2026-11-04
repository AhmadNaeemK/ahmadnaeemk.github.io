import type { Locator, Page } from "@playwright/test";
import { THEME_HOOKS, type ColorScheme } from "../../../src/scene/contract";
import { expect, root, test, toggle } from "../scene/helpers";
import { DESKTOP, DIORAMA, openDiorama, PHONE } from "./support";

const TOUCH_TARGET_PX = 44;
const SMALL_TARGET_PX = 24;

/** Out of the flow or under a neighbour, a target can measure right and still miss. */
async function expectPressableAcross(target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const reachable = await target.evaluate((element) => {
    const { left, right, top, bottom } = element.getBoundingClientRect();
    const inset = 1;
    return [
      [left + inset, top + inset],
      [right - inset, top + inset],
      [left + inset, bottom - inset],
      [right - inset, bottom - inset],
    ].every(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return hit !== null && (hit === element || element.contains(hit));
    });
  });
  expect(reachable).toBe(true);
}

for (const width of [320, PHONE.width, 768, DESKTOP.width]) {
  test.describe(`the train's controls at ${width} px`, () => {
    test.use({ viewport: { width, height: DESKTOP.height } });

    test("the toggle is a proper touch size, all of it pressable", async ({
      page,
    }) => {
      await openDiorama(page);
      const target = toggle(page, DIORAMA);

      const box = await target.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(TOUCH_TARGET_PX);
      await expectPressableAcross(target);
    });

    for (const { name, hook } of [
      { name: "speed", hook: THEME_HOOKS.speed },
      { name: "livery", hook: THEME_HOOKS.livery },
    ]) {
      test(`every ${name} button is big enough to press, all of it pressable`, async ({
        page,
      }) => {
        await openDiorama(page);
        const buttons = await root(page, DIORAMA).locator(hook).all();
        expect(buttons.length).toBeGreaterThan(0);

        for (const button of buttons) {
          const box = await button.boundingBox();
          expect(box?.height).toBeGreaterThanOrEqual(SMALL_TARGET_PX);
          expect(box?.width).toBeGreaterThanOrEqual(SMALL_TARGET_PX);
          await expectPressableAcross(button);
        }
      });
    }
  });
}

const pageToggle = (page: Page) =>
  root(page, DIORAMA).locator(THEME_HOOKS.colorSchemeToggle);

/** The toggle's words as they read on screen, and its accessible name. */
const toggleWording = (page: Page) =>
  pageToggle(page).evaluate((button: HTMLElement) => ({
    visible: button.innerText.replace(/\s+/g, " ").trim().toLowerCase(),
    name: (button.getAttribute("aria-label") ?? "").toLowerCase(),
  }));

/** Offers the opposite scheme, in words that sit inside its accessible name. */
const expectOffers = (page: Page, current: ColorScheme) =>
  expect
    .poll(async () => {
      const { visible, name } = await toggleWording(page);
      return {
        visible,
        nameHoldsVisible: name.includes(visible),
        nameOffers: name.includes(current === "dark" ? "light" : "dark"),
      };
    })
    .toEqual({
      visible: current === "dark" ? "light theme" : "dark theme",
      nameHoldsVisible: true,
      nameOffers: true,
    });

test.describe("the theme toggle's wording", () => {
  test.use({ viewport: DESKTOP });

  test("offers the other scheme and stays inside its name, as it is pressed", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openDiorama(page);
    await expectOffers(page, "light");

    await pageToggle(page).click();
    await expectOffers(page, "dark");
    await expect(pageToggle(page)).toHaveAttribute("aria-pressed", "true");

    await pageToggle(page).click();
    await expectOffers(page, "light");
    await expect(pageToggle(page)).toHaveAttribute("aria-pressed", "false");
  });

  test("starts right on a dark system, and follows a system change", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await openDiorama(page);
    await expectOffers(page, "dark");

    await page.emulateMedia({ colorScheme: "light" });
    await expectOffers(page, "light");
  });

  test("a scheme picked on an earlier visit reads right after a reload", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openDiorama(page);
    await pageToggle(page).click();
    await expectOffers(page, "dark");

    await page.reload();
    await expectOffers(page, "dark");
  });
});

test("on a phone the toggle has no words to show, and its name still says what it does", async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.emulateMedia({ colorScheme: "light" });
  await openDiorama(page);

  await expect(pageToggle(page)).toBeVisible();
  await expect(pageToggle(page)).toHaveAccessibleName(/dark/i);
  await pageToggle(page).click();
  await expect(pageToggle(page)).toHaveAccessibleName(/light/i);
});

test("the theme toggle keeps its width across a press, so the header does not shift", async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.emulateMedia({ colorScheme: "light" });
  await openDiorama(page);
  const widthNow = async () => (await pageToggle(page).boundingBox())?.width;
  const before = await widthNow();
  expect(before).toBeGreaterThan(0);

  await pageToggle(page).click();
  await expectOffers(page, "dark");
  expect(await widthNow()).toBe(before);

  await pageToggle(page).click();
  await expectOffers(page, "light");
  expect(await widthNow()).toBe(before);
});

/** A change of one channel by this much is one a person can see. */
const VISIBLE_CHANNEL_STEP = 32;
/** Enough for a text colour, an underline or a ring, and more than a stray pixel. */
const VISIBLE_SHARE_OF_BUTTON = 0.03;

/** What shows on a button with no pointer or focus on it. */
async function restingLook(page: Page, button: Locator): Promise<string> {
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  const shot = await button.screenshot({ animations: "disabled" });
  return `data:image/png;base64,${shot.toString("base64")}`;
}

/** The share of pixels that visibly differ between two looks at one button. */
const shareVisiblyDifferent = (page: Page, first: string, second: string) =>
  page.evaluate(
    async ({ urls, step }) => {
      const pixelsOf = async (url: string) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const surface = document.createElement("canvas");
        surface.width = image.naturalWidth;
        surface.height = image.naturalHeight;
        const context = surface.getContext("2d");
        if (!context) throw new Error("No 2D canvas context.");
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, surface.width, surface.height);
      };
      const [a, b] = await Promise.all(urls.map(pixelsOf));
      if (a.width !== b.width || a.height !== b.height) return 1;
      let different = 0;
      for (let i = 0; i < a.data.length; i += 4) {
        const channels = [0, 1, 2].map((c) =>
          Math.abs(a.data[i + c] - b.data[i + c]),
        );
        if (Math.max(...channels) >= step) different += 1;
      }
      return different / (a.width * a.height);
    },
    { urls: [first, second], step: VISIBLE_CHANNEL_STEP },
  );

for (const scheme of ["light", "dark"] as const) {
  test.describe(`the livery buttons in the ${scheme} scheme`, () => {
    test.use({ colorScheme: scheme, viewport: DESKTOP });

    test("the selected one looks different from when it is not selected", async ({
      page,
    }) => {
      await openDiorama(page);
      const liveries = root(page, DIORAMA).locator(THEME_HOOKS.livery);
      const chosen = root(page, DIORAMA).locator(
        `${THEME_HOOKS.livery}[aria-pressed="true"]`,
      );
      const other = root(page, DIORAMA)
        .locator(`${THEME_HOOKS.livery}:not([aria-pressed="true"])`)
        .first();
      expect(await liveries.count()).toBeGreaterThan(1);
      await expect(chosen).toHaveCount(1);
      // Held by position, because the two locators above follow the pressed state.
      const chosenId = await chosen.getAttribute("data-rail-livery");
      const otherId = await other.getAttribute("data-rail-livery");
      const button = (id: string | null) =>
        root(page, DIORAMA).locator(`[data-rail-livery="${id}"]`);

      const chosenWhenSelected = await restingLook(page, button(chosenId));
      const otherWhenNot = await restingLook(page, button(otherId));

      await button(otherId).click();
      await expect(button(otherId)).toHaveAttribute("aria-pressed", "true");
      const chosenWhenNot = await restingLook(page, button(chosenId));
      const otherWhenSelected = await restingLook(page, button(otherId));

      expect(
        await shareVisiblyDifferent(page, chosenWhenSelected, chosenWhenNot),
      ).toBeGreaterThan(VISIBLE_SHARE_OF_BUTTON);
      expect(
        await shareVisiblyDifferent(page, otherWhenSelected, otherWhenNot),
      ).toBeGreaterThan(VISIBLE_SHARE_OF_BUTTON);
    });
  });
}
