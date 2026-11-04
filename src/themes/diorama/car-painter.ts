/** Paints one car's parts: prisms lit by which way each side faces. */
import type { Car, Passenger } from "../../rail";
import { projectY, shade } from "./view";

type Point3 = readonly [x: number, y: number, z: number];
export type Footprint = readonly (readonly [number, number])[];

export interface Face {
  readonly a: Point3;
  readonly b: Point3;
  readonly length: number;
}

interface WindowRow {
  readonly base: number;
  readonly low: number;
  readonly high: number;
  readonly glass: string;
  readonly passengers?: readonly Passenger[] | null;
}

export const CAR_WIDTH = 11;
export const CAR_FLOOR = 2.5;

export const localToWorld = (
  car: Car,
  localX: number,
  localY: number,
): Point3 => {
  const cos = Math.cos(car.a);
  const sin = Math.sin(car.a);
  const x = car.rev ? -localX : localX;
  return [
    car.x + cos * x - sin * localY,
    car.y + sin * x + cos * localY,
    car.z + (car.pitch ?? 0) * (x / (car.len * 0.76 || 1)),
  ];
};

export const box = (x0: number, x1: number, width: number): Footprint => [
  [x0, -width / 2],
  [x1, -width / 2],
  [x1, width / 2],
  [x0, width / 2],
];

/** A painter for one car, holding what its parts all need. */
export class CarPainter {
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly car: Car,
    private readonly dim: number,
    private readonly edge: string,
  ) {}

  private tracePlan(points: readonly Point3[], height: number): void {
    const { ctx } = this;
    ctx.beginPath();
    points.forEach(([x, y, z], index) => {
      if (index === 0) ctx.moveTo(x, projectY(y, z + height));
      else ctx.lineTo(x, projectY(y, z + height));
    });
  }

  /** Paints a raised footprint, and returns the sides facing the viewer. */
  prism(
    footprint: Footprint,
    base: number,
    height: number,
    color: string,
    topColor?: string,
  ): Face[] {
    const { ctx, car, dim } = this;
    const corners = footprint.map(([x, y]) => localToWorld(car, x, y));
    const centreX = corners.reduce((sum, p) => sum + p[0], 0) / corners.length;
    const centreY = corners.reduce((sum, p) => sum + p[1], 0) / corners.length;
    const faces: Face[] = [];
    corners.forEach((a, index) => {
      const b = corners[(index + 1) % corners.length];
      const length = Math.hypot(b[1] - a[1], b[0] - a[0]) || 1;
      let normalX = (b[1] - a[1]) / length;
      let normalY = -(b[0] - a[0]) / length;
      const outward =
        normalX * ((a[0] + b[0]) / 2 - centreX) +
        normalY * ((a[1] + b[1]) / 2 - centreY);
      if (outward < 0) {
        normalX = -normalX;
        normalY = -normalY;
      }
      if (normalY <= 0.02) return;
      ctx.fillStyle = shade(
        color,
        (0.72 + 0.16 * normalY - 0.12 * normalX) * dim,
      );
      this.quad(a, b, base, base + height);
      ctx.fill();
      faces.push({ a, b, length });
    });
    ctx.fillStyle = shade(topColor ?? color, (topColor ? 1 : 1.08) * dim);
    this.tracePlan(corners, base + height);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = this.edge;
    ctx.lineWidth = 0.45;
    ctx.stroke();
    return faces;
  }

  private quad(a: Point3, b: Point3, low: number, high: number): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(a[0], projectY(a[1], a[2] + low));
    ctx.lineTo(b[0], projectY(b[1], b[2] + low));
    ctx.lineTo(b[0], projectY(b[1], b[2] + high));
    ctx.lineTo(a[0], projectY(a[1], a[2] + high));
    ctx.closePath();
  }

  windows(
    faces: readonly Face[],
    { base, low, high, glass, passengers }: WindowRow,
  ): void {
    const { ctx } = this;
    for (const face of faces) {
      if (face.length < 14) continue;
      const count = Math.floor((face.length - 4) / 4.5);
      for (let index = 0; index < count; index += 1) {
        const along = (distance: number): Point3 => {
          const t = distance / face.length;
          return [
            face.a[0] + (face.b[0] - face.a[0]) * t,
            face.a[1] + (face.b[1] - face.a[1]) * t,
            face.a[2] + (face.b[2] - face.a[2]) * t,
          ];
        };
        const start = 2.5 + index * 4.5;
        const p0 = along(start);
        const p1 = along(start + 3);
        ctx.fillStyle = glass;
        this.quad(p0, p1, base + low, base + high);
        ctx.fill();
        const passenger = passengers?.[index];
        if (passenger) {
          ctx.fillStyle = passenger.color;
          this.quad(
            [p0[0] + 0.5, p0[1], p0[2]],
            [p1[0] - 0.5, p1[1], p1[2]],
            base + low,
            base + low + 1.6,
          );
          ctx.fill();
        }
      }
    }
  }

  stripe(
    faces: readonly Face[],
    height: number,
    color: string,
    width: number,
  ): void {
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const { a, b } of faces) {
      ctx.beginPath();
      ctx.moveTo(a[0], projectY(a[1], a[2] + height));
      ctx.lineTo(b[0], projectY(b[1], b[2] + height));
      ctx.stroke();
    }
  }

  /** A windscreen laid flat on the roof. */
  screen(footprint: Footprint, height: number, glass: string): void {
    const { ctx, car } = this;
    ctx.fillStyle = glass;
    this.tracePlan(
      footprint.map(([x, y]) => localToWorld(car, x, y)),
      height,
    );
    ctx.fill();
  }

  shadow(color: string): void {
    const { ctx, car } = this;
    ctx.fillStyle = color;
    this.tracePlan(
      box(-car.len / 2, car.len / 2, CAR_WIDTH).map(([x, y]) =>
        localToWorld(car, x + 1.5, y + 1.5),
      ),
      1,
    );
    ctx.fill();
  }
}
