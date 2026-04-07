import { memo, useMemo, createElement } from "react";
import * as THREE from "three";

// ── Colors ──────────────────────────────────────────────────

export const WATER_COLOR = "#3a8898";
export const WATER_DEEP_COLOR = "#2a6878";

// ── Type definitions ────────────────────────────────────────

export type LakeDef = {
  cx: number;
  cz: number;
  baseRadius: number;
  noiseFreq: number;
  noiseAmp: number;
  rotation?: number;
};

export type RiverDef = {
  points: [number, number][];
  width: number | ((t: number) => number);
};

// ── Lake and river definitions ──────────────────────────────

export const LAKES: LakeDef[] = [
  // Main lake: large, center-left
  { cx: -30, cz: -25, baseRadius: 18, noiseFreq: 3.2, noiseAmp: 3.5, rotation: 0.15 },
  // Smaller lake: northeast
  { cx: 50, cz: 45, baseRadius: 12, noiseFreq: 4.0, noiseAmp: 2.8, rotation: -0.3 },
  // Pond: small, near center-south
  { cx: 15, cz: -50, baseRadius: 6, noiseFreq: 5.0, noiseAmp: 1.2, rotation: 0.5 },
  // Secondary pond: northwest
  { cx: -60, cz: 55, baseRadius: 8, noiseFreq: 3.8, noiseAmp: 1.8, rotation: -0.1 },
];

export const RIVERS: RiverDef[] = [
  // Main river: meanders from northwest to southeast, passing between the lakes
  {
    points: [
      [-95, 35],
      [-80, 28],
      [-65, 32],
      [-52, 22],
      [-40, 15],
      [-28, 8],
      [-15, 12],
      [-2, 5],
      [12, -2],
      [25, -8],
      [38, -15],
      [50, -22],
      [62, -30],
      [72, -42],
      [80, -55],
      [88, -70],
      [95, -80],
    ],
    width: (t: number) => 5 + Math.sin(t * Math.PI * 3.2) * 1.5 + Math.sin(t * Math.PI * 7.1) * 0.8,
  },
  // Creek: branches off near center, runs toward the northeast lake
  {
    points: [
      [-5, 8],
      [5, 15],
      [12, 24],
      [20, 30],
      [28, 35],
      [36, 38],
      [42, 42],
    ],
    width: (t: number) => 2.5 + Math.sin(t * Math.PI * 4.5) * 0.7,
  },
];

// ── Deterministic sin-based noise ───────────────────────────
// Simple multi-octave sine noise, no external dependencies.
// Same style as terrain.ts — purely deterministic.

function sineNoise1D(x: number): number {
  return (
    Math.sin(x * 1.0 + 0.3) * 0.5 +
    Math.sin(x * 2.3 + 1.7) * 0.3 +
    Math.sin(x * 4.1 + 0.9) * 0.15 +
    Math.sin(x * 7.7 + 2.1) * 0.05
  );
}

// ── Precomputed lake boundaries for fast isInWater ──────────

const LAKE_BOUNDARY_SAMPLES = 64;

type LakeCache = {
  cx: number;
  cz: number;
  cosR: number;
  sinR: number;
  radii: Float32Array; // precomputed radius at each sample angle
  maxRadius: number; // for quick bounding-circle reject
};

function buildLakeCache(lake: LakeDef): LakeCache {
  const radii = new Float32Array(LAKE_BOUNDARY_SAMPLES);
  let maxRadius = 0;
  const rot = lake.rotation ?? 0;

  for (let i = 0; i < LAKE_BOUNDARY_SAMPLES; i++) {
    const angle = (i / LAKE_BOUNDARY_SAMPLES) * Math.PI * 2;
    const noiseVal = sineNoise1D(angle * lake.noiseFreq);
    const r = lake.baseRadius + noiseVal * lake.noiseAmp;
    radii[i] = r;
    if (r > maxRadius) maxRadius = r;
  }

  return {
    cx: lake.cx,
    cz: lake.cz,
    cosR: Math.cos(rot),
    sinR: Math.sin(rot),
    radii,
    maxRadius: maxRadius + 1, // small margin
  };
}

