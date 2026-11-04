import { expect } from "@playwright/test";
import { test } from "./support";

const SENTINEL = "last message of this test";

test.describe("what counts as a console problem", () => {
  test("a blocked font preconnect does not, and everything near it does", async ({
    page,
    pageProblems,
  }) => {
    await page.goto("/");
    const notProblems = [
      // As WebKit writes them.
      "Failed to preconnect to https://fonts.googleapis.com/. Error: The Internet connection appears to be offline.",
      "Failed to preconnect to https://fonts.gstatic.com/. Error: WebKit encountered an internal error",
    ];
    const problems = [
      "Failed to preconnect to https://example.com/. Error: The Internet connection appears to be offline.",
      "Failed to load resource: https://fonts.googleapis.com/css2?family=Overpass",
      'Scene for theme "diorama" failed.',
      SENTINEL,
    ];

    await page.evaluate(
      (messages) => messages.forEach((message) => console.error(message)),
      [...notProblems, ...problems],
    );

    await expect.poll(() => pageProblems.at(-1)).toBe(`console: ${SENTINEL}`);
    expect(pageProblems).toEqual(problems.map((text) => `console: ${text}`));
  });
});
