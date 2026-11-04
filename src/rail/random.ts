export type Random = () => number;

const INCREMENT = 0x6d2b79f5;
const TWO_POW_32 = 4294967296;

/** Mulberry32. Each world owns one, so a seed always gives the same world. */
export function createRandom(seed: number): Random {
  let state = seed | 0;
  return () => {
    state = (state + INCREMENT) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / TWO_POW_32;
  };
}