const lakeCaches: LakeCache[] = LAKES.map(buildLakeCache);

// ── Precomputed river segments for fast isInWater ───────────

type RiverSegment = {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  dirX: number;
  dirZ: number;
  length: number;
  widthA: number;
  widthB: number;
  // bounding box for quick reject
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

function buildRiverSegments(river: RiverDef): RiverSegment[] {
  const pts = river.points;
  if (pts.length < 2) return [];

  // Use catmull-rom subdivision for smoother centerline
  const subdivided = catmullRomSubdivide(pts, 4);
  const segments: RiverSegment[] = [];
  const totalLen = subdivided.length - 1;

  for (let i = 0; i < subdivided.length - 1; i++) {
    const [ax, az] = subdivided[i]!;
    const [bx, bz] = subdivided[i + 1]!;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.001) continue;

    const tA = i / totalLen;
    const tB = (i + 1) / totalLen;
    const wA = typeof river.width === "number" ? river.width : river.width(tA);
    const wB = typeof river.width === "number" ? river.width : river.width(tB);
    const maxW = Math.max(wA, wB);

    segments.push({
      ax,
      az,
      bx,
      bz,
      dirX: dx / len,
      dirZ: dz / len,
      length: len,
      widthA: wA * 0.5,
      widthB: wB * 0.5,
      minX: Math.min(ax, bx) - maxW,
      maxX: Math.max(ax, bx) + maxW,
      minZ: Math.min(az, bz) - maxW,
      maxZ: Math.max(az, bz) + maxW,
    });
  }

  return segments;
}

function catmullRomSubdivide(points: [number, number][], subdivisions: number): [number, number][] {
  if (points.length < 2) return [...points];

  const result: [number, number][] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(i + 2, points.length - 1)]!;

    for (let s = 0; s < subdivisions; s++) {
      const t = s / subdivisions;
      const t2 = t * t;
      const t3 = t2 * t;

      const x =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);

      const z =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);

      result.push([x, z]);
    }
  }

  // Add the final point
  result.push(points[points.length - 1]!);
  return result;
}

const riverSegmentSets: RiverSegment[][] = RIVERS.map(buildRiverSegments);

// ── isInWater ───────────────────────────────────────────────

/** Returns true if world position (x, z) is inside any water body. */
export function isInLake(x: number, z: number): boolean {
  for (let li = 0; li < lakeCaches.length; li++) {
    const lake = lakeCaches[li]!;

    // Quick bounding-circle reject
    const rawDx = x - lake.cx;
    const rawDz = z - lake.cz;
    const distSq = rawDx * rawDx + rawDz * rawDz;
    if (distSq > lake.maxRadius * lake.maxRadius) continue;

    // Apply rotation
    const dx = rawDx * lake.cosR + rawDz * lake.sinR;
    const dz = -rawDx * lake.sinR + rawDz * lake.cosR;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Get angle and look up precomputed radius
    const angle = Math.atan2(dz, dx);
    const normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;
    const sampleIdx = (normalizedAngle / (Math.PI * 2)) * LAKE_BOUNDARY_SAMPLES;
    const idx0 = Math.floor(sampleIdx) % LAKE_BOUNDARY_SAMPLES;
    const idx1 = (idx0 + 1) % LAKE_BOUNDARY_SAMPLES;
    const frac = sampleIdx - Math.floor(sampleIdx);

    // Linearly interpolate between adjacent samples for smooth boundary
    const r0 = lake.radii[idx0]!;
    const r1 = lake.radii[idx1]!;
    const effectiveRadius = r0 + (r1 - r0) * frac;

    if (dist < effectiveRadius) return true;
  }

  return false;
}

/**
 * Returns a depth factor for a point in a lake (0 at edge, 1 at center).
 * Returns -1 if not in any lake. Used to create smooth bank slopes.
 */
