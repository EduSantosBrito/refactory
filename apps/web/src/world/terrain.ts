/**
 * terrain.ts — Procedural terrain engine
 *
 * Pure, deterministic functions for height, biome, and ground color.
 * Uses sin-based value noise (no external libraries).
 */

/* ================================================================
   1. NOISE FUNCTIONS
   ================================================================ */

/**
 * Pseudo-random hash: maps integer grid coords to 0..1.
 * Uses the classic "fract(sin(dot) * bignum)" trick from shader code.
 * The `seed` parameter selects different hash families for decorrelated fields.
 */
function hash2D(x: number, z: number, seed: number = 0): number {
  const dot = x * 127.1 + z * 311.7 + seed * 1731.5;
  const s = Math.sin(dot) * 43758.5453123;
  return s - Math.floor(s);
}

/**
 * Hermite interpolation (smoothstep). Produces C1-continuous blending.
 */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * 2D value noise, range roughly -1 to 1.
 * Interpolates hashed grid corners with smoothstep.
 * `seed` decorrelates different noise fields.
 */
function noise2D(x: number, z: number, seed: number = 0): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  const sx = smoothstep(fx);
  const sz = smoothstep(fz);

  // Four grid-corner hashes remapped from 0..1 to -1..1
  const n00 = hash2D(ix, iz, seed) * 2 - 1;
  const n10 = hash2D(ix + 1, iz, seed) * 2 - 1;
  const n01 = hash2D(ix, iz + 1, seed) * 2 - 1;
  const n11 = hash2D(ix + 1, iz + 1, seed) * 2 - 1;

  // Bilinear interpolation with smoothstep weights
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sz;
}

/**
 * Fractal Brownian Motion — layer multiple octaves of noise.
 * Each successive octave has higher frequency and lower amplitude,
 * producing self-similar detail at multiple scales.
 */
function fbm(
  x: number,
  z: number,
  octaves: number = 4,
  lacunarity: number = 2.0,
  gain: number = 0.5,
  seed: number = 0,
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmplitude = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, z * frequency, seed + i * 17) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return value / maxAmplitude; // normalized to roughly -1..1
}

/* ================================================================
   2. HEIGHT MAP
   ================================================================ */

/** How far from origin the terrain is fully flattened (spawn area). */
const SPAWN_FLAT_RADIUS = 8;
/** Transition zone width beyond the flat radius. */
const SPAWN_BLEND_RADIUS = 6;

/** Maximum hill height in world units. */
const MAX_HEIGHT = 5;

/**
 * Returns terrain height at world position.
 * Base is 0, hills go up to ~4-5 units.
 * Continuous and smooth everywhere.
 */
export function heightAt(x: number, z: number): number {
  // Broad rolling hills — low frequency, 4 octaves
  const broad = fbm(x * 0.015, z * 0.015, 4, 2.0, 0.5, 0);

  // Medium terrain variation — mid frequency, 3 octaves, different seed
  const mid = fbm(x * 0.03, z * 0.03, 3, 2.0, 0.5, 100);

  // Small bumps — higher frequency, 2 octaves
  const bumps = fbm(x * 0.06, z * 0.06, 2, 2.0, 0.5, 200);

  // Combine layers: broad dominates, mid adds shape, bumps add texture
  const combined = broad * 0.55 + mid * 0.3 + bumps * 0.15;

  // The combined noise practically ranges about -0.45..0.50 over a 200-unit world.
  // Remap that to 0..1, then apply a gentle power curve for flatter valleys.
  let h01 = (combined + 0.45) / 0.95; // maps -0.45..0.50 to ~0..1
  h01 = Math.max(0, Math.min(1, h01));
  const h = h01 ** 1.3 * MAX_HEIGHT;

  // Flatten near origin for spawn area
  const dist = Math.sqrt(x * x + z * z);
  if (dist < SPAWN_FLAT_RADIUS) {
    return 0;
  }
  if (dist < SPAWN_FLAT_RADIUS + SPAWN_BLEND_RADIUS) {
    const t = (dist - SPAWN_FLAT_RADIUS) / SPAWN_BLEND_RADIUS;
    return h * smoothstep(t);
  }

  return h;
}

/* ================================================================
   3. BIOME SYSTEM
   ================================================================ */

export type Biome =
  | "forest"
  | "grassland"
  | "rocky"
  | "desert"
  | "swamp"
  | "hills";

