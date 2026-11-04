import type { Page } from "@playwright/test";
import {
  expect,
  lastTextsFrom,
  logThemeCanvasTexts,
  nowItemsHtml,
  rewriteThemeHtml,
  test,
} from "../scene/helpers";
import { DESKTOP, DIORAMA, openDiorama } from "./support";

const BOARD_LABEL = "RIGHT NOW";

test.use({ viewport: DESKTOP });

/** Everything the board drew after its label, in order. */
const rolledTexts = (page: Page) =>
  lastTextsFrom(page, BOARD_LABEL).then(([, ...rolled]) => rolled);

test("plain items roll with only their text, and no empty label before it", async ({
  page,
}) => {
  await logThemeCanvasTexts(page, DIORAMA);
  await rewriteThemeHtml(
    page,
    DIORAMA,
    nowItemsHtml([{ value: "Back at 12:30" }, { value: "https://x.com" }]),
  );
  await openDiorama(page);

  const rollPosition = async () => {
    await expect
      .poll(async () => (await rolledTexts(page)).length)
      .toBeGreaterThan(0);
    const [firstSegment] = await rolledTexts(page);
    return firstSegment.box.x;
  };
  const start = await rollPosition();
  await expect.poll(rollPosition).not.toBe(start);

  const rolled = await rolledTexts(page);
  expect(rolled.slice(0, 4).map(({ text }) => text.trim())).toEqual([
    "BACK AT 12:30",
    "·",
    "HTTPS://X.COM",
    "·",
  ]);
});
