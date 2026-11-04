/** STUB, replaced by Task 7. A top-down view: canvas maps linearly to world. */
import { marqueeSegments, sample, TAU } from "../../rail";
import type { MarqueeSegment } from "../../rail";
import type { CreateScene, SceneSize } from "../../scene/contract";

const VIEW_X0 = -24;
const VIEW_WIDTH = 768;
const FULL_VIEW = { y0: -66, height: 300 };
const COMPACT_VIEW = { y0: -28, height: 262 };
const BILLBOARD = { x: 120, y: -58, width: 480, height: 34 };
const BILLBOARD_FONT = "700 13px system-ui, sans-serif";
const BILLBOARD_SPEED = 26;

export const createScene: CreateScene = ({
  canvas,
  world,
  nowItems,
  readToken,
}) => {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2D canvas context.");

  let view = FULL_VIEW;
  let compact = false;
  let cssScale = 1;
  let pixelScale = 1;
  let colors = { track: "", train: "", board: "", boardInk: "" };

  const billboardTexts = nowItems.map(
    ({ label, value }) => `${label}: ${value}     `,
  );

  function drawBillboard(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = colors.board;
    ctx.fillRect(BILLBOARD.x, BILLBOARD.y, BILLBOARD.width, BILLBOARD.height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(BILLBOARD.x, BILLBOARD.y, BILLBOARD.width, BILLBOARD.height);
    ctx.clip();
    ctx.textBaseline = "middle";
    marqueeSegments(
      ctx,
      billboardTexts.map((text): MarqueeSegment => ({
        text,
        font: BILLBOARD_FONT,
        color: colors.boardInk,
      })),
      {
        x: BILLBOARD.x,
        baseline: BILLBOARD.y + BILLBOARD.height / 2,
        width: BILLBOARD.width,
        time: world.textTime,
        speed: BILLBOARD_SPEED,
      },
    );
    ctx.restore();
  }

  return {
    resize({ width, compact: isCompact, devicePixelRatio }: SceneSize) {
      compact = isCompact;
      view = compact ? COMPACT_VIEW : FULL_VIEW;
      cssScale = width / VIEW_WIDTH;
      pixelScale = cssScale * devicePixelRatio;
      canvas.width = Math.round(width * devicePixelRatio);
      canvas.height = Math.round(view.height * pixelScale);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${view.height * cssScale}px`;
    },
    draw() {
      context.setTransform(
        pixelScale,
        0,
        0,
        pixelScale,
        -VIEW_X0 * pixelScale,
        -view.y0 * pixelScale,
      );
      context.clearRect(VIEW_X0, view.y0, VIEW_WIDTH, view.height);
      context.fillStyle = colors.track;
      for (const segment of world.letters.flatMap(({ parts }) => parts)) {
        for (const { x, y } of sample(segment, 6)) {
          context.beginPath();
          context.arc(x, y, 2, 0, TAU);
          context.fill();
        }
      }
      context.fillStyle = colors.train;
      for (const car of world.cars) {
        if (car.hidden) continue;
        context.beginPath();
        context.arc(car.x, car.y, 8, 0, TAU);
        context.fill();
      }
      if (!compact && nowItems.length > 0) drawBillboard(context);
    },
    hitTrain({ x, y }, radius) {
      return world.hitTrain(
        x / cssScale + VIEW_X0,
        y / cssScale + view.y0,
        radius,
      );
    },
    applyColorScheme() {
      colors = {
        track: readToken("--track"),
        train: readToken("--train"),
        board: readToken("--board"),
        boardInk: readToken("--board-ink"),
      };
    },
    onFontsReady() {
      // Measured every frame, so nothing is cached to drop.
    },
  };
};