export function lakeDepthFactor(x: number, z: number): number {
  for (let li = 0; li < lakeCaches.length; li++) {
    const lake = lakeCaches[li]!;

    const rawDx = x - lake.cx;
    const rawDz = z - lake.cz;
    const distSq = rawDx * rawDx + rawDz * rawDz;
    if (distSq > lake.maxRadius * lake.maxRadius) continue;

    const dx = rawDx * lake.cosR + rawDz * lake.sinR;
    const dz = -rawDx * lake.sinR + rawDz * lake.cosR;
    const dist = Math.sqrt(dx * dx + dz * dz);

    const angle = Math.atan2(dz, dx);
    const normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;
    const sampleIdx = (normalizedAngle / (Math.PI * 2)) * LAKE_BOUNDARY_SAMPLES;
    const idx0 = Math.floor(sampleIdx) % LAKE_BOUNDARY_SAMPLES;
    const idx1 = (idx0 + 1) % LAKE_BOUNDARY_SAMPLES;
    const frac = sampleIdx - Math.floor(sampleIdx);

    const r0 = lake.radii[idx0]!;
    const r1 = lake.radii[idx1]!;
    const effectiveRadius = r0 + (r1 - r0) * frac;

    if (dist < effectiveRadius) {
      // 0 at the edge, 1 at center
      return 1 - dist / effectiveRadius;
    }
  }
  return -1;
}

/** Returns true if world position (x, z) is inside any water body. */
export function isInWater(x: number, z: number): boolean {
  if (isInLake(x, z)) return true;

  // Check rivers
  for (let ri = 0; ri < riverSegmentSets.length; ri++) {
    const segments = riverSegmentSets[ri]!;
    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si]!;

      // Quick AABB reject
      if (x < seg.minX || x > seg.maxX || z < seg.minZ || z > seg.maxZ) continue;

      // Project point onto segment
      const pax = x - seg.ax;
      const paz = z - seg.az;
      const dot = pax * seg.dirX + paz * seg.dirZ;
      const t = Math.max(0, Math.min(seg.length, dot));

      // Closest point on segment
      const closestX = seg.ax + seg.dirX * t;
      const closestZ = seg.az + seg.dirZ * t;

      // Perpendicular distance
      const perpX = x - closestX;
      const perpZ = z - closestZ;
      const perpDist = Math.sqrt(perpX * perpX + perpZ * perpZ);

      // Interpolate width along segment
      const tNorm = t / seg.length;
      const halfWidth = seg.widthA + (seg.widthB - seg.widthA) * tNorm;

      if (perpDist < halfWidth) return true;
    }
  }

  return false;
}

// ── Geometry builders ───────────────────────────────────────

const LAKE_PERIMETER_SAMPLES = 48;

function buildLakeShape(lake: LakeDef): THREE.Shape {
  const shape = new THREE.Shape();
  const rot = lake.rotation ?? 0;
  const cosR = Math.cos(-rot); // inverse rotation for shape points
  const sinR = Math.sin(-rot);

  for (let i = 0; i < LAKE_PERIMETER_SAMPLES; i++) {
    const angle = (i / LAKE_PERIMETER_SAMPLES) * Math.PI * 2;
    const noiseVal = sineNoise1D(angle * lake.noiseFreq);
    const r = lake.baseRadius + noiseVal * lake.noiseAmp;

    // Point in rotated local space
    const lx = Math.cos(angle) * r;
    const lz = Math.sin(angle) * r;

    // Un-rotate to get world-relative offset (since the mesh is placed at cx,cz)
    const wx = lx * cosR + lz * sinR;
    const wz = -lx * sinR + lz * cosR;

    if (i === 0) {
      shape.moveTo(wx, wz);
    } else {
      shape.lineTo(wx, wz);
    }
  }

  shape.closePath();
  return shape;
}

