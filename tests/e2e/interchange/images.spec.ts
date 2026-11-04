import { type Page } from "@playwright/test";
import { THEME_ROOT_ATTRIBUTE } from "../../../src/scene/contract";
import { goToHash, pastPinSettling } from "../selection/support";
import {
  expect,
  expectState,
  root,
  test,
  waitFrames,
  openScenePage,
} from "../scene/helpers";
import { content, THEME } from "./support";

const ROOT_MARKER = `${THEME_ROOT_ATTRIBUTE}="`;

/**
 * Takes the other themes' images out of the page, because a theme may share a file
 * with Interchange: this way, a request can only have come from Interchange.
 */
async function serveOnlyInterchangeImages(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname === "/",
    async (route) => {
      const response = await route.fetch();
      const [beforeRoots, ...roots] = (await response.text()).split(
        ROOT_MARKER,
      );
      const kept = roots.map((part) =>
        part.startsWith(`${THEME}"`) ? part : part.replace(/<img\b[^>]*>/g, ""),
      );
      await route.fulfill({
        response,
        body: [beforeRoots, ...kept].join(ROOT_MARKER),
      });
    },
  );
}

const watchImageRequests = (page: Page): string[] => {
  const requested: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "image") requested.push(request.url());
  });
  return requested;
};

const imageUrls = (page: Page): Promise<string[]> =>
  root(page, THEME)
    .locator("img")
    .evaluateAll((images: HTMLImageElement[]) =>
      images.map((image) => image.src),
    );

/** Scrolled to in turn, as a reader would reach them: they are lazy. */
async function expectAllImagesLoadWhenReached(page: Page): Promise<void> {
  const images = root(page, THEME).locator("img");
  for (let index = 0; index < (await images.count()); index += 1) {
    const image = images.nth(index);
    await image.evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await expect
      .poll(
        () =>
          image.evaluate(
            (element: HTMLImageElement) =>
              element.complete && element.naturalWidth > 0,
          ),
        { message: `image ${index} never loaded` },
      )
      .toBe(true);
  }
}

test.describe("while another theme shows", () => {
  test("no Interchange image is requested, and they all load on its first show", async ({
    page,
  }) => {
    await serveOnlyInterchangeImages(page);
    const requested = watchImageRequests(page);
    await page.goto("/#diorama");
    await expectState(page, "diorama", "running");
    await pastPinSettling(page);
    // Off the top too: a lazy image waits on nearness, which this rules out.
    await page.evaluate(() =>
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "instant",
      }),
    );
    await page.waitForLoadState("networkidle");

    const urls = await imageUrls(page);
    expect(urls.length).toBeGreaterThan(0);
    expect(requested.filter((url) => urls.includes(url))).toEqual([]);

    requested.length = 0;
    await goToHash(page, `#${THEME}`);
    await expectState(page, THEME, "running");
    // The section pin would scroll an image back out of reach before it loads.
    await pastPinSettling(page);
    await expectAllImagesLoadWhenReached(page);
    expect(urls.filter((url) => !requested.includes(url))).toEqual([]);
  });
});

test("each image is a file with its size set, and nothing in the theme is a data URI", async ({
  page,
}) => {
  await openScenePage(page);
  const images = await root(page, THEME)
    .locator("img")
    .evaluateAll((elements: HTMLImageElement[]) =>
      elements.map((image) => ({
        src: image.getAttribute("src") ?? "",
        width: Number(image.getAttribute("width")),
        height: Number(image.getAttribute("height")),
        loading: image.getAttribute("loading"),
      })),
    );

  // The portrait, the contact photo and every project's logo.
  const { projects } = await content;
  expect(images.length).toBe(projects.length + 2);
  for (const image of images) {
    expect(image.src).toMatch(/^\//);
    expect(image.width).toBeGreaterThan(0);
    expect(image.height).toBeGreaterThan(0);
    expect(image.loading).toBe("lazy");
  }

  const dataUriUses = await root(page, THEME).evaluate((themeRoot) => {
    const INLINE_IMAGE = /url\(["']?data:image/;
    const inMarkup = /data:image/.test(themeRoot.outerHTML) ? ["markup"] : [];
    const inStyles = [...themeRoot.querySelectorAll("*")].flatMap((element) =>
      [null, "::before", "::after"].flatMap((pseudo) =>
        INLINE_IMAGE.test(getComputedStyle(element, pseudo).backgroundImage)
          ? [`${element.tagName}.${element.className}${pseudo ?? ""}`]
          : [],
      ),
    );
    return [...inMarkup, ...inStyles];
  });
  expect(dataUriUses).toEqual([]);
});

test("a fresh load of Interchange loads every image once reached, and the text alternatives are right", async ({
  page,
}) => {
  await openScenePage(page);
  await expectAllImagesLoadWhenReached(page);
  await waitFrames(page, 2);

  const { profile, projects } = await content;
  const themeRoot = root(page, THEME);
  await expect(
    themeRoot.getByRole("img", { name: profile.portraitAlt, exact: true }),
  ).toBeVisible();
  for (const { name } of projects) {
    await expect(
      themeRoot.getByRole("img", { name: `${name} logo`, exact: true }),
    ).toBeVisible();
  }
  // Decorative beside the address, so a screen reader is not told about it.
  await expect(themeRoot.locator('[id="a-contact"] img')).toHaveAttribute(
    "alt",
    "",
  );
});
