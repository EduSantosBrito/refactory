/**
 * collision.ts — Circle-based collision system for nature elements.
 *
 * Pure TypeScript, no dependencies, deterministic.
 * Designed to run every frame during player movement.
 */

/* ================================================================
   TYPES
   ================================================================ */

export type NatureSize = "sm" | "md" | "lg";

export type NatureEl = {
  id: number;
  type: string;
  x: number;
  z: number;
  ry: number;
  sc: number;
  size: NatureSize;
};

/* ================================================================
   1. COLLISION RADIUS LOOKUP
   ================================================================ */

/**
 * Base collision radii per element type, keyed by size.
 * A radius of 0 means no collision (the player walks through it).
 */
const RADII: Record<string, Partial<Record<NatureSize, number>>> = {
  // Trees — trunk-based collision
  oak: { sm: 0.02, md: 0.06, lg: 0.12 },
  pine: { sm: 0.02, md: 0.06, lg: 0.12 },
  detailed: { sm: 0.02, md: 0.06, lg: 0.12 },
  flattop: { sm: 0.02, md: 0.06, lg: 0.12 },
  dead: { sm: 0.03, md: 0.05, lg: 0.05 },

  // Rocks — solid collision
  rock: { sm: 0.05, md: 0.08, lg: 0.12 },
  formation: { sm: 0.1, md: 0.15, lg: 0.2 },

  // Small obstacles
  bush: { sm: 0.04, md: 0.06, lg: 0.08 },
  stump: { sm: 0.04, md: 0.05, lg: 0.07 },
  log: { sm: 0.06, md: 0.06, lg: 0.06 },

  // No collision — player walks right through
  grass: {},
  flower: {},
  mushroom: {},
};

/**
 * Returns the base collision radius for a nature element type and size.
 * Returns 0 for types with no collision (grass, flower, mushroom) or
 * for unrecognized types.
 */
export function collisionRadius(type: string, size: NatureSize): number {
  const entry = RADII[type];
  if (!entry) return 0;
  return entry[size] ?? 0;
}

/* ================================================================
   2. COLLISION CHECKING
   ================================================================ */

/**
 * Check if a circle at (x, z) with the given radius collides with any
 * nature element. Returns true if a collision is detected.
 *
 * Uses circle-vs-circle: collision when the distance between centers
 * is less than the sum of both radii.
 */
export function checkCollision(
  x: number,
  z: number,
  playerRadius: number,
  elements: readonly NatureEl[],
): boolean {
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!el) continue;
    const baseR = collisionRadius(el.type, el.size);
    if (baseR === 0) continue;

    const effectiveRadius = baseR * el.sc;
    const combinedRadius = playerRadius + effectiveRadius;

    const dx = x - el.x;
    const dz = z - el.z;

    // Compare squared distances to avoid sqrt
    if (dx * dx + dz * dz < combinedRadius * combinedRadius) {
      return true;
    }
  }
  return false;
}

/* ================================================================
   3. SLIDE MOVEMENT
   ================================================================ */

/**
 * Given a desired move from (fromX, fromZ) to (toX, toZ), returns
 * the adjusted destination that slides along collision surfaces
 * instead of stopping dead.
 *
 * Strategy:
 *  1. Try the full move. If clear, take it.
 *  2. Try moving only on the X axis (keep Z). If clear, take it.
 *  3. Try moving only on the Z axis (keep X). If clear, take it.
 *  4. All blocked — stay put.
 */
export function slideMovement(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  playerRadius: number,
  elements: readonly NatureEl[],
): [number, number] {
  // Full move
  if (!checkCollision(toX, toZ, playerRadius, elements)) {
    return [toX, toZ];
  }

  // Slide along X only
  if (!checkCollision(toX, fromZ, playerRadius, elements)) {
    return [toX, fromZ];
  }

  // Slide along Z only
  if (!checkCollision(fromX, toZ, playerRadius, elements)) {
    return [fromX, toZ];
  }

  // Completely blocked
  return [fromX, fromZ];
}

/* ================================================================
   4. SPATIAL HASH
   ================================================================ */

