/** The five kinds of car, built from a `CarPainter`'s parts. */
import type { Car, Livery } from "../../rail";
import {
  box,
  CAR_FLOOR,
  CAR_WIDTH,
  localToWorld,
  type CarPainter,
} from "./car-painter";
import type { Palette } from "./palette";
import { shade } from "./view";

export interface CarStyle {
  readonly colors: Livery["colors"];
  readonly isToy: boolean;
  readonly glass: string;
  readonly palette: Palette;
}

function drawCoach(painter: CarPainter, car: Car, style: CarStyle): void {
  const { colors, isToy, glass } = style;
  const isCoach = car.kind === "coach";
  const toyCoach = car.i % 2 ? colors.coach : colors.coach2;
  const coachColor = (isToy ? toyCoach : colors.coach) ?? colors.body;
  const faces = painter.prism(
    box(-car.len / 2, car.len / 2, CAR_WIDTH),
    CAR_FLOOR,
    9,
    isCoach ? coachColor : colors.body,
    isCoach ? (colors.coachRoof ?? colors.roof) : colors.roof,
  );
  painter.windows(faces, {
    base: CAR_FLOOR,
    low: 4,
    high: 7,
    glass,
    passengers: car.passengers,
  });
  painter.stripe(
    faces.filter((face) => face.length > 14),
    CAR_FLOOR + 2.3,
    colors.trim,
    1,
  );
  if (car.kind === "cab") {
    painter.screen(
      box(car.len / 2 - 3, car.len / 2 - 0.4, CAR_WIDTH - 3),
      CAR_FLOOR + 9.05,
      glass,
    );
  }
}

function drawNose(
  painter: CarPainter,
  car: Car,
  { colors, glass }: CarStyle,
): void {
  const half = CAR_WIDTH / 2;
  const end = car.len / 2;
  const faces = painter.prism(
    [
      [-end, -half],
      [end - 13, -half],
      [end - 5, -half * 0.62],
      [end, 0],
      [end - 5, half * 0.62],
      [end - 13, half],
      [-end, half],
    ],
    CAR_FLOOR,
    8.5,
    colors.body,
    colors.roof,
  );
  painter.windows(
    faces.filter((face) => face.length > 15),
    { base: CAR_FLOOR, low: 4, high: 6.5, glass, passengers: car.passengers },
  );
  painter.stripe(faces, CAR_FLOOR + 2.5, colors.trim, 1.3);
  painter.screen(
    [
      [end - 11, -3],
      [end - 5, -2],
      [end - 5, 2],
      [end - 11, 3],
    ],
    CAR_FLOOR + 8.55,
    glass,
  );
}

function drawTender(
  painter: CarPainter,
  car: Car,
  { colors, palette }: CarStyle,
): void {
  painter.prism(
    box(-car.len / 2, car.len / 2, CAR_WIDTH),
    CAR_FLOOR,
    7.5,
    colors.body,
    palette.tenderTop,
  );
}

function drawLoco(painter: CarPainter, car: Car, style: CarStyle): void {
  const { colors, isToy, glass, palette } = style;
  const length = car.len;
  const boiler = CAR_FLOOR + 1.5;
  const stackBase = CAR_FLOOR + 9.5;
  painter.prism(
    box(-length / 2, length / 2, CAR_WIDTH),
    CAR_FLOOR - 0.5,
    2,
    palette.locoBase,
  );
  const parts = [
    {
      x: -length / 2 + 5,
      paint: () => {
        const cabColor = isToy ? (colors.coach2 ?? colors.body) : colors.roof;
        const roof = isToy ? colors.roof : shade(colors.roof, 1.3);
        const faces = painter.prism(
          box(-length / 2, -length / 2 + 10, CAR_WIDTH),
          boiler,
          10,
          cabColor,
          roof,
        );
        // The cab is short, so it gets a window at the length a coach side would.
        painter.windows(
          faces
            .filter((face) => face.length > 9)
            .map((face) => ({ ...face, length: 14 })),
          { base: boiler, low: 5, high: 8, glass },
        );
      },
    },
    {
      x: 2,
      paint: () =>
        painter.prism(
          box(-length / 2 + 10, length / 2 - 5, CAR_WIDTH - 3),
          boiler,
          8,
          colors.body,
        ),
    },
    {
      x: length / 2 - 3,
      paint: () =>
        painter.prism(
          box(length / 2 - 5, length / 2 - 0.5, CAR_WIDTH - 3),
          boiler,
          8,
          colors.accent,
        ),
    },
    {
      x: length / 2 - 6,
      paint: () =>
        painter.prism(
          box(length / 2 - 7.5, length / 2 - 4.5, 3),
          stackBase,
          4.5,
          isToy ? colors.trim : palette.locoFunnel,
        ),
    },
    {
      x: 0,
      paint: () =>
        painter.prism(box(-1.5, 1.5, 3), stackBase, 2.2, colors.trim),
    },
  ];
  // Back to front, as the viewer sees it.
  parts
    .map((part) => ({ ...part, depth: localToWorld(car, part.x, 0)[1] }))
    .sort((a, b) => a.depth - b.depth)
    .forEach((part) => part.paint());
}

export const CAR_BODIES: Readonly<
  Record<Car["kind"], (painter: CarPainter, car: Car, style: CarStyle) => void>
> = {
  coach: drawCoach,
  cab: drawCoach,
  nose: drawNose,
  tender: drawTender,
  loco: drawLoco,
};
