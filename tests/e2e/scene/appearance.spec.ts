import type { Page } from "@playwright/test";
import { THEME_NAMES, type ThemeName } from "../../../src/scene/contract";
import {
  canvasFingerprint,
  canvasPalette,
  countSceneCalls,
  drawCount,
  expect,
  expectDrawsStop,
  expectNoDraws,
  instrumentScenes,
  loadFontFace,
  makePageTall,
  openScenePage,
  scrollCanvasOffScreen,
  sceneCalls,
  scrollPage,
  setColorScheme,
  showTheme,
  test,
  waitFrames,
} from "./helpers";

test.describe("colours", () => {
  for (const theme of THEME_NAMES) {
    test(`${theme} takes a scheme change while it runs, from the attribute and from the system`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: "light" });
      await openScenePage(page);
      await showTheme(page, theme);
      await waitFrames(page, 3);
      const light = await canvasPalette(page, theme);

      await setColorScheme(page, "dark");
      await expect.poll(() => canvasPalette(page, theme)).not.toEqual(light);
      const dark = await canvasPalette(page, theme);

      await setColorScheme(page, null);
      await expect.poll(() => canvasPalette(page, theme)).not.toEqual(dark);

      await page.emulateMedia({ colorScheme: "dark" });
      await expect.poll(() => canvasPalette(page, theme)).not.toEqual(light);

      await page.emulateMedia({ colorScheme: "light" });
      await expect.poll(() => canvasPalette(page, theme)).not.toEqual(dark);
    });
  }

  test("a picked scheme wins over a system change", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openScenePage(page);
    await setColorScheme(page, "dark");
    await waitFrames(page, 3);
    const dark = await canvasPalette(page, "interchange");

    await setColorScheme(page, "light");
    await expect
      .poll(() => canvasPalette(page, "interchange"))
      .not.toEqual(dark);

    await page.emulateMedia({ colorScheme: "dark" });
    await waitFrames(page, 10);

    expect(await canvasPalette(page, "interchange")).not.toEqual(dark);
  });

  test("a theme shown after a scheme change draws its first frame in the new colours", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openScenePage(page);
    await showTheme(page, "diorama");
    await waitFrames(page, 3);
    const dioramaLight = await canvasPalette(page, "diorama");
    await setColorScheme(page, "dark");
    await expect
      .poll(() => canvasPalette(page, "diorama"))
      .not.toEqual(dioramaLight);
    const dioramaDark = await canvasPalette(page, "diorama");

    await showTheme(page, "interchange");
    await setColorScheme(page, "light");
    await waitFrames(page, 3);

    await showTheme(page, "diorama");
    expect(await canvasPalette(page, "diorama")).not.toEqual(dioramaDark);
  });

  test("a scheme change off-screen repaints once, so the canvas is right when scrolled back", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openScenePage(page);
    await makePageTall(page);
    await waitFrames(page, 3);
    const light = await canvasPalette(page, "interchange");
    await scrollCanvasOffScreen(page, "interchange");
    await expectDrawsStop(page, "interchange");

    const before = await drawCount(page, "interchange");
    await setColorScheme(page, "dark");

    await expect
      .poll(() => canvasPalette(page, "interchange"))
      .not.toEqual(light);
    await expectNoDraws(page, "interchange");
    expect((await drawCount(page, "interchange")) - before).toBe(1);
  });
});

test.describe("showing a scene", () => {
  for (const theme of THEME_NAMES) {
    test(`${theme} shows no blank frame: it has drawn by the end of the task that selects it`, async ({
      page,
    }) => {
      await openScenePage(page);
      await showTheme(page, theme);
      await waitFrames(page, 3);
      if (theme !== "interchange") await showTheme(page, "interchange");
      else await showTheme(page, "diorama");

      const painted = await page.evaluate(async (name) => {
        const element = document.querySelector<HTMLCanvasElement>(
          `[data-rail-theme-root="${name}"] [data-rail-canvas]`,
        );
        const draws = window.__sceneSpy.draws[name] ?? 0;
        document.documentElement.setAttribute("data-rail-theme", name);
        await Promise.resolve();
        await Promise.resolve();
        const context = element?.getContext("2d");
        if (!element || !context) return null;
        const { data } = context.getImageData(
          0,
          0,
          element.width,
          element.height,
        );
        return {
          drew: (window.__sceneSpy.draws[name] ?? 0) - draws,
          hasPixels: data.some((value, index) => index % 4 === 3 && value > 0),
        };
      }, theme);

      expect(painted).toEqual({ drew: 1, hasPixels: true });
    });
  }

  test("text keeps rolling for a reduced-motion visitor, with the train stopped", async ({
    page,
  }) => {
    await openScenePage(page, { reducedMotion: true });
    await waitFrames(page, 3);
    const first = await canvasFingerprint(page, "interchange");

    await expect
      .poll(() => canvasFingerprint(page, "interchange"))
      .not.toBe(first);
  });
});

test.describe("fonts", () => {
  const fontsReady = (page: Page, theme: ThemeName) =>
    countSceneCalls(page, theme, "onFontsReady");

  test("the showing scene hears of a late font once, at its next frame", async ({
    page,
  }) => {
    await instrumentScenes(page);
    await openScenePage(page);
    await waitFrames(page, 3);
    expect(await fontsReady(page, "interchange")).toBe(0);

    await loadFontFace(page, "Late Font");

    await expect.poll(() => fontsReady(page, "interchange")).toBe(1);
    await waitFrames(page, 10);
    expect(await fontsReady(page, "interchange")).toBe(1);
  });

  test("a scene does not hear of fonts that loaded before it was created", async ({
    page,
  }) => {
    await instrumentScenes(page);
    await openScenePage(page);
    await loadFontFace(page, "Early Font");
    await waitFrames(page, 3);

    await showTheme(page, "diorama");
    await waitFrames(page, 5);

    expect(await fontsReady(page, "diorama")).toBe(0);
  });

  test("a hidden scene hears of a font when it is next shown, before that first draw, and not before", async ({
    page,
  }) => {
    await instrumentScenes(page);
    await openScenePage(page);
    await showTheme(page, "diorama");
    await waitFrames(page, 3);

    await loadFontFace(page, "Font While Hidden");
    await expect.poll(() => fontsReady(page, "diorama")).toBe(1);
    await waitFrames(page, 5);
    expect(await fontsReady(page, "interchange")).toBe(0);

    const callsBefore = (await sceneCalls(page, "interchange")).length;
    await showTheme(page, "interchange");
    await expect.poll(() => fontsReady(page, "interchange")).toBe(1);

    const callsSince = (await sceneCalls(page, "interchange")).slice(
      callsBefore,
    );
    expect(callsSince.indexOf("onFontsReady")).toBeLessThan(
      callsSince.indexOf("draw"),
    );
  });

  test("an off-screen scene hears of a font when it next ticks", async ({
    page,
  }) => {
    await instrumentScenes(page);
    await openScenePage(page);
    await makePageTall(page);
    await scrollCanvasOffScreen(page, "interchange");
    await expectDrawsStop(page, "interchange");

    await loadFontFace(page, "Font Off Screen");
    await waitFrames(page, 10);
    expect(await fontsReady(page, "interchange")).toBe(0);

    await scrollPage(page, 0);
    await expect.poll(() => fontsReady(page, "interchange")).toBe(1);
  });
});
