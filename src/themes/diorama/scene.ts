/**
 * STUB, replaced by Task 8. An oblique view: the ground is squashed and height
 * lifts cars up, which is why this theme has its own hit-test.
 */
import { marqueeSegments, sample, TAU } from "../../rail";
import type { Car, MarqueeSegment } from "../../rail";
import type { CreateScene } from "../../scene/contract";

const GROUND_SQUASH = 0.7;
const CAR_LIFT = 6;
const HIT_FACTOR = 0.8;
const VIEW_X0 = -50;
const VIEW_WIDTH = 820;
const FULL_VIEW = { y0: -84, height: 282 };
const COMPACT_VIEW = { y0: -64, height: 262 };
const BILLBOARD = { x: 170, y: -74, width: 480, height: 30 };
const BILLBOARD_FONT = "800 15px system-ui, sans-serif";
const BILLBOARD_SPEED = 24;

const projectY = (y: number, z = 0) => y * GROUND_SQUASH - z;
const carScreenY = (car: Car) => projectY(car.y, car.z + CAR_LIFT);

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
    ({ label, value }) => `${label.toUpperCase()} ${value.toUpperCase()}     `,
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
    resize({ width, compact: isCompact, devicePixelRatio }) {
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
          context.fillRect(x - 3, projectY(y) - 1, 6, 2);
        }
      }
      context.fillStyle = colors.train;
      for (const car of world.cars) {
        if (car.hidden) continue;
        context.beginPath();
        context.ellipse(car.x, carScreenY(car), 9, 7, 0, 0, TAU);
        context.fill();
      }
      if (!compact && nowItems.length > 0) drawBillboard(context);
    },
    hitTrain({ x, y }, radius) {
      const viewX = x / cssScale + VIEW_X0;
      const viewY = y / cssScale + view.y0;
      return world.cars.some(
        (car) =>
          !car.hidden &&
          Math.hypot(car.x - viewX, carScreenY(car) - viewY) <
            radius * HIT_FACTOR,
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
