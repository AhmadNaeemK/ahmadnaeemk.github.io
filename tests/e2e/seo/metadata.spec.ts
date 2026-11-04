import { readFileSync } from "node:fs";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { parse } from "yaml";

const CANONICAL_ORIGIN = "https://www.ahmadnaeem.dev";
const PNG_SIGNATURE = "89504e470d0a1a0a";

function readProfileIntro(): string {
  const profileFile = new URL(
    "../../../src/content/profile.yaml",
    import.meta.url,
  );
  const entries = parse(readFileSync(profileFile, "utf8")) as Record<
    string,
    { intro: string }
  >;
  const [profile] = Object.values(entries);
  return profile.intro;
}

/** Published URLs name the canonical host, but the files are served by the preview. */
async function fetchPublished(
  request: APIRequestContext,
  publishedUrl: string,
): Promise<string> {
  const response = await request.get(new URL(publishedUrl).pathname);
  expect(response.status(), publishedUrl).toBe(200);
  return response.text();
}

function sitemapLocations(sitemapXml: string): string[] {
  return [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, location]) => location,
  );
}

test.describe("what the home page tells search engines and link previews", () => {
  test("its canonical and Open Graph URLs are the canonical home URL", async ({
    page,
  }) => {
    await page.goto("/");

    const homeUrl = `${CANONICAL_ORIGIN}/`;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      homeUrl,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      homeUrl,
    );
  });

  test("its Open Graph image is on the canonical host and is a real PNG", async ({
    page,
    request,
  }) => {
    await page.goto("/");

    const imageUrl = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    expect(new URL(imageUrl ?? "").origin).toBe(CANONICAL_ORIGIN);
    expect(new URL(imageUrl ?? "").pathname).toBe("/og-image.png");

    const imageResponse = await request.get("/og-image.png");
    expect(imageResponse.status()).toBe(200);
    expect(imageResponse.headers()["content-type"]).toBe("image/png");
    const imageBytes = await imageResponse.body();
    expect(imageBytes.subarray(0, 8).toString("hex")).toBe(PNG_SIGNATURE);
  });

  test("its descriptions are the profile's intro", async ({ page }) => {
    await page.goto("/");

    const intro = readProfileIntro();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      intro,
    );
    await expect(
      page.locator('meta[property="og:description"]'),
    ).toHaveAttribute("content", intro);
  });
});

test.describe("what crawlers find from robots.txt", () => {
  test("robots.txt leads to a sitemap on the canonical host", async ({
    request,
  }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain(`Sitemap: ${CANONICAL_ORIGIN}/sitemap-index.xml`);

    const sitemapIndex = await fetchPublished(
      request,
      `${CANONICAL_ORIGIN}/sitemap-index.xml`,
    );
    expect(sitemapLocations(sitemapIndex)).toEqual([
      `${CANONICAL_ORIGIN}/sitemap-0.xml`,
    ]);
    await fetchPublished(request, `${CANONICAL_ORIGIN}/sitemap-0.xml`);
  });

  test("the sitemap lists the home page and leaves out the 404 page", async ({
    request,
  }) => {
    const sitemap = await fetchPublished(
      request,
      `${CANONICAL_ORIGIN}/sitemap-0.xml`,
    );
    const locations = sitemapLocations(sitemap);

    expect(locations).toContain(`${CANONICAL_ORIGIN}/`);
    expect(locations.filter((location) => location.includes("404"))).toEqual(
      [],
    );
  });
});
