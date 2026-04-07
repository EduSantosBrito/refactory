import { useEffect, useRef, useState, memo, startTransition } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Array, pipe } from "effect";
import * as THREE from "three";
import {
  OakTree,
  PineTree,
  DetailedTree,
  FlatTopTree,
  DeadTree,
  Bush,
  GrassClump,
  Flower,
  Mushroom,
  Rock,
  RockFormation,
  Stump,
  Log,
  ResourceNode,
} from "../models";
import type { ResourceType, PurityTier } from "../models";

/* ── Animal Crossing curved horizon ────────────────────────── */
/* Override the vertex projection to curve the world downward   */
/* based on XZ distance from camera. Applied globally to all    */
/* MeshStandardMaterial / MeshBasicMaterial shaders.             */

const WORLD_CURVATURE = 0.002;

THREE.ShaderChunk.project_vertex = /* glsl */ `
  vec4 mvPosition = vec4( transformed, 1.0 );

  #ifdef USE_BATCHING
    mvPosition = batchingMatrix * mvPosition;
  #endif

  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
  #endif

  // World-space position for curvature
  vec4 worldPos = modelMatrix * mvPosition;
  float dx = worldPos.x - cameraPosition.x;
  float dz = worldPos.z - cameraPosition.z;
  worldPos.y -= (dx * dx + dz * dz) * ${WORLD_CURVATURE};

  mvPosition = viewMatrix * worldPos;
  gl_Position = projectionMatrix * mvPosition;
`;
import { biomeAt, biomeDensity, groundColor, type Biome } from "./terrain";
import { isInWater, lakeDepthFactor, WaterSurface, WATER_COLOR } from "./water";
import { surfaceHeightAt } from "./surface";
import { buildSpatialHash, type SpatialHash, type NatureEl } from "./collision";
import { PlayerController } from "./PlayerController";

/* ── Seeded PRNG (mulberry32) ──────────────────────────────── */

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Constants ─────────────────────────────────────────────── */

const CHUNK_SIZE = 48;
const TERRAIN_RENDER_DIST = 3;
const NATURE_RENDER_DIST = 2;
const TERRAIN_SUBDIVS = 48;
const NATURE_SPACING = 3;
const WORLD_SEED = 42;
const VISIBILITY_UPDATE_INTERVAL = 0.1;
const TERRAIN_CULL_RADIUS = Math.hypot(CHUNK_SIZE * 0.5, CHUNK_SIZE * 0.5, 10);
const RESOURCE_CULL_RADIUS = 5;
const RESOURCE_CHUNK_SPAWN_RATE = 0.24;
const RESOURCE_SECONDARY_SPAWN_RATE = 0.1;
const RESOURCE_SPAWN_CLEARANCE_SQ = 100;
const TOPOGRAPHIC_STEP = 0.45;
const TOPOGRAPHIC_LINE_WIDTH = 0.08;
const TOPOGRAPHIC_STRENGTH = 0.14;

/** Max walkable distance from origin. Terrain extends beyond for visual continuity. */
export const WORLD_RADIUS = 180;

/* ── Chunk helpers ─────────────────────────────────────────── */

function worldToChunk(v: number): number {
  return Math.floor(v / CHUNK_SIZE);
}

function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

function parseChunkKey(key: string): [number, number] {
  const parts = key.split(",");
  return [Number(parts[0]), Number(parts[1])];
}

/* ── Terrain geometry builder ──────────────────────────────── */

const _tmpColor = new THREE.Color();
const _waterTint = new THREE.Color(WATER_COLOR);

