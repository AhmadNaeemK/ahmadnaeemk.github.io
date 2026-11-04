/** Interchange's scene: a transit map seen from above, so canvas maps linearly to world. */
import type { Car, Person } from "../../rail";
import type { CreateScene, SceneSize } from "../../scene/contract";
import { createBillboard } from "./draw-billboard";
import {
  drawBridge,
  drawGrid,
  drawLetters,
  drawPlatforms,
  drawPortals,
  drawStationMarks,
  drawUnderground,
} from "./draw-map";
import { drawCars, drawPeople, drawPuffs } from "./draw-train";
import { COMPACT_VIEW, FULL_VIEW, VIEW_WIDTH, VIEW_X0 } from "./map-view";
import { readSceneTokens, type Paint } from "./scene-tokens";

/** At or above this height a car is on the bridge, so it draws over it. */
const ON_BRIDGE_Z = 0.5;

export const createScene: CreateScene = ({
  canvas,
  world,
  nowItems,
  readToken,
}) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas context.");

  const billboard = createBillboard(nowItems);
  const groundStations = world.stations.filter(({ elevated }) => !elevated);
  const raisedStations = world.stations.filter(({ elevated }) => elevated);

  let view = FULL_VIEW;
  let compact = false;
  let cssScale = 1;
  let pixelScale = 1;
  let paint: Paint | null = null;

  // Refilled each frame rather than rebuilt, since this runs at the frame rate.
  const groundCars: Car[] = [];
  const bridgeCars: Car[] = [];
  const groundPeople: Person[] = [];
  const raisedPeople: Person[] = [];

  function sortMoversByLevel(): void {
    groundCars.length = 0;
    bridgeCars.length = 0;
    for (const car of world.cars) {
      if (!car.hidden)
        (car.z < ON_BRIDGE_Z ? groundCars : bridgeCars).push(car);
    }
    groundPeople.length = 0;
    raisedPeople.length = 0;
    for (const person of world.people) {
      (person.station.elevated ? raisedPeople : groundPeople).push(person);
    }
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
      if (!paint) return;
      ctx.setTransform(
        pixelScale,
        0,
        0,
        pixelScale,
        -VIEW_X0 * pixelScale,
        -view.y0 * pixelScale,
      );
      ctx.clearRect(VIEW_X0, view.y0, VIEW_WIDTH, view.height);
      // A resize resets these, so they are set here and not left from a past frame.
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      sortMoversByLevel();
      drawGrid(paint);
      drawUnderground(paint);
      drawPlatforms(paint, groundStations);
      drawLetters(paint);
      drawPortals(paint);
      drawStationMarks(paint);
      drawPeople(paint, groundPeople);
      drawCars(paint, groundCars);
      if (!compact) billboard.draw(paint, world.textTime);
      drawBridge(paint);
      drawPlatforms(paint, raisedStations);
      drawPeople(paint, raisedPeople);
      drawCars(paint, bridgeCars);
      drawPuffs(paint);
    },
    hitTrain({ x, y }, radius) {
      return world.hitTrain(
        x / cssScale + VIEW_X0,
        y / cssScale + view.y0,
        radius,
      );
    },
    applyColorScheme(scheme) {
      paint = { ctx, world, tokens: readSceneTokens(readToken, scheme) };
    },
    onFontsReady() {
      billboard.dropMeasurements();
    },
  };
};
