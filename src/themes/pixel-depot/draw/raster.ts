/**
 * The small buffer everything is painted into. Pixels are whole numbers packed the
 * way a `Uint32Array` over `ImageData` reads them on a little-endian machine.
 */
export type Pixel = number;

export type Rgb = readonly [red: number, green: number, blue: number];

/** Raised platforms, houses and the billboard, on what is under them. */
export const STRUCTURE_SHADOW = 0.7;
/** Trees and train cars, which sit closer to the ground. */
export const TREE_AND_CAR_SHADOW = 0.72;
/** The bridge deck, the darkest and widest shadow in the town. */
export const BRIDGE_SHADOW = 0.62;

const pack = (red: number, green: number, blue: number): Pixel =>
  (255 << 24) | (blue << 16) | (green << 8) | red;

const rgbByHex = new Map<string, Rgb>();

export function rgbOf(hex: string): Rgb {
  const known = rgbByHex.get(hex);
  if (known) return known;
  const value = parseInt(hex.slice(1), 16);
  const rgb: Rgb = [value >> 16, (value >> 8) & 255, value & 255];
  rgbByHex.set(hex, rgb);
  return rgb;
}

const pixelOfHex = new Map<string, Pixel>();

/** A `#rrggbb` colour as a pixel. */
export function solid(hex: string): Pixel {
  const known = pixelOfHex.get(hex);
  if (known !== undefined) return known;
  const pixel = pack(...rgbOf(hex));
  pixelOfHex.set(hex, pixel);
  return pixel;
}

/** A `#rrggbb` colour made lighter (over 1) or darker (under 1) as a pixel. */
export function shaded(hex: string, factor: number): Pixel {
  const [red, green, blue] = rgbOf(hex);
  return pack(
    Math.min(255, red * factor) | 0,
    Math.min(255, green * factor) | 0,
    Math.min(255, blue * factor) | 0,
  );
}

/** The same noise for the same pixel, so the ground never shimmers between frames. */
export function noiseAt(x: number, y: number): number {
  let mixed = (x * 374761393 + y * 668265263) | 0;
  mixed = (mixed ^ (mixed >>> 13)) * 1274126177;
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 4294967295;
}

/** Calls `paint` for every whole pixel within `radius` of a point. */
export function forEachInDisc(
  centreX: number,
  centreY: number,
  radius: number,
  paint: (x: number, y: number, distance: number) => void,
): void {
  const bottom = Math.ceil(centreY + radius);
  const right = Math.ceil(centreX + radius);
  for (let y = Math.floor(centreY - radius); y <= bottom; y += 1) {
    for (let x = Math.floor(centreX - radius); x <= right; x += 1) {
      const distance = Math.hypot(x + 0.5 - centreX, y + 0.5 - centreY);
      if (distance <= radius) paint(x, y, distance);
    }
  }
}

export class Raster {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint32Array;

  constructor(width: number, height: number, pixels: Uint32Array) {
    this.width = width;
    this.height = height;
    this.pixels = pixels;
  }

  /** Where a point lands in `pixels`, truncated to the grid, or -1 off the buffer. */
  private indexOf(x: number, y: number): number {
    const column = x | 0;
    const row = y | 0;
    if (column < 0 || row < 0 || column >= this.width || row >= this.height) {
      return -1;
    }
    return row * this.width + column;
  }

  set(x: number, y: number, pixel: Pixel): void {
    const index = this.indexOf(x, y);
    if (index >= 0) this.pixels[index] = pixel;
  }

  darken(x: number, y: number, factor: number): void {
    const index = this.indexOf(x, y);
    if (index < 0) return;
    const pixel = this.pixels[index];
    this.pixels[index] = pack(
      ((pixel & 255) * factor) | 0,
      (((pixel >> 8) & 255) * factor) | 0,
      (((pixel >> 16) & 255) * factor) | 0,
    );
  }

  lighten(x: number, y: number, added: Rgb): void {
    const index = this.indexOf(x, y);
    if (index < 0) return;
    const pixel = this.pixels[index];
    this.pixels[index] = pack(
      Math.min(255, (pixel & 255) + added[0]),
      Math.min(255, ((pixel >> 8) & 255) + added[1]),
      Math.min(255, ((pixel >> 16) & 255) + added[2]),
    );
  }
}