function buildTerrainGeometry(cx: number, cz: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, TERRAIN_SUBDIVS, TERRAIN_SUBDIVS);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position!;
  const colors: number[] = [];
  const originX = cx * CHUNK_SIZE;
  const originZ = cz * CHUNK_SIZE;

  for (let i = 0; i < pos.count; i++) {
    const wx = originX + pos.getX(i);
    const wz = originZ + pos.getZ(i);
    const water = isInWater(wx, wz);

    _tmpColor.set(groundColor(wx, wz));

    pos.setY(i, surfaceHeightAt(wx, wz));

    if (water) {
      const df = lakeDepthFactor(wx, wz);
      const depthT = df >= 0 ? Math.min(df * 2.5, 1) : 0.5;
      // Tint underwater terrain toward water color
      _tmpColor.lerp(_waterTint, 0.5 + depthT * 0.4);
      _tmpColor.multiplyScalar(0.45);
    }

    colors.push(_tmpColor.r, _tmpColor.g, _tmpColor.b);
  }

  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/* ── Nature picker per biome ───────────────────────────────── */

type NaturePick = { type: string; size: "sm" | "md" | "lg"; sc: number };

type Bounds = {
  x: number;
  y: number;
  z: number;
  radius: number;
};

type NatureRenderEl = NatureEl & {
  y: number;
  bounds: Bounds;
};

type ResourceRenderEl = ResDef & {
  y: number;
  bounds: Bounds;
};

type VisibleChunk = {
  key: string;
  cx: number;
  cz: number;
  geometry: THREE.BufferGeometry;
  elements: readonly NatureRenderEl[];
  resources: readonly ResourceRenderEl[];
};

const frustumProjectionMatrix = new THREE.Matrix4();
const worldFrustum = new THREE.Frustum();
const boundsSphere = new THREE.Sphere();

function makeBounds(x: number, y: number, z: number, radius: number): Bounds {
  return { x, y, z, radius };
}

function natureCullRadius(type: string, sc: number): number {
  switch (type) {
    case "oak":
    case "pine":
    case "detailed":
    case "flattop":
    case "dead":
      return sc * 2.25;
    case "formation":
      return sc * 1.7;
    case "rock":
    case "log":
      return sc * 1.35;
    case "bush":
    case "stump":
      return sc * 1.15;
    case "grass":
    case "flower":
    case "mushroom":
      return sc * 0.8;
    default:
      return sc * 1.5;
  }
}

function updateViewFrustum(camera: THREE.Camera) {
  camera.updateMatrixWorld();
  frustumProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  worldFrustum.setFromProjectionMatrix(frustumProjectionMatrix);
}

function isBoundsVisible(bounds: Bounds): boolean {
  boundsSphere.center.set(bounds.x, bounds.y, bounds.z);
  boundsSphere.radius = bounds.radius;
  return worldFrustum.intersectsSphere(boundsSphere);
}

