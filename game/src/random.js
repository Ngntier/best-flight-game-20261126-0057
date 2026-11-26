// Ridge Runner — seeded randomness.
// Deterministic by design: the same seed always builds the same canyon, the
// same rings and the same clouds, so `?seed=N` replays a run exactly and the
// screenshots are reproducible. No Math.random anywhere in the game.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer-lattice hash: a stable pseudo-random value in [0, 1) for any
// (x, z) cell, mixed with the run seed so different seeds reshape the world.
export function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// 2D value noise: smooth, continuous, deterministic. Coordinates are in feet,
// so the frequency is set by the caller dividing them down first.
export function noise2(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const u = smooth(fx);
  const v = smooth(fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Fractal noise: two octaves, enough for rolling terrain without banding.
export function fbm2(x, z, seed) {
  const n1 = noise2(x, z, seed);
  const n2 = noise2(x * 2.13 + 7.7, z * 2.13 + 3.1, seed + 101);
  return n1 * 0.65 + n2 * 0.35;
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Smoothstep between two edges, 0 below lo, 1 above hi.
export function smoothstep(lo, hi, value) {
  if (value <= lo) return 0;
  if (value >= hi) return 1;
  return smooth((value - lo) / (hi - lo));
}

// Shortest signed angle difference, wrapped to [-PI, PI].
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
