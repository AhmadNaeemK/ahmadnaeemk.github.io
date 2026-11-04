import { describe, expect, it } from "vitest";
import {
  marquee,
  marqueeSegments,
  nowCycle,
  type MarqueeOptions,
  type TextCanvas,
} from "./index";

/** A hung loop would never finish, so a runaway one fails here instead. */
const MOST_PASSES_A_WINDOW_NEEDS = 10_000;

interface Drawn {
  readonly text: string;
  readonly x: number;
  readonly baseline: number;
  readonly font: string;
  readonly color: string | object;
}

/** A canvas whose text is `pixelsPerCharacter(font)` wide per character. */
function fakeCanvas(pixelsPerCharacter: (font: string) => number = () => 10) {
  const drawn: Drawn[] = [];
  const canvas: TextCanvas & { drawn: Drawn[] } = {
    font: "",
    fillStyle: "",
    drawn,
    measureText(text) {
      return { width: text.length * pixelsPerCharacter(this.font) };
    },
    fillText(text, x, baseline) {
      if (drawn.length >= MOST_PASSES_A_WINDOW_NEEDS) {
        throw new Error("The marquee is not leaving its window.");
      }
      drawn.push({
        text,
        x,
        baseline,
        font: this.font,
        color: this.fillStyle,
      });
    },
  };
  return canvas;
}

const TEXT = "seven c";
const TEXT_WIDTH = 70;
const GAP_WIDTH = 60;
const LOOP = TEXT_WIDTH + GAP_WIDTH;

const WINDOW: MarqueeOptions = {
  x: 40,
  baseline: 25,
  width: 300,
  time: 0,
  speed: 20,
};

function passesOf(options: Partial<MarqueeOptions> = {}): number[] {
  const canvas = fakeCanvas();
  marquee(canvas, TEXT, { ...WINDOW, ...options });
  return canvas.drawn.map(({ x }) => x);
}

function expectToCoverWindow(
  lefts: readonly number[],
  loop: number,
  { x, width }: MarqueeOptions,
) {
  expect(lefts[0]).toBeLessThanOrEqual(x);
  expect(lefts[0]).toBeGreaterThan(x - loop);
  expect(lefts[lefts.length - 1] + loop).toBeGreaterThanOrEqual(x + width);
}

describe("marquee", () => {
  it.each([0, 1, 3.3, 6.5, 500])(
    "covers the whole window at time %d",
    (time) => {
      expectToCoverWindow(passesOf({ time }), LOOP, WINDOW);
    },
  );

  it("draws every pass on the baseline, with the text it was given", () => {
    const canvas = fakeCanvas();

    marquee(canvas, TEXT, WINDOW);

    for (const { text, baseline } of canvas.drawn) {
      expect(text).toBe(TEXT);
      expect(baseline).toBe(WINDOW.baseline);
    }
  });

  it("rolls left as time passes, at the speed asked for", () => {
    const [first] = passesOf({ time: 2 });

    expect(first).toBeCloseTo(WINDOW.x - 2 * WINDOW.speed);
  });

  it("spaces passes by the text width plus the gap", () => {
    const lefts = passesOf({ time: 1 });

    expect(lefts.length).toBeGreaterThan(1);
    lefts.slice(1).forEach((left, i) => {
      expect(left - lefts[i]).toBeCloseTo(LOOP);
    });
  });

  it("looks the same after one whole loop", () => {
    const start = passesOf({ time: 1 });
    const oneLoopLater = passesOf({ time: 1 + LOOP / WINDOW.speed });

    expect(oneLoopLater).toHaveLength(start.length);
    oneLoopLater.forEach((left, i) => {
      expect(left).toBeCloseTo(start[i]);
    });
  });

  it("wraps at a loop, so a long run stays in the window", () => {
    expectToCoverWindow(passesOf({ time: 1_000_000 }), LOOP, WINDOW);
  });

  it("takes a negative time without leaving a gap", () => {
    expectToCoverWindow(passesOf({ time: -3 }), LOOP, WINDOW);
  });

  it("draws nothing, and finishes, when the text measures nothing", () => {
    const canvas = fakeCanvas(() => 0);

    marquee(canvas, TEXT, WINDOW);

    expect(canvas.drawn).toEqual([]);
  });

  it("draws nothing, and finishes, when the width is not a number", () => {
    const canvas = fakeCanvas(() => NaN);

    marquee(canvas, TEXT, WINDOW);

    expect(canvas.drawn).toEqual([]);
  });

  it("measures afresh on every call, so a late font takes effect", () => {
    let pixelsPerCharacter = 10;
    const canvas = fakeCanvas(() => pixelsPerCharacter);
    marquee(canvas, TEXT, WINDOW);

    pixelsPerCharacter = 20;
    canvas.drawn.length = 0;
    marquee(canvas, TEXT, WINDOW);

    const [first, second] = canvas.drawn;
    expect(second.x - first.x).toBeCloseTo(LOOP * 2);
  });
});