function sameRefs<A>(left: readonly A[], right: readonly A[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function sameVisibleChunks(left: readonly VisibleChunk[], right: readonly VisibleChunk[]): boolean {
  if (left.length !== right.length) return false;

  for (let i = 0; i < left.length; i++) {
    const leftChunk = left[i];
    const rightChunk = right[i];
    if (
      !leftChunk ||
      !rightChunk ||
      leftChunk.key !== rightChunk.key ||
      leftChunk.geometry !== rightChunk.geometry ||
      !sameRefs(leftChunk.elements, rightChunk.elements) ||
      !sameRefs(leftChunk.resources, rightChunk.resources)
    ) {
      return false;
    }
  }

  return true;
}

function collectVisibleChunks(keys: readonly string[], camera: THREE.Camera): VisibleChunk[] {
  updateViewFrustum(camera);

  return pipe(
    keys,
    Array.flatMap((key) => {
      const data = chunkDataCache.get(key);
      if (!data || !isBoundsVisible(data.terrainBounds)) {
        return [];
      }

      const [cx, cz] = parseChunkKey(key);

      return [
        {
          key,
          cx,
          cz,
          geometry: data.geometry,
          elements: pipe(
            data.elements,
            Array.filter((element) => isBoundsVisible(element.bounds)),
          ),
          resources: pipe(
            data.resources,
            Array.filter((resource) => isBoundsVisible(resource.bounds)),
          ),
        },
      ];
    }),
  );
}

function pickNature(biome: Biome, rng: () => number): NaturePick {
  const r = rng();

  switch (biome) {
    case "forest": {
      if (r < 0.22)
        return {
          type: "oak",
          size: rng() < 0.3 ? "sm" : rng() < 0.65 ? "md" : "lg",
          sc: 4 + rng() * 2.5,
        };
      if (r < 0.4)
        return {
          type: "pine",
          size: rng() < 0.25 ? "sm" : rng() < 0.6 ? "md" : "lg",
          sc: 4 + rng() * 2.5,
        };
      if (r < 0.5)
        return {
          type: "detailed",
          size: rng() < 0.3 ? "sm" : rng() < 0.65 ? "md" : "lg",
          sc: 4 + rng() * 2,
        };
      if (r < 0.6)
        return {
          type: "bush",
          size: rng() < 0.5 ? "sm" : "md",
          sc: 3 + rng() * 2,
        };
      if (r < 0.68) return { type: "mushroom", size: "sm", sc: 3 + rng() * 1.5 };
      if (r < 0.76) return { type: "grass", size: "sm", sc: 3 + rng() };
      if (r < 0.82) return { type: "flower", size: "sm", sc: 3 + rng() };
      if (r < 0.88)
        return {
          type: "stump",
          size: rng() < 0.5 ? "sm" : "lg",
          sc: 3 + rng() * 2,
        };
      if (r < 0.94)
        return {
          type: "dead",
          size: rng() < 0.5 ? "sm" : "lg",
          sc: 4 + rng() * 2,
        };
      return { type: "log", size: "md", sc: 3 + rng() * 2 };
    }
    case "grassland": {
      if (r < 0.12)
        return {
          type: "oak",
          size: rng() < 0.6 ? "sm" : "md",
          sc: 3 + rng() * 2,
        };
      if (r < 0.18)
        return {
          type: "flattop",
          size: rng() < 0.5 ? "sm" : "md",
          sc: 3 + rng() * 2,
        };
      if (r < 0.3)
        return {
          type: "bush",
          size: rng() < 0.6 ? "sm" : "md",
          sc: 3 + rng() * 1.5,
        };
      if (r < 0.5) return { type: "flower", size: "sm", sc: 3 + rng() };
      if (r < 0.72) return { type: "grass", size: "sm", sc: 3 + rng() };
      if (r < 0.84) return { type: "rock", size: "sm", sc: 3 + rng() };
      return { type: "mushroom", size: "sm", sc: 3 + rng() };
    }
    case "rocky": {
      if (r < 0.28)
        return {
          type: "rock",
          size: rng() < 0.3 ? "sm" : rng() < 0.7 ? "md" : "lg",
          sc: 3 + rng() * 2,
        };
      if (r < 0.48)
        return {
          type: "formation",
          size: rng() < 0.4 ? "sm" : rng() < 0.8 ? "md" : "lg",
          sc: 3 + rng() * 2,
        };
      if (r < 0.58)
        return {
          type: "dead",
          size: rng() < 0.5 ? "sm" : "md",
          sc: 3 + rng() * 2,
        };
      if (r < 0.66)
        return {
          type: "stump",
          size: rng() < 0.5 ? "sm" : "md",
          sc: 3 + rng() * 1.5,
        };
      if (r < 0.76) return { type: "bush", size: "sm", sc: 2 + rng() };
      if (r < 0.88) return { type: "grass", size: "sm", sc: 2 + rng() };
      return { type: "pine", size: "sm", sc: 3 + rng() };
    }
    case "desert": {
      if (r < 0.25)
        return {
          type: "rock",
          size: rng() < 0.5 ? "sm" : "md",
          sc: 2 + rng() * 1.5,
        };
      if (r < 0.4) return { type: "dead", size: "sm", sc: 3 + rng() };
      if (r < 0.55) return { type: "grass", size: "sm", sc: 2 + rng() };
      if (r < 0.7)
        return {
          type: "formation",
          size: rng() < 0.5 ? "sm" : "md",
          sc: 2 + rng() * 1.5,
        };
      return { type: "bush", size: "sm", sc: 2 + rng() };
    }
    case "swamp": {
      if (r < 0.18)
        return {
          type: "dead",
          size: rng() < 0.5 ? "sm" : "md",
          sc: 4 + rng() * 2,
        };
      if (r < 0.32) return { type: "mushroom", size: "sm", sc: 3 + rng() * 2 };
      if (r < 0.44) return { type: "log", size: "md", sc: 3 + rng() * 2 };
      if (r < 0.56)
        return {
          type: "stump",
          size: rng() < 0.5 ? "sm" : "lg",
          sc: 3 + rng() * 2,
        };
      if (r < 0.68)
        return {
          type: "bush",
          size: rng() < 0.5 ? "sm" : "md",
          sc: 3 + rng() * 1.5,
        };
      if (r < 0.8) return { type: "grass", size: "sm", sc: 3 + rng() };
      if (r < 0.9) return { type: "flower", size: "sm", sc: 3 + rng() };
      return { type: "pine", size: "sm", sc: 3 + rng() };
    }
    case "hills": {
      if (r < 0.2)
        return {
          type: "pine",
          size: rng() < 0.4 ? "sm" : rng() < 0.7 ? "md" : "lg",
          sc: 4 + rng() * 2,
        };
      if (r < 0.35)
        return {
          type: "rock",
          size: rng() < 0.4 ? "sm" : "md",
          sc: 3 + rng() * 2,
        };
      if (r < 0.48)
        return {
          type: "bush",
          size: rng() < 0.5 ? "sm" : "md",
          sc: 3 + rng() * 1.5,
        };
      if (r < 0.62) return { type: "grass", size: "sm", sc: 3 + rng() };
      if (r < 0.75) return { type: "flower", size: "sm", sc: 3 + rng() };
      if (r < 0.85)
        return {
          type: "formation",
          size: rng() < 0.5 ? "sm" : "md",
          sc: 3 + rng() * 1.5,
        };
      return { type: "dead", size: "sm", sc: 3 + rng() };
    }
  }
}

/* ── Chunk nature generation ───────────────────────────────── */

function generateChunkNature(cx: number, cz: number): NatureRenderEl[] {
  const chunkSeed = WORLD_SEED ^ (cx * 73856093) ^ (cz * 19349663);
  const rng = mulberry32(chunkSeed);
  const elements: NatureRenderEl[] = [];
  const originX = cx * CHUNK_SIZE;
  const originZ = cz * CHUNK_SIZE;
  const half = CHUNK_SIZE / 2;
  let localId = 0;

  for (let gx = -half; gx < half; gx += NATURE_SPACING) {
    for (let gz = -half; gz < half; gz += NATURE_SPACING) {
      const x = originX + gx + (rng() - 0.5) * NATURE_SPACING * 0.8;
      const z = originZ + gz + (rng() - 0.5) * NATURE_SPACING * 0.8;

      if (isInWater(x, z)) continue;
      if (x * x + z * z < 64) continue; // spawn clearance

      const biome = biomeAt(x, z);
      if (rng() > biomeDensity(biome)) continue;

      const ry = rng() * Math.PI * 2;
      const pick = pickNature(biome, rng);
      const y = surfaceHeightAt(x, z);
      const cullRadius = natureCullRadius(pick.type, pick.sc);

      elements.push({
        id: localId++,
        type: pick.type,
        x,
        y,
        z,
        ry,
        sc: pick.sc,
        size: pick.size,
        bounds: makeBounds(x, y + cullRadius * 0.55, z, cullRadius),
      });
    }
  }

  return elements;
}

/* ── Chunk resource generation ─────────────────────────────── */

type ResDef = {
  x: number;
  z: number;
  resource: ResourceType;
  purity: PurityTier;
  ry: number;
};

function spawnChunkResource(
  rng: () => number,
  cx: number,
  cz: number,
): ResourceRenderEl | undefined {
  const x = cx * CHUNK_SIZE + (rng() - 0.5) * CHUNK_SIZE * 0.7;
  const z = cz * CHUNK_SIZE + (rng() - 0.5) * CHUNK_SIZE * 0.7;

  if (isInWater(x, z) || x * x + z * z < RESOURCE_SPAWN_CLEARANCE_SQ) {
    return undefined;
  }

  const resource: ResourceType = rng() < 0.6 ? "iron" : "copper";
  const p = rng();
  const purity: PurityTier = p < 0.6 ? "impure" : p < 0.9 ? "normal" : "pure";
  const y = surfaceHeightAt(x, z);

  return {
    x,
    y,
    z,
    resource,
    purity,
    ry: rng() * Math.PI * 2,
    bounds: makeBounds(x, y + RESOURCE_CULL_RADIUS * 0.4, z, RESOURCE_CULL_RADIUS),
  };
}

function generateChunkResources(cx: number, cz: number): ResourceRenderEl[] {
  const seed = (WORLD_SEED + 777) ^ (cx * 83492791) ^ (cz * 29150633);
  const rng = mulberry32(seed);
  const resources: ResourceRenderEl[] = [];

  if (rng() <= RESOURCE_CHUNK_SPAWN_RATE) {
    const primary = spawnChunkResource(rng, cx, cz);
    if (primary) resources.push(primary);
  }

  if (rng() <= RESOURCE_SECONDARY_SPAWN_RATE) {
    const secondary = spawnChunkResource(rng, cx, cz);
    if (secondary) resources.push(secondary);
  }

  return resources;
}

/* ── Chunk data cache ──────────────────────────────────────── */

type ChunkData = {
  geometry: THREE.BufferGeometry;
  elements: NatureRenderEl[];
  resources: ResourceRenderEl[];
  terrainBounds: Bounds;
};

const chunkDataCache = new Map<string, ChunkData>();

function getOrCreateChunk(cx: number, cz: number): ChunkData {
  const key = chunkKey(cx, cz);
  let data = chunkDataCache.get(key);
  if (!data) {
    data = {
      geometry: buildTerrainGeometry(cx, cz),
      elements: generateChunkNature(cx, cz),
      resources: generateChunkResources(cx, cz),
      terrainBounds: makeBounds(cx * CHUNK_SIZE, 2, cz * CHUNK_SIZE, TERRAIN_CULL_RADIUS),
    };
    chunkDataCache.set(key, data);
  }
  return data;
}

function evictDistantChunks(playerCx: number, playerCz: number) {
  const maxDist = TERRAIN_RENDER_DIST + 2;
  for (const [key, data] of chunkDataCache) {
    const [cx, cz] = parseChunkKey(key);
    if (Math.abs(cx - playerCx) > maxDist || Math.abs(cz - playerCz) > maxDist) {
      data.geometry.dispose();
      chunkDataCache.delete(key);
    }
  }
}

/* ── Shared terrain material ───────────────────────────────── */

const terrainMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.88,
  metalness: 0,
  flatShading: true,
});

terrainMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uTopoStep = { value: TOPOGRAPHIC_STEP };
  shader.uniforms.uTopoLineWidth = { value: TOPOGRAPHIC_LINE_WIDTH };
  shader.uniforms.uTopoStrength = { value: TOPOGRAPHIC_STRENGTH };

  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
varying float vTopoHeight;`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vTopoHeight = transformed.y;`,
    );

  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
varying float vTopoHeight;
uniform float uTopoStep;
uniform float uTopoLineWidth;
uniform float uTopoStrength;

float topoLineFactor(float height) {
  float contour = fract(height / uTopoStep);
  float edge = min(contour, 1.0 - contour);
  float feather = max(fwidth(height / uTopoStep), 0.0001);
  return 1.0 - smoothstep(uTopoLineWidth, uTopoLineWidth + feather, edge);
}`,
    )
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
float topoHeight = max(vTopoHeight, 0.0);
float topoLine = topoLineFactor(topoHeight);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (1.0 - uTopoStrength), topoLine);`,
    );
};

/* ── Rendering sub-components ──────────────────────────────── */

const TerrainChunk = memo(function TerrainChunk({
  cx,
  cz,
  geometry,
}: {
  cx: number;
  cz: number;
  geometry: THREE.BufferGeometry;
}) {
  return (
    <mesh
      geometry={geometry}
      material={terrainMaterial}
      position={[cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE]}
    />
  );
});

