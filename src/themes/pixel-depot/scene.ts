/**
 * STUB, replaced by Task 9. Draws into a small buffer that CSS scales up by a
 * whole number, so the canvas is not the same size as its parent.
 */
import { marquee, sample } from "../../rail";
import type { CreateScene } from "../../scene/contract";

const VIEW_X0 = -24;
const VIEW_WIDTH = 768;
const FULL_VIEW = { y0: -66, height: 302 };
const COMPACT_VIEW = { y0: -28, height: 264 };
const LARGE_PIXEL_WIDTH = 900;
const MEDIUM_PIXEL_WIDTH = 520;
const BILLBOARD_TOP = 2;
const BILLBOARD_HEIGHT = 12;
const BILLBOARD_FONT = "10px monospace";
const BILLBOARD_SPEED = 14;

const pixelSizeFor = (width: number) =>
  width >= LARGE_PIXEL_WIDTH ? 3 : width >= MEDIUM_PIXEL_WIDTH ? 2 : 1;

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
  let pixelSize = 1;
  let bufferScale = 0.5;
  let colors = { ground: "", track: "", train: "", board: "", boardInk: "" };

  const billboardText = nowItems
    .map(({ label, value }) => `${label} ${value}`)
    .join("   ");
  const toBufferX = (x: number) => Math.round((x - VIEW_X0) * bufferScale);
  const toBufferY = (y: number) => Math.round((y - view.y0) * bufferScale);

  function drawBillboard(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.fillStyle = colors.board;
    ctx.fillRect(0, BILLBOARD_TOP, width, BILLBOARD_HEIGHT);
    ctx.fillStyle = colors.boardInk;
    ctx.font = BILLBOARD_FONT;
    ctx.textBaseline = "middle";
    marquee(ctx, billboardText, {
      x: 0,
      baseline: BILLBOARD_TOP + BILLBOARD_HEIGHT / 2,
      width,
      time: world.textTime,
      speed: BILLBOARD_SPEED,
    });
  }

  return {
    resize({ width, compact: isCompact }) {
      compact = isCompact;
      view = compact ? COMPACT_VIEW : FULL_VIEW;
      pixelSize = pixelSizeFor(width);
      const bufferWidth = Math.floor(width / pixelSize);
      const bufferHeight = Math.round((bufferWidth * view.height) / VIEW_WIDTH);
      bufferScale = bufferWidth / VIEW_WIDTH;
      canvas.width = bufferWidth;
      canvas.height = bufferHeight;
      canvas.style.width = `${bufferWidth * pixelSize}px`;
      canvas.style.height = `${bufferHeight * pixelSize}px`;
    },
    draw() {
      context.fillStyle = colors.ground;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = colors.track;
      for (const segment of world.letters.flatMap(({ parts }) => parts)) {
        for (const { x, y } of sample(segment, 4)) {
          context.fillRect(toBufferX(x), toBufferY(y), 1, 1);
        }
      }
      context.fillStyle = colors.train;
      for (const car of world.cars) {
        if (car.hidden) continue;
        context.fillRect(toBufferX(car.x) - 2, toBufferY(car.y) - 2, 5, 5);
      }
      if (!compact && nowItems.length > 0) drawBillboard(context, canvas.width);
    },
    hitTrain({ x, y }, radius) {
      const toWorld = 1 / (pixelSize * bufferScale);
      return world.hitTrain(
        x * toWorld + VIEW_X0,
        y * toWorld + view.y0,
        radius,
      );
    },
    applyColorScheme() {
      colors = {
        ground: readToken("--ground"),
        track: readToken("--track"),
        train: readToken("--train"),
        board: readToken("--board"),
        boardInk: readToken("--board-ink"),
      };
    },
    onFontsReady() {
      // This theme's billboard text comes from no web font.
    },
  };
};