/**
 * Cell size for the spatial hash grid. Must be larger than the maximum
 * possible effective collision radius so that a query never misses an
 * element in an adjacent cell.
 *
 * Largest base radius = 0.20 (formation lg).
 * Maximum scale = ~7.
 * Max effective radius = 0.20 * 7 = 1.4 world units.
 * Using 4 keeps cells large enough that a player + element collision
 * (playerRadius ~0.3 + 1.4 = 1.7) never spans more than one ring of
 * neighbors.
 */
const CELL_SIZE = 4;
const INV_CELL_SIZE = 1 / CELL_SIZE;

export type SpatialHash = {
  cells: Map<number, NatureEl[]>;
  cellSize: number;
};

/** Convert world coordinates to a cell key. */
function cellKey(cx: number, cz: number): number {
  // Offset to make negative coordinates positive before hashing.
  // Supports worlds up to ~65 000 units in each direction.
  const ox = (cx + 32768) | 0;
  const oz = (cz + 32768) | 0;
  return ox * 65536 + oz;
}

/** World coordinate to cell index (integer). */
function toCell(v: number): number {
  return Math.floor(v * INV_CELL_SIZE);
}

/**
 * Build a spatial hash from an array of nature elements.
 * Only elements with a non-zero collision radius are inserted.
 */
export function buildSpatialHash(elements: readonly NatureEl[]): SpatialHash {
  const cells = new Map<number, NatureEl[]>();

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!el) continue;
    if (collisionRadius(el.type, el.size) === 0) continue;

    const cx = toCell(el.x);
    const cz = toCell(el.z);
    const key = cellKey(cx, cz);

    let bucket = cells.get(key);
    if (!bucket) {
      bucket = [];
      cells.set(key, bucket);
    }
    bucket.push(el);
  }

  return { cells, cellSize: CELL_SIZE };
}

/**
 * Query all collidable nature elements near (x, z) within the given
 * radius. Returns elements from the containing cell and its 8 neighbors.
 *
 * The returned array may contain elements further than `radius` — the
 * caller should still do precise distance checks. This is a broad-phase
 * cull to avoid iterating every element in the world.
 */
export function queryNearby(
  hash: SpatialHash,
  x: number,
  z: number,
  radius: number,
): NatureEl[] {
  const result: NatureEl[] = [];

  // Determine the range of cells that could contain relevant elements.
  const minCx = toCell(x - radius);
  const maxCx = toCell(x + radius);
  const minCz = toCell(z - radius);
  const maxCz = toCell(z + radius);

  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cz = minCz; cz <= maxCz; cz++) {
      const bucket = hash.cells.get(cellKey(cx, cz));
      if (bucket) {
        for (let i = 0; i < bucket.length; i++) {
          const element = bucket[i];
          if (element) {
            result.push(element);
          }
        }
      }
    }
  }

  return result;
}

/* ================================================================
   5. HIGH-LEVEL HELPERS (combine spatial hash + collision)
   ================================================================ */

/**
 * Check collision using a spatial hash for O(1) neighbor lookup.
 * `searchRadius` is the maximum distance at which an element could
 * possibly collide with the player (playerRadius + max effective radius).
 */
export function checkCollisionSpatial(
  x: number,
  z: number,
  playerRadius: number,
  hash: SpatialHash,
  searchRadius: number = playerRadius + 1.5,
): boolean {
  const nearby = queryNearby(hash, x, z, searchRadius);
  return checkCollision(x, z, playerRadius, nearby);
}

/**
 * Slide movement using a spatial hash for efficient lookups.
 */
export function slideMovementSpatial(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  playerRadius: number,
  hash: SpatialHash,
  searchRadius: number = playerRadius + 1.5,
): [number, number] {
  // Gather elements near both the origin and destination.
  // Use the bounding box of the move + search radius to catch everything.
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const midX = (fromX + toX) * 0.5;
  const midZ = (fromZ + toZ) * 0.5;
  const halfSpan = Math.sqrt(dx * dx + dz * dz) * 0.5 + searchRadius;

  const nearby = queryNearby(hash, midX, midZ, halfSpan);
  return slideMovement(fromX, fromZ, toX, toZ, playerRadius, nearby);
}