const NatureItem = memo(function NatureItem({ el }: { readonly el: NatureRenderEl }) {
  const pos: [number, number, number] = [el.x, el.y, el.z];
  const rot: [number, number, number] = [0, el.ry, 0];

  switch (el.type) {
    case "oak":
      return <OakTree position={pos} rotation={rot} scale={el.sc} size={el.size} />;
    case "pine":
      return <PineTree position={pos} rotation={rot} scale={el.sc} size={el.size} />;
    case "detailed":
      return <DetailedTree position={pos} rotation={rot} scale={el.sc} size={el.size} />;
    case "flattop":
      return <FlatTopTree position={pos} rotation={rot} scale={el.sc} size={el.size} />;
    case "dead":
      return <DeadTree position={pos} rotation={rot} scale={el.sc} size={el.size} />;
    case "bush":
      return <Bush position={pos} rotation={rot} scale={el.sc} size={el.size} />;
    case "rock":
      return <Rock position={pos} rotation={rot} scale={el.sc} size={el.size} />;
    case "formation":
      return <RockFormation position={pos} rotation={rot} scale={el.sc} size={el.size} />;
    case "stump":
      return <Stump position={pos} rotation={rot} scale={el.sc} size={el.size} />;
    case "grass":
      return <GrassClump position={pos} rotation={rot} scale={el.sc} />;
    case "flower":
      return <Flower position={pos} rotation={rot} scale={el.sc} />;
    case "mushroom":
      return <Mushroom position={pos} rotation={rot} scale={el.sc} />;
    case "log":
      return <Log position={pos} rotation={rot} scale={el.sc} />;
    default:
      return null;
  }
});

