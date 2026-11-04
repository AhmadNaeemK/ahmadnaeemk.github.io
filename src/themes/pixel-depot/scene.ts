/**
 * A top-down pixel town, painted into a small buffer that CSS scales up by a whole
 * number with hard pixels. The buffer does not depend on the device pixel ratio: one
 * buffer pixel is always a whole number of device pixels at a ratio of 1 or 2.
 */
import type { CreateScene } from "../../scene/contract";
import { createBillboard } from "./draw/billboard";
import { readPalette } from "./draw/palette";
import { Raster } from "./draw/raster";
import {
  canvasToWorld,
  viewForSize,
  type Palette,
  type View,
} from "./draw/stage";
import { paintTown } from "./draw/town";
import { paintMovingParts } from "./draw/train";

/** How often per `world.time` second the dithered fades swap. */
const FLICKER_PER_SECOND = 7.5;

interface Buffers {
  readonly view: View;
  readonly image: ImageData;
  /** Backed by `image`, and what each frame is painted into. */
  readonly frame: Raster;
  readonly town: Raster;
}

function createBuffers(context: CanvasRenderingContext2D, view: View): Buffers {
  const { bufferWidth, bufferHeight } = view;
  const image = context.createImageData(bufferWidth, bufferHeight);
  return {
    view,
    image,
    frame: new Raster(
      bufferWidth,
      bufferHeight,
      new Uint32Array(image.data.buffer),
    ),
    town: new Raster(
      bufferWidth,
      bufferHeight,
      new Uint32Array(bufferWidth * bufferHeight),
    ),
  };
}

export const createScene: CreateScene = ({
  canvas,
  world,
  nowItems,
  readToken,
}) => {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2D canvas context.");

  const billboard = createBillboard(nowItems);
  let sizedForWidth = 0;
  let buffers: Buffers | null = null;
  let palette: Palette | null = null;
  let townIsPainted = false;

  return {
    resize(size) {
      // Called on every show too, and writing the canvas's size clears it.
      if (size.width === sizedForWidth) return;
      sizedForWidth = size.width;
      const view = viewForSize(size);
      canvas.width = view.bufferWidth;
      canvas.height = view.bufferHeight;
      canvas.style.width = `${view.bufferWidth * view.pixelSize}px`;
      canvas.style.height = `${view.bufferHeight * view.pixelSize}px`;
      buffers = createBuffers(context, view);
      townIsPainted = false;
    },
    draw() {
      if (!buffers || !palette) return;
      const { view, image, frame, town } = buffers;
      const stage = { world, view, palette };
      if (!townIsPainted) {
        paintTown(town, stage);
        townIsPainted = true;
      }
      frame.pixels.set(town.pixels);
      paintMovingParts(
        frame,
        stage,
        Math.floor(world.time * FLICKER_PER_SECOND),
      );
      billboard.paint(frame, stage, world.textTime);
      context.putImageData(image, 0, 0);
    },
    hitTrain(point, radius) {
      if (!buffers) return false;
      const { x, y } = canvasToWorld(buffers.view, point);
      return world.hitTrain(x, y, radius);
    },
    applyColorScheme(scheme) {
      palette = readPalette(readToken, scheme);
      townIsPainted = false;
    },
    onFontsReady() {
      // The billboard draws from its own bitmap font, so nothing was measured.
    },
  };
};
