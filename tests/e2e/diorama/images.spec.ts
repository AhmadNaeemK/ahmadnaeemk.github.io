import type { Page, Route } from "@playwright/test";
import { themeHash, THEME_ROOT_ATTRIBUTE } from "../../../src/scene/contract";
import {
  addSceneSpy,
  expect,
  root,
  scrollPage,
  selectTheme,
  test,
  waitFrames,
} from "../scene/helpers";
import {
  DESKTOP,
  DIORAMA,
  expectSceneState,
  LOADED_MACHINE_TIMEOUT_MS,
} from "./support";

test.use({ viewport: DESKTOP });

const imageUrl = (src: string) =>
  new URL(src, "http://origin.invalid").pathname;

interface ImageFacts {
  readonly src: string;
  readonly width: string | null;
  readonly height: string | null;
  readonly loading: string | null;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
}

const imagesOf = (page: Page, theme: string): Promise<ImageFacts[]> =>
  page
    .locator(`[${THEME_ROOT_ATTRIBUTE}="${theme}"] img`)
    .evaluateAll((images: HTMLImageElement[]) =>
      images.map((image) => ({
        src: image.getAttribute("src") ?? "",
        width: image.getAttribute("width"),
        height: image.getAttribute("height"),
        loading: image.getAttribute("loading"),
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      })),
    );

/** Walks the whole page, so every lazy image that could load gets its chance. */
async function scrollThroughPage(page: Page): Promise<void> {
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  const step = DESKTOP.height / 2;
  for (let top = 0; top < height + step; top += step) {
    await scrollPage(page, top);
    await waitFrames(page, 1);
  }
}

test.describe("Diorama's images", () => {
  test("none is requested while the theme is hidden, however far the visitor scrolls", async ({
    page,
  }) => {
    const requested: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "image") {
        requested.push(new URL(request.url()).pathname);
      }
    });
    await addSceneSpy(page);
    await page.goto("/");
    await expectSceneState(page, "interchange", "running");
    await scrollThroughPage(page);
    await waitFrames(page, 5);

    const hidden = await imagesOf(page, DIORAMA);
    expect(hidden.length).toBeGreaterThan(0);
    // Another theme may show the same file, which is its own request and not this one.
    const showingElsewhere = new Set(
      (await imagesOf(page, "interchange")).map(({ src }) => imageUrl(src)),
    );
    const onlyDiorama = hidden
      .map(({ src }) => imageUrl(src))
      .filter((url) => !showingElsewhere.has(url));
    expect(requested.filter((url) => onlyDiorama.includes(url))).toEqual([]);
    expect(hidden.map(({ naturalWidth }) => naturalWidth)).toEqual(
      hidden.map(() => 0),
    );
  });

  test("all are files that load, with a width and height that match, once shown", async ({
    page,
  }) => {
    const failed: string[] = [];
    page.on("response", (response) => {
      if (
        response.request().resourceType() === "image" &&
        !response.ok() &&
        response.status() !== 304
      ) {
        failed.push(`${response.status()} ${response.url()}`);
      }
    });
    await addSceneSpy(page);
    await page.goto(`/${themeHash(DIORAMA)}`);
    await expectSceneState(page, DIORAMA, "running");
    await scrollThroughPage(page);

    await expect
      .poll(
        async () =>
          (await imagesOf(page, DIORAMA)).filter(
            ({ naturalWidth }) => naturalWidth === 0,
          ),
        { timeout: LOADED_MACHINE_TIMEOUT_MS },
      )
      .toEqual([]);
    expect(failed).toEqual([]);

    const images = await imagesOf(page, DIORAMA);
    expect(images.length).toBeGreaterThan(0);
    for (const {
      src,
      width,
      height,
      loading,
      naturalWidth,
      naturalHeight,
    } of images) {
      expect(src, "images are files, not data URIs").not.toMatch(/^data:/);
      expect(loading, src).toBe("lazy");
      expect(Number(width), `${src} width`).toBeGreaterThan(0);
      expect(Number(height), `${src} height`).toBeGreaterThan(0);
      expect(Number(width) / Number(height), `${src} shape`).toBeCloseTo(
        naturalWidth / naturalHeight,
        1,
      );
    }
  });

  test("hold their space, so the page does not move as they arrive", async ({
    page,
  }) => {
    const held: Route[] = [];
    let holding = true;
    await page.route(
      (url) => /\.(jpe?g|png|webp|avif|svg|gif)$/.test(url.pathname),
      async (route) => {
        if (holding) held.push(route);
        else await route.continue();
      },
    );
    await addSceneSpy(page);
    await page.goto("/");
    await expectSceneState(page, "interchange", "running");
    await selectTheme(page, DIORAMA);
    await expectSceneState(page, DIORAMA, "running");
    await scrollThroughPage(page);

    const pageHeight = () =>
      page.evaluate(() => document.documentElement.scrollHeight);
    const before = await pageHeight();
    const emptyBoxes = await root(page, DIORAMA)
      .locator("img")
      .evaluateAll(
        (images) =>
          images.filter((image) => image.getBoundingClientRect().height < 1)
            .length,
      );
    expect(emptyBoxes).toBe(0);

    holding = false;
    await Promise.all(held.map((route) => route.continue()));
    await expect
      .poll(
        async () =>
          (await imagesOf(page, DIORAMA)).every(
            ({ naturalWidth }) => naturalWidth > 0,
          ),
        { timeout: LOADED_MACHINE_TIMEOUT_MS },
      )
      .toBe(true);
    expect(await pageHeight()).toBe(before);
  });
});