const NatureChunk = memo(function NatureChunk({
  elements,
}: {
  elements: readonly NatureRenderEl[];
}) {
  return (
    <group>
      {elements.map((el) => (
        <NatureItem key={el.id} el={el} />
      ))}
    </group>
  );
});

/* ── Spatial hash rebuild helper ────────────────────────────── */

function rebuildSpatialHash(cx: number, cz: number): SpatialHash {
  const allElements: NatureEl[] = [];
  for (let dx = -NATURE_RENDER_DIST; dx <= NATURE_RENDER_DIST; dx++) {
    for (let dz = -NATURE_RENDER_DIST; dz <= NATURE_RENDER_DIST; dz++) {
      const data = chunkDataCache.get(chunkKey(cx + dx, cz + dz));
      if (data) allElements.push(...data.elements);
    }
  }
  return buildSpatialHash(allElements);
}

/** Max new chunks to generate per frame — prevents frame spikes */
const GEN_BUDGET_PER_FRAME = 2;

/* ── Scene root ────────────────────────────────────────────── */

export function WorldScene({ isPaused = false }: { readonly isPaused?: boolean }) {
  const camera = useThree((state) => state.camera);
  const playerPosRef = useRef(new THREE.Vector3());
  const spatialHashRef = useRef<SpatialHash>(buildSpatialHash([]));
  const prevChunkRef = useRef({ cx: 0, cz: 0 });
  const genQueueRef = useRef<[number, number][]>([]);
  const targetKeysRef = useRef<string[]>([]);
  const visibilityElapsedRef = useRef(0);

  const [activeKeys, setActiveKeys] = useState<string[]>(() => {
    const keys: string[] = [];
    for (let dx = -TERRAIN_RENDER_DIST; dx <= TERRAIN_RENDER_DIST; dx++) {
      for (let dz = -TERRAIN_RENDER_DIST; dz <= TERRAIN_RENDER_DIST; dz++) {
        keys.push(chunkKey(dx, dz));
        getOrCreateChunk(dx, dz);
      }
    }
    spatialHashRef.current = rebuildSpatialHash(0, 0);
    return keys;
  });
  const activeKeysRef = useRef(activeKeys);
  const [visibleChunks, setVisibleChunks] = useState<VisibleChunk[]>(() =>
    collectVisibleChunks(activeKeys, camera),
  );

  useEffect(() => {
    activeKeysRef.current = activeKeys;
    const nextVisibleChunks = collectVisibleChunks(activeKeys, camera);
    setVisibleChunks((current) =>
      sameVisibleChunks(current, nextVisibleChunks) ? current : nextVisibleChunks,
    );
  }, [activeKeys, camera]);

  useFrame((_, delta) => {
    /* ── 1. Process generation queue (spread across frames) ── */
    const queue = genQueueRef.current;
    if (queue.length > 0) {
      const batch = queue.splice(0, GEN_BUDGET_PER_FRAME);
      for (const [gcx, gcz] of batch) {
        getOrCreateChunk(gcx, gcz);
      }
      if (queue.length === 0) {
        // All queued chunks generated — commit the full key set
        const { cx, cz } = prevChunkRef.current;
        spatialHashRef.current = rebuildSpatialHash(cx, cz);
        activeKeysRef.current = [...targetKeysRef.current];
        startTransition(() => setActiveKeys([...targetKeysRef.current]));
      }
    }

    /* ── 2. Detect chunk boundary crossing ───────────────────── */
    const cx = worldToChunk(playerPosRef.current.x);
    const cz = worldToChunk(playerPosRef.current.z);
    if (cx !== prevChunkRef.current.cx || cz !== prevChunkRef.current.cz) {
      prevChunkRef.current = { cx, cz };

      const keys: string[] = [];
      const needGen: [number, number][] = [];
      for (let dx = -TERRAIN_RENDER_DIST; dx <= TERRAIN_RENDER_DIST; dx++) {
        for (let dz = -TERRAIN_RENDER_DIST; dz <= TERRAIN_RENDER_DIST; dz++) {
          const kcx = cx + dx;
          const kcz = cz + dz;
          keys.push(chunkKey(kcx, kcz));
          if (!chunkDataCache.has(chunkKey(kcx, kcz))) {
            needGen.push([kcx, kcz]);
          }
        }
      }

      evictDistantChunks(cx, cz);
      targetKeysRef.current = keys;

      if (needGen.length === 0) {
        // Everything cached — update immediately
        spatialHashRef.current = rebuildSpatialHash(cx, cz);
        activeKeysRef.current = keys;
        startTransition(() => setActiveKeys(keys));
      } else {
        // Queue generation, show cached chunks now
        genQueueRef.current = needGen;
        const cachedKeys = keys.filter((k) => chunkDataCache.has(k));
        activeKeysRef.current = cachedKeys;
        startTransition(() => setActiveKeys(cachedKeys));
      }
    }

    visibilityElapsedRef.current += delta;
    if (visibilityElapsedRef.current < VISIBILITY_UPDATE_INTERVAL) return;

    visibilityElapsedRef.current = 0;
    const nextVisibleChunks = collectVisibleChunks(activeKeysRef.current, camera);
    setVisibleChunks((current) =>
      sameVisibleChunks(current, nextVisibleChunks) ? current : nextVisibleChunks,
    );
  });

  return (
    <>
      {visibleChunks.map(({ key, cx, cz, geometry, elements, resources }) => {
        return (
          <group key={key}>
            <TerrainChunk cx={cx} cz={cz} geometry={geometry} />
            {elements.length > 0 && <NatureChunk elements={elements} />}
            {resources.map((r) => (
              <ResourceNode
                key={`${r.x},${r.z}`}
                position={[r.x, r.y, r.z]}
                rotation={[0, r.ry, 0]}
                scale={4}
                resource={r.resource}
                purity={r.purity}
              />
            ))}
          </group>
        );
      })}
      <WaterSurface />
      <PlayerController
        enabled={!isPaused}
        playerPosRef={playerPosRef}
        spatialHashRef={spatialHashRef}
      />
    </>
  );
}
