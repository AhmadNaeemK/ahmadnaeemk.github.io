import { describe, expect, it } from "vitest";
import type { Car } from "../../rail";
import { isTrainAt } from "./train";
import { GROUND_SQUASH, projectY } from "./view";

const RADIUS = 20;
/** How high above the rail the middle of a car is drawn. */
const DRAWN_MIDDLE = 6;

const carAt = (place: Partial<Car> & { x: number; y: number }): Car =>
  ({ z: 0, hidden: false, ...place }) as Car;

const middleOf = ({ x, y, z }: Car) => ({
  x,
  y: projectY(y, z + DRAWN_MIDDLE),
});

describe("isTrainAt", () => {
  const groundCar = carAt({ x: 100, y: 100 });

  it("finds a car at the middle of where it is drawn", () => {
    expect(isTrainAt([groundCar], middleOf(groundCar), RADIUS)).toBe(true);
  });

  it("compares sideways distance with the radius, in world units", () => {
    const { x, y } = middleOf(groundCar);
    expect(isTrainAt([groundCar], { x: x + RADIUS - 1, y }, RADIUS)).toBe(true);
    expect(isTrainAt([groundCar], { x: x + RADIUS + 1, y }, RADIUS)).toBe(
      false,
    );
  });

  it("stretches the squashed vertical back, so a click is as far on the ground as it looks", () => {
    const { x, y } = middleOf(groundCar);
    const reach = (worldUnits: number) => worldUnits * GROUND_SQUASH;
    expect(
      isTrainAt([groundCar], { x, y: y + reach(RADIUS - 1) }, RADIUS),
    ).toBe(true);
    expect(
      isTrainAt([groundCar], { x, y: y + reach(RADIUS + 1) }, RADIUS),
    ).toBe(false);
    // The same distance on screen is in reach sideways, and out of reach up the board.
    const onScreen = RADIUS * 0.9;
    expect(isTrainAt([groundCar], { x: x + onScreen, y }, RADIUS)).toBe(true);
    expect(isTrainAt([groundCar], { x, y: y + onScreen }, RADIUS)).toBe(false);
  });

  it("ignores a car hidden in a tunnel, even exactly there", () => {
    const hidden = carAt({ x: 100, y: 100, hidden: true });
    expect(isTrainAt([hidden], middleOf(hidden), RADIUS)).toBe(false);
  });

  it("still finds a visible car when another is hidden", () => {
    const hidden = carAt({ x: 100, y: 100, hidden: true });
    const visible = carAt({ x: 300, y: 100 });
    expect(isTrainAt([hidden, visible], middleOf(visible), RADIUS)).toBe(true);
  });

  it("finds a car lifted by the bridge where it is drawn, not on the ground below", () => {
    const lifted = carAt({ x: 100, y: 7, z: 16 });
    expect(isTrainAt([lifted], middleOf(lifted), RADIUS)).toBe(true);
    expect(
      isTrainAt([lifted], { x: lifted.x, y: projectY(lifted.y) }, RADIUS),
    ).toBe(false);
  });

  it("finds nothing with no cars", () => {
    expect(isTrainAt([], { x: 0, y: 0 }, RADIUS)).toBe(false);
  });
});