describe("marqueeSegments", () => {
  const FONT_WIDTHS: Readonly<Record<string, number>> = {
    "big font": 20,
    "small font": 10,
  };
  const SEGMENTS = [
    { text: "abc", font: "big font", color: "red" },
    { text: "defg", font: "small font", color: "blue" },
  ];
  /** 3 at 20 plus 4 at 10. */
  const SEGMENTS_LOOP = 100;

  function drawSegments(options: Partial<MarqueeOptions> = {}) {
    const canvas = fakeCanvas((font) => FONT_WIDTHS[font] ?? 0);
    marqueeSegments(canvas, SEGMENTS, { ...WINDOW, ...options });
    return canvas;
  }

  it("draws each segment in its own font and colour", () => {
    const [first, second] = drawSegments().drawn;

    expect(first).toMatchObject({
      text: "abc",
      font: "big font",
      color: "red",
    });
    expect(second).toMatchObject({
      text: "defg",
      font: "small font",
      color: "blue",
    });
  });

  it("starts each segment where the one before it ended", () => {
    const [first, second] = drawSegments().drawn;

    expect(second.x - first.x).toBeCloseTo(60);
  });

  it("rolls them as one loop, with no gap between passes", () => {
    const starts = drawSegments({ time: 1 })
      .drawn.filter(({ text }) => text === "abc")
      .map(({ x }) => x);

    expect(starts.length).toBeGreaterThan(1);
    starts.slice(1).forEach((start, i) => {
      expect(start - starts[i]).toBeCloseTo(SEGMENTS_LOOP);
    });
  });

  it("covers the whole window, at a negative time too", () => {
    for (const time of [0, 2.2, -2.2]) {
      const starts = drawSegments({ time })
        .drawn.filter(({ text }) => text === "abc")
        .map(({ x }) => x);
      expectToCoverWindow(starts, SEGMENTS_LOOP, WINDOW);
    }
  });

  it("measures afresh on every call, so a late font takes effect", () => {
    let widen = 1;
    const canvas = fakeCanvas((font) => (FONT_WIDTHS[font] ?? 0) * widen);
    marqueeSegments(canvas, SEGMENTS, WINDOW);

    widen = 2;
    canvas.drawn.length = 0;
    marqueeSegments(canvas, SEGMENTS, WINDOW);

    const [first, second] = canvas.drawn;
    expect(second.x - first.x).toBeCloseTo(120);
  });

  it("does nothing with no segments", () => {
    const canvas = fakeCanvas();

    marqueeSegments(canvas, [], WINDOW);

    expect(canvas.drawn).toEqual([]);
  });

  it("draws nothing, and finishes, when every segment is empty", () => {
    const canvas = fakeCanvas();

    marqueeSegments(
      canvas,
      [{ text: "", font: "big font", color: "red" }],
      WINDOW,
    );

    expect(canvas.drawn).toEqual([]);
  });
});

describe("nowCycle", () => {
  it.each([0, 0.1, 2.5, 4.99, 5, 100.2])(
    "never cycles or fades a single item, at time %d",
    (time) => {
      expect(nowCycle(time, 1)).toEqual({ index: 0, alpha: 1 });
    },
  );

  it("shows each item in turn, then wraps at the count", () => {
    const indexes = [2.5, 7.5, 12.5, 17.5, 22.5].map(
      (time) => nowCycle(time, 3).index,
    );

    expect(indexes).toEqual([0, 1, 2, 0, 1]);
  });

  it("gives each item five seconds by default", () => {
    expect(nowCycle(4.9, 3).index).toBe(0);
    expect(nowCycle(5.1, 3).index).toBe(1);
  });

  it("gives each item the period it is asked for", () => {
    expect(nowCycle(1.9, 3, 2).index).toBe(0);
    expect(nowCycle(2.1, 3, 2).index).toBe(1);
  });

  it("fades an item in over its first tenth, and out over its last", () => {
    expect(nowCycle(0, 2).alpha).toBe(0);
    expect(nowCycle(0.25, 2).alpha).toBeCloseTo(0.5);
    expect(nowCycle(4.75, 2).alpha).toBeCloseTo(0.5);
  });

  it("holds an item fully shown between its fades", () => {
    for (const time of [0.5, 2.5, 4.5]) {
      expect(nowCycle(time, 2).alpha).toBe(1);
    }
  });

  it.each([0, -3, NaN, Infinity])(
    "treats a count of %d as a single item",
    (count) => {
      expect(nowCycle(7, count)).toEqual({ index: 0, alpha: 1 });
    },
  );

  it.each([NaN, Infinity, -Infinity, -4])(
    "starts from the first item at time %d",
    (time) => {
      const { index, alpha } = nowCycle(time, 3);

      expect(index).toBe(0);
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(1);
    },
  );
});
