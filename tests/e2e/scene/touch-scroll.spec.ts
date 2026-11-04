import type { CDPSession, Page } from "@playwright/test";
import {
  canvas,
  expect,
  makePageTall,
  openScenePage,
  RUNNING_TOGGLE,
  scrollY,
  test,
  toggleState,
  waitFrames,
} from "./helpers";

test.use({ hasTouch: true, viewport: { width: 375, height: 667 } });

const DRAG_STEP_PX = 20;
const DRAG_TOP_MARGIN_PX = 10;
/** Less than this and a scroll could be mistaken for a nudge. */
const SHORTEST_DRAG_PX = 100;

interface ViewportPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Sends real touches through DevTools, so the browser's own gesture recognition
 * and `touch-action` handling decide whether the page scrolls. Not
 * `Input.synthesizeScrollGesture`, which scrolled nothing on Linux in CI (PR #15).
 */
async function dragUp(
  page: Page,
  devtools: CDPSession,
  { x, y }: ViewportPoint,
  distance: number,
): Promise<void> {
  const touchAt = (touchY: number) => ({ touchPoints: [{ x, y: touchY }] });
  await devtools.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    ...touchAt(y),
  });
  for (let moved = DRAG_STEP_PX; moved <= distance; moved += DRAG_STEP_PX) {
    await devtools.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      ...touchAt(y - moved),
    });
    await waitFrames(page, 1);
  }
  await devtools.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

/** Everything needed to tell a page that can't scroll from a gesture that failed. */
const scrollFacts = (page: Page, { x, y }: ViewportPoint) =>
  page.evaluate(
    ([pointX, pointY]) => ({
      scrollY: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      viewport: { width: innerWidth, height: innerHeight },
      start: { x: pointX, y: pointY },
      startsOn: document.elementFromPoint(pointX, pointY)?.tagName ?? null,
      touchPoints: navigator.maxTouchPoints,
      coarsePointer: matchMedia("(pointer: coarse)").matches,
    }),
    [x, y],
  );

async function expectDragScrollsPage(
  page: Page,
  devtools: CDPSession,
  start: ViewportPoint,
  expectedTag: { readonly is?: string; readonly isNot?: string },
): Promise<void> {
  const distance = start.y - DRAG_TOP_MARGIN_PX;
  const before = await scrollFacts(page, start);
  const facts = JSON.stringify(before);

  expect(before.scrollY, `The page has already scrolled: ${facts}`).toBe(0);
  expect(distance, `Too little room for a drag: ${facts}`).toBeGreaterThan(
    SHORTEST_DRAG_PX,
  );
  expect(
    before.scrollHeight - before.viewport.height,
    `The page is too short to scroll that far: ${facts}`,
  ).toBeGreaterThan(distance);
  if (expectedTag.is) {
    expect(before.startsOn, `The drag starts elsewhere: ${facts}`).toBe(
      expectedTag.is,
    );
  }
  if (expectedTag.isNot) {
    expect(before.startsOn, `The drag starts elsewhere: ${facts}`).not.toBe(
      expectedTag.isNot,
    );
  }

  await dragUp(page, devtools, start, distance);

  await expect
    .poll(() => scrollY(page), {
      message: `A touch drag of ${distance}px did not scroll the page: ${facts}`,
    })
    .toBeGreaterThan(distance / 2);
}

test.describe("touch dragging", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Needs the Chrome DevTools Protocol",
  );

  // If only the next test fails, the canvas is trapping touches. If both do, the
  // drag itself does not work in this browser, which says nothing about the canvas.
  test("a touch drag on plain page content scrolls the page, as a control", async ({
    page,
    context,
  }) => {
    await openScenePage(page);
    await makePageTall(page);
    await waitFrames(page, 3);
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("The context has no viewport.");

    await expectDragScrollsPage(
      page,
      await context.newCDPSession(page),
      { x: viewport.width / 2, y: viewport.height - DRAG_STEP_PX },
      { isNot: "CANVAS" },
    );
  });

  test("a touch drag starting on the canvas scrolls the page and presses nothing (E17)", async ({
    page,
    context,
  }) => {
    await openScenePage(page);
    await makePageTall(page);
    await waitFrames(page, 3);
    const box = await canvas(page, "interchange").boundingBox();
    if (!box) throw new Error("The canvas is not showing.");

    await expectDragScrollsPage(
      page,
      await context.newCDPSession(page),
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      { is: "CANVAS" },
    );

    expect(await toggleState(page, "interchange")).toEqual(RUNNING_TOGGLE);
  });
});
