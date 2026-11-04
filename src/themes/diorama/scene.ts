/**
 * Diorama's scene: a model railway on a wooden baseboard, lit for day or night by
 * the site's colour scheme. An oblique view, so it has its own hit-test.
 */
import { TAU } from "../../rail";
import type { Car, Person } from "../../rail";
import type { CreateScene, SceneSize } from "../../scene/contract";
import { createBillboard } from "./billboard";
import { buildDecor, topPortalsOf, type Decor } from "./decor";
import { drawDecor, drawHill, drawPerson, glowAround } from "./decor-painters";
import { readPalette, type Lighting } from "./palette";
import { drawStaticLayer } from "./static-layer";
import { drawCar, drawPuffs, eachTrainGlow, isTrainAt } from "./train";
import { COMPACT_VIEW, FULL_VIEW, VIEW_WIDTH, VIEW_X0 } from "./view";

type DepthItem =
  | { readonly y: number; readonly decor: Decor }
  | { readonly y: number; readonly person: Person }
  | { readonly y: number; readonly car: Car };

/** Ties on a platform's edge go to the person on the ground, in front. */
const GROUND_PERSON_SORT_NUDGE = 0.1;
/** A car this high is on the bridge, and sorts behind what stands at its foot. */
const RAISED_CAR_MIN_Z = 1;
const RAISED_CAR_SORT_NUDGE = -2;

export const createScene: CreateScene = ({
  canvas,
  world,
  nowItems,
  readToken,
}) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas context.");

  const billboard = createBillboard(nowItems);
  const decor = buildDecor(world);
  const decorItems: readonly DepthItem[] = decor.map((item) => ({
    y: item.y,
    decor: item,
  }));
  const depthItems: DepthItem[] = [];
  const topPortals = topPortalsOf(world);

  let size: SceneSize | null = null;
  let view: typeof FULL_VIEW | typeof COMPACT_VIEW = FULL_VIEW;
  let cssScale = 1;
  let pixelScale = 1;
  /** Set by `applyColorScheme`, which the runtime always calls before `draw`. */
  let lighting!: Lighting;
  /** Costly to paint, so it is kept until the size or the colours change. */
  let staticLayer: HTMLCanvasElement | null = null;

  function setViewTransform(target: CanvasRenderingContext2D): void {
    target.setTransform(
      pixelScale,
      0,
      0,
      pixelScale,
      -VIEW_X0 * pixelScale,
      -view.y0 * pixelScale,
    );
  }

  function paintStaticLayer(): HTMLCanvasElement {
    const layer = document.createElement("canvas");
    layer.width = canvas.width;
    layer.height = canvas.height;
    const layerContext = layer.getContext("2d");
    if (!layerContext) throw new Error("No 2D canvas context.");
    setViewTransform(layerContext);
    drawStaticLayer(layerContext, world, topPortals, lighting);
    return layer;
  }

  const paintGlow = (
    x: number,
    y: number,
    radius: number,
    alpha: number,
  ): void => {
    const { glowRgb } = lighting.palette;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, `rgba(${glowRgb},${alpha})`);
    glow.addColorStop(1, `rgba(${glowRgb},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  };

  function depthSorted(): readonly DepthItem[] {
    depthItems.length = 0;
    depthItems.push(...decorItems);
    for (const person of world.people) {
      depthItems.push({
        y: person.y + (person.station.elevated ? 0 : GROUND_PERSON_SORT_NUDGE),
        person,
      });
    }
    for (const car of world.cars) {
      if (car.hidden) continue;
      const nudge = car.z > RAISED_CAR_MIN_Z ? RAISED_CAR_SORT_NUDGE : 0;
      depthItems.push({ y: car.y + nudge, car });
    }
    return depthItems.sort((a, b) => a.y - b.y);
  }

  return {
    resize(nextSize) {
      // Runs on every show, even at an unchanged size, and setting a canvas's
      // width clears it, so only a real change does any of this.
      if (
        nextSize.width === size?.width &&
        nextSize.devicePixelRatio === size.devicePixelRatio
      ) {
        return;
      }
      size = nextSize;
      view = nextSize.compact ? COMPACT_VIEW : FULL_VIEW;
      cssScale = nextSize.width / VIEW_WIDTH;
      pixelScale = cssScale * nextSize.devicePixelRatio;
      canvas.width = Math.round(nextSize.width * nextSize.devicePixelRatio);
      canvas.height = Math.round(view.height * pixelScale);
      staticLayer = null;
    },
    draw() {
      staticLayer ??= paintStaticLayer();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(staticLayer, 0, 0);
      setViewTransform(ctx);

      if (!size?.compact) billboard.draw(ctx, world.textTime, lighting);
      for (const item of depthSorted()) {
        if ("car" in item) {
          drawCar(ctx, item.car, world, view.height, lighting);
        } else if ("person" in item) {
          drawPerson(ctx, item.person);
        } else {
          drawDecor(ctx, item.decor, lighting);
        }
      }
      for (const portal of topPortals) drawHill(ctx, portal, true, lighting);
      drawPuffs(ctx, world.puffs, lighting);

      if (lighting.night) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const item of decor) glowAround(item, paintGlow);
        eachTrainGlow(world.cars, paintGlow);
        ctx.restore();
      }
    },
    hitTrain({ x, y }, radius) {
      return isTrainAt(
        world.cars,
        { x: x / cssScale + VIEW_X0, y: y / cssScale + view.y0 },
        radius,
      );
    },
    applyColorScheme(scheme) {
      lighting = {
        palette: readPalette(readToken),
        night: scheme === "dark",
      };
      staticLayer = null;
    },
    onFontsReady() {
      billboard.forgetMeasurements();
    },
  };
};