/**
 * Returns a "moisture" value (0-1) at a world position.
 * Exported so water.ts can use it for water placement.
 *
 * Uses frequency 0.012 (higher than the spec's 0.008) so we sample enough
 * noise grid cells over the 200-unit world to get real variance. Biome
 * regions are still ~80 units across — large and coherent.
 */
export function moistureAt(x: number, z: number): number {
  // Layer two fbm passes at slightly different frequencies for richer variation
  const a = fbm(x * 0.012, z * 0.012, 3, 2.0, 0.5, 300);
  const b = fbm(x * 0.025, z * 0.025, 2, 2.0, 0.5, 350);
  const raw = a * 0.7 + b * 0.3;
  // Practical range is roughly -0.45..0.45; remap to 0..1
  return Math.max(0, Math.min(1, (raw + 0.45) / 0.9));
}

/**
 * Internal: temperature value (0-1) for biome selection.
 * Uses a completely different seed and slightly different frequency
 * for decorrelation from moisture.
 */
function temperatureAt(x: number, z: number): number {
  const a = fbm(x * 0.011, z * 0.011, 3, 2.0, 0.5, 500);
  const b = fbm(x * 0.023, z * 0.023, 2, 2.0, 0.5, 550);
  const raw = a * 0.7 + b * 0.3;
  return Math.max(0, Math.min(1, (raw + 0.45) / 0.9));
}

/**
 * Returns the biome at a given world position. Deterministic.
 *
 * Uses moisture + temperature to carve large, coherent regions:
 *
 *              low temp        mid temp        high temp
 *   high moist  swamp           forest          forest
 *   mid moist   grassland       grassland       hills
 *   low moist   rocky           desert          desert
 */
export function biomeAt(x: number, z: number): Biome {
  const moisture = moistureAt(x, z);
  const temp = temperatureAt(x, z);
  const h = heightAt(x, z);

  // Override: very elevated areas become hills regardless
  if (h > 4.0) return "hills";

  // High moisture — forest and swamp
  if (moisture > 0.6) {
    if (temp < 0.42) return "swamp";
    return "forest";
  }

  // Upper-mid moisture — grassland or hills
  if (moisture > 0.42) {
    if (temp > 0.62 && h > 2.2) return "hills";
    return "grassland";
  }

  // Lower-mid moisture — rocky, desert, or sparse grassland
  if (moisture > 0.28) {
    if (temp > 0.55) return "desert";
    return "rocky";
  }

  // Very low moisture — desert dominates
  if (temp < 0.45) return "rocky";
  return "desert";
}

/* ================================================================
   4. BIOME DENSITY
   ================================================================ */

const DENSITY_MAP: Record<Biome, number> = {
  forest: 0.6,
  grassland: 0.45,
  rocky: 0.3,
  desert: 0.15,
  swamp: 0.5,
  hills: 0.35,
};

/**
 * Returns spawn density (0-1) for nature elements in this biome.
 */
export function biomeDensity(biome: Biome): number {
  return DENSITY_MAP[biome];
}

/* ================================================================
   5. GROUND COLOR
   ================================================================ */

/**
 * Linearly interpolate between two RGB hex colors.
 */
function lerpColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);

  const cr = Math.round(ar + (br - ar) * t);
  const cg = Math.round(ag + (bg - ag) * t);
  const cb = Math.round(ab + (bb - ab) * t);

  return (
    "#" +
    cr.toString(16).padStart(2, "0") +
    cg.toString(16).padStart(2, "0") +
    cb.toString(16).padStart(2, "0")
  );
}

/**
 * Base colors for each biome (two shades for within-biome variation).
 */
const BIOME_COLORS: Record<Biome, [string, string]> = {
  forest: ["#3d7a35", "#4a8a3e"], // rich green
  grassland: ["#5d9a45", "#6daa55"], // light green
  rocky: ["#7a7060", "#8a806a"], // grey-brown
  desert: ["#c2a862", "#d4ba72"], // sandy brown
  swamp: ["#3a5a30", "#4a6638"], // dark olive
  hills: ["#5a7a42", "#6a8a4c"], // green-brown
};

/**
 * Returns a hex color string for the ground at this position.
 * Blends subtly within biomes using high-frequency noise for variation.
 */
export function groundColor(x: number, z: number): string {
  const biome = biomeAt(x, z);
  const [base, alt] = BIOME_COLORS[biome];

  // High-frequency noise for subtle per-position variation
  const variation = noise2D(x * 0.12, z * 0.12, 400);
  // Remap from -1..1 to 0..1
  const t = (variation + 1) * 0.5;

  return lerpColor(base, alt, t);
}
