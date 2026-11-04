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

const DRAG_DISTANCE = 300;

// Chromium only: WebKit has no way to synthesize a compositor touch gesture.
test("a touch drag starting on the canvas scrolls the page and presses nothing (E17)", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Needs the Chrome DevTools Protocol");
  await openScenePage(page);
  await makePageTall(page);
  await waitFrames(page, 3);
  const box = await canvas(page, "interchange").boundingBox();
  if (!box) throw new Error("The canvas is not showing.");
  expect(await scrollY(page)).toBe(0);

  const devtools = await context.newCDPSession(page);
  await devtools.send("Input.synthesizeScrollGesture", {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    yDistance: -DRAG_DISTANCE,
    speed: 1200,
    gestureSourceType: "touch",
  });

  await expect.poll(() => scrollY(page)).toBeGreaterThan(DRAG_DISTANCE / 2);
  expect(await toggleState(page, "interchange")).toEqual(RUNNING_TOGGLE);
});
