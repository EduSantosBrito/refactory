/**
 * surface.ts — Effective terrain surface height
 *
 * Combines the raw terrain heightmap with water depressions and shore slopes
 * so the rendered mesh and the player always agree on the ground height.
 */

import { heightAt } from "./terrain";
import { isInWater, lakeDepthFactor } from "./water";

/** Max depth the lake bed sinks below the water surface. */
const LAKE_BED_DEPTH = 1.5;

/** Width of the shore slope on the land side (world units). */
const SHORE_SLOPE_WIDTH = 3;

/** How many radial directions to sample when estimating water proximity. */
const SAMPLE_DIRECTIONS = 8;

/** Steps per direction for water distance search. */
const SAMPLE_STEPS = 4;

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Estimates the distance from a land point to the nearest water edge.
 * Returns 0 if the point is in water.
 * Returns `maxSearch` if no water is found within range.
 */
function nearestWaterDistance(x: number, z: number, maxSearch: number): number {
  if (isInWater(x, z)) return 0;

  let minDist = maxSearch;

  for (let d = 0; d < SAMPLE_DIRECTIONS; d++) {
    const angle = (d / SAMPLE_DIRECTIONS) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);

    for (let s = 1; s <= SAMPLE_STEPS; s++) {
      const dist = (s / SAMPLE_STEPS) * minDist;
      if (isInWater(x + dx * dist, z + dz * dist)) {
        minDist = Math.min(minDist, dist);
        break;
      }
    }
  }

  return minDist;
}

/**
 * Returns the effective terrain surface height at a world position.
 *
 * - In water: returns the water bed depth (smooth bowl).
 * - On land near water: smoothly ramps terrain down toward water level.
 * - Elsewhere: returns the raw terrain height from `heightAt()`.
 *
 * Use this instead of `heightAt()` for anything that needs to match
 * the rendered terrain mesh (player position, nature placement, etc.).
 */
export function surfaceHeightAt(x: number, z: number): number {
  if (isInWater(x, z)) {
    const df = lakeDepthFactor(x, z);
    const depthT = df >= 0 ? Math.min(df * 2.5, 1) : 0.5;
    return -0.2 - depthT * LAKE_BED_DEPTH;
  }

  const h = heightAt(x, z);

  // Shore slope: smoothly lower terrain toward water level near water edges
  const waterDist = nearestWaterDistance(x, z, SHORE_SLOPE_WIDTH);
  if (waterDist < SHORE_SLOPE_WIDTH) {
    const t = waterDist / SHORE_SLOPE_WIDTH;
    return h * smoothstep(t);
  }

  return h;
}
