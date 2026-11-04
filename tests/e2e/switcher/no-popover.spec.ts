import { expect, type Page } from "@playwright/test";
import { THEME_HOOKS, type ThemeName } from "../../../src/scene/contract";
import {
  expectShowing,
  sceneSettled,
  switcherChoice,
  switcherToggle,
  test,
  themeRoot,
  THEMES,
} from "../selection/support";
import { LAYOUT_TOLERANCE, rectOf } from "./support";

test.describe.configure({ mode: "parallel" });

const WIDTHS = [320, 1280];

/** What carries `popover` here, since a browser that has `popover` hides the real one. */
const UNSUPPORTED_POPOVER_ATTRIBUTE = "data-unsupported-popover";

/**
 * `@supports` answers for the engine actually running, so its fallback block is opened
 * by hand. Then a browser drops any whole rule over a selector it cannot parse.
 */
function cssWithoutPopover(css: string): string {
  return css
    .replace(/@supports not selector\(:popover-open\)/g, "@media all")
    .replace(/[^{};]*:popover-open[^{]*\{[^}]*\}/g, "");
}

/**
 * Both browsers here support `popover`, so its traces are taken out of what they are
 * served and given to scripts. An older browser would keep the attribute and ignore
 * it, so it stays under another name, and the scripts look for that name instead.
 */
async function serveWithoutPopover(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const prototypes = [
      HTMLElement.prototype,
      HTMLButtonElement.prototype,
      HTMLInputElement.prototype,
    ] as unknown as Record<string, unknown>[];
    for (const prototype of prototypes) {
      for (const member of [
        "popover",
        "showPopover",
        "hidePopover",
        "togglePopover",
        "popoverTargetElement",
        "popoverTargetAction",
      ]) {
        delete prototype[member];
      }
    }

    const selectorMethods = [
      [Element.prototype, "matches"],
      [Element.prototype, "closest"],
      [Element.prototype, "querySelector"],
      [Element.prototype, "querySelectorAll"],
      [Document.prototype, "querySelector"],
      [Document.prototype, "querySelectorAll"],
    ] as unknown as [Record<string, (selector: string) => unknown>, string][];
    for (const [owner, method] of selectorMethods) {
      const original = owner[method]!;
      owner[method] = function (this: unknown, selector: string) {
        if (String(selector).includes(":popover-open")) {
          throw new DOMException(`Bad selector: ${selector}`, "SyntaxError");
        }
        return original.call(this, selector);
      };
    }
  });

  await page.route(
    (url) => url.pathname === "/" || /\.(css|js)$/.test(url.pathname),
    async (route) => {
      const response = await route.fetch();
      const contentType = response.headers()["content-type"] ?? "";
      if (contentType.includes("text/css")) {
        await route.fulfill({
          response,
          body: cssWithoutPopover(await response.text()),
        });
      } else if (contentType.includes("javascript")) {
        await route.fulfill({
          response,
          body: (await response.text()).replaceAll(
            "[popover]",
            `[${UNSUPPORTED_POPOVER_ATTRIBUTE}]`,
          ),
        });
      } else if (contentType.includes("text/html")) {
        const body = (await response.text())
          .replace(/ popovertarget="[^"]*"/g, "")
          .replace(/ popover="/g, ` ${UNSUPPORTED_POPOVER_ATTRIBUTE}="`)
          .replace(
            /(<style[^>]*>)([\s\S]*?)(<\/style>)/g,
            (_match, open: string, css: string, close: string) =>
              open + cssWithoutPopover(css) + close,
          );
        await route.fulfill({ response, body });
      } else {
        await route.fulfill({ response });
      }
    },
  );
}

/** By its effect on the header, so it holds however a list keeps out of the flow. */
async function expectListOutOfHeaderFlow(
  page: Page,
  theme: ThemeName,
): Promise<void> {
  const root = themeRoot(page, theme);
  const header = root.locator("header");
  const list = root.locator(`${THEME_HOOKS.themeSwitcher} ul`);
  const withList = await rectOf(header);

  await list.evaluate((element: HTMLElement) => {
    element.style.setProperty("display", "none", "important");
  });
  const withoutList = await rectOf(header);
  await list.evaluate((element: HTMLElement) => {
    element.style.removeProperty("display");
  });

  expect(Math.abs(withList.height - withoutList.height)).toBeLessThanOrEqual(
    LAYOUT_TOLERANCE,
  );
}

// The scene's chunks can still be on their way through the route when a test ends.
test.afterEach(({ page }) => page.unrouteAll({ behavior: "ignoreErrors" }));

// An uncaught error fails any of these by itself, through the `pageProblems` fixture.
test.describe("a browser without popover", () => {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test(`${theme} at ${width} px: the list keeps out of the header, and its links switch theme`, async ({
        page,
      }) => {
        const to = theme === "diorama" ? "pixel-depot" : "diorama";
        await page.setViewportSize({ width, height: 800 });
        await serveWithoutPopover(page);
        await page.goto(theme === "interchange" ? "/" : `/#${theme}`);
        await expectShowing(page, theme);
        await sceneSettled(page, theme);
        await expectListOutOfHeaderFlow(page, theme);

        await switcherToggle(page).click();
        await expectListOutOfHeaderFlow(page, theme);
        await switcherChoice(page, to).click();

        await expectShowing(page, to);
      });
    }
  }
});