function buildRiverGeometry(river: RiverDef): THREE.BufferGeometry {
  const pts = river.points;
  if (pts.length < 2) return new THREE.BufferGeometry();

  // Use the same catmull-rom subdivision as the collision
  const subdivided = catmullRomSubdivide(pts, 4);
  const totalLen = subdivided.length - 1;

  // Build left/right bank points
  const leftBank: THREE.Vector2[] = [];
  const rightBank: THREE.Vector2[] = [];

  for (let i = 0; i < subdivided.length; i++) {
    const [px, pz] = subdivided[i]!;
    const t = i / totalLen;
    const halfW = (typeof river.width === "number" ? river.width : river.width(t)) * 0.5;

    // Compute tangent direction
    let tx: number, tz: number;
    if (i === 0) {
      tx = subdivided[1]![0] - px;
      tz = subdivided[1]![1] - pz;
    } else if (i === subdivided.length - 1) {
      tx = px - subdivided[i - 1]![0];
      tz = pz - subdivided[i - 1]![1];
    } else {
      tx = subdivided[i + 1]![0] - subdivided[i - 1]![0];
      tz = subdivided[i + 1]![1] - subdivided[i - 1]![1];
    }

    const tLen = Math.sqrt(tx * tx + tz * tz);
    if (tLen < 0.001) {
      // Degenerate, use previous direction or skip
      if (leftBank.length > 0) {
        leftBank.push(leftBank[leftBank.length - 1]!.clone());
        rightBank.push(rightBank[rightBank.length - 1]!.clone());
      }
      continue;
    }

    // Normal perpendicular to tangent (rotate 90 degrees)
    const nx = -tz / tLen;
    const nz = tx / tLen;

    leftBank.push(new THREE.Vector2(px + nx * halfW, pz + nz * halfW));
    rightBank.push(new THREE.Vector2(px - nx * halfW, pz - nz * halfW));
  }

  // Triangulate as a ribbon
  const vertices: number[] = [];
  const count = Math.min(leftBank.length, rightBank.length);

  for (let i = 0; i < count - 1; i++) {
    const l0 = leftBank[i]!;
    const r0 = rightBank[i]!;
    const l1 = leftBank[i + 1]!;
    const r1 = rightBank[i + 1]!;

    const midX = (l0.x + r0.x + l1.x + r1.x) * 0.25;
    const midZ = (l0.y + r0.y + l1.y + r1.y) * 0.25;
    if (isInLake(midX, midZ)) {
      continue;
    }

    // Triangle 1: l0, l1, r0 (CCW winding → normal faces up)
    vertices.push(l0.x, 0, l0.y);
    vertices.push(l1.x, 0, l1.y);
    vertices.push(r0.x, 0, r0.y);

    // Triangle 2: r0, l1, r1
    vertices.push(r0.x, 0, r0.y);
    vertices.push(l1.x, 0, l1.y);
    vertices.push(r1.x, 0, r1.y);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  return geo;
}

// ── React component ─────────────────────────────────────────

/** Renders all water surfaces (lakes + rivers). Place this in the scene. */
export const WaterSurface = memo(function WaterSurface() {
  const { lakeGeos, riverGeos } = useMemo(() => {
    const lakeGeos: THREE.ShapeGeometry[] = [];

    for (const lake of LAKES) {
      const shape = buildLakeShape(lake);
      lakeGeos.push(new THREE.ShapeGeometry(shape, 1));
    }

    const riverGeos = RIVERS.map((river) => buildRiverGeometry(river));

    return { lakeGeos, riverGeos };
  }, []);

  // Build children array for the group
  const children: ReturnType<typeof createElement>[] = [];

  // Lake surfaces
  for (let i = 0; i < LAKES.length; i++) {
    const lake = LAKES[i]!;
    children.push(
      createElement(
        "mesh",
        {
          key: `lake-${i}`,
          rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
          position: [lake.cx, 0.01, lake.cz] as [number, number, number],
          geometry: lakeGeos[i],
        },
        createElement("meshStandardMaterial", {
          color: WATER_COLOR,
          roughness: 0.2,
          metalness: 0.05,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        }),
      ),
    );
  }

  // River surfaces
  for (let i = 0; i < RIVERS.length; i++) {
    children.push(
      createElement(
        "mesh",
        {
          key: `river-${i}`,
          position: [0, 0.01, 0] as [number, number, number],
          geometry: riverGeos[i],
        },
        createElement("meshStandardMaterial", {
          color: WATER_COLOR,
          roughness: 0.2,
          metalness: 0.05,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        }),
      ),
    );
  }

  return createElement("group", null, ...children);
});
