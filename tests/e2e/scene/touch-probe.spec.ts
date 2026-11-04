/**
 * TEMPORARY, one CI run only, then delete. It never fails. It prints what each way
 * of dragging does on this platform, to settle why `synthesizeScrollGesture` did
 * not scroll on Linux. Look for `TOUCH PROBE` in the CI log.
 */
import { test } from "@playwright/test";
import { THEME_HOOKS } from "../../../src/scene/contract";
import {
  addSceneSpy,
  canvas,
  makePageTall,
  scrollPage,
  scrollY,
  waitFrames,
} from "./helpers";

test.use({ hasTouch: true, viewport: { width: 375, height: 667 } });

test("touch probe", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium");
  await addSceneSpy(page);
  await page.addInitScript(() => {
    const counts: Record<string, number> = {};
    (window as unknown as { __touchCounts: typeof counts }).__touchCounts =
      counts;
    for (const type of [
      "touchstart",
      "touchmove",
      "touchend",
      "touchcancel",
      "pointerdown",
      "pointercancel",
      "click",
    ]) {
      window.addEventListener(
        type,
        () => {
          counts[type] = (counts[type] ?? 0) + 1;
        },
        { capture: true, passive: true },
      );
    }
  });
  await page.goto("/");
  await page
    .locator(`[data-rail-theme-root="interchange"][data-scene-state="running"]`)
    .waitFor({ state: "attached" });
  await makePageTall(page);
  await waitFrames(page, 3);
  const box = await canvas(page, "interchange").boundingBox();
  if (!box) return;
  const onCanvas = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const onContent = { x: 187, y: 640 };
  const devtools = await context.newCDPSession(page);
  const synth = ({ x, y }: { x: number; y: number }) =>
    devtools.send("Input.synthesizeScrollGesture", {
      x,
      y,
      yDistance: -150,
      speed: 1200,
      gestureSourceType: "touch",
    });
  const dispatch = async ({ x, y }: { x: number; y: number }) => {
    await devtools.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let moved = 20; moved <= 150; moved += 20) {
      await devtools.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y - moved }],
      });
      await waitFrames(page, 1);
    }
    await devtools.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  };
  const report: Record<string, unknown> = {
    environment: await page.evaluate(
      (hook) => ({
        ua: navigator.userAgent,
        touchPoints: navigator.maxTouchPoints,
        coarse: matchMedia("(pointer: coarse)").matches,
        hasTouchStart: "ontouchstart" in window,
        scrollHeight: document.documentElement.scrollHeight,
        inner: [innerWidth, innerHeight],
        dpr: devicePixelRatio,
        touchAction: getComputedStyle(document.querySelector(hook) as Element)
          .touchAction,
      }),
      THEME_HOOKS.canvas,
    ),
    box,
  };
  for (const [name, drag, point] of [
    ["synth on canvas", synth, onCanvas],
    ["synth on content", synth, onContent],
    ["dispatch on canvas", dispatch, onCanvas],
    ["dispatch on content", dispatch, onContent],
  ] as const) {
    await scrollPage(page, 0);
    await page.evaluate(() => {
      const counts = (
        window as unknown as { __touchCounts: Record<string, number> }
      ).__touchCounts;
      for (const key of Object.keys(counts)) delete counts[key];
    });
    const startsOn = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.tagName,
      [point.x, point.y],
    );
    const outcome = await drag(point).then(
      () => "sent",
      (error: Error) => error.message,
    );
    await page.waitForTimeout(500);
    report[name] = {
      startsOn,
      outcome,
      scrollY: await scrollY(page),
      events: await page.evaluate(
        () =>
          (window as unknown as { __touchCounts: Record<string, number> })
            .__touchCounts,
      ),
    };
  }
  console.log(`TOUCH PROBE ${JSON.stringify(report)}`);
});
