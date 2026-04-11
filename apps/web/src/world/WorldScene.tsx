import type { AssetId } from "@refactory/contracts/worlds";
import type {
  Facing,
  GridCoordinate,
  RuntimePlacedObject,
  WorldRuntimeSnapshot,
} from "@refactory/contracts/runtime";
import { useFrame, useThree } from "@react-three/fiber";
import { Array as EffectArray, Effect, pipe } from "effect";
import {
  lazy,
  memo,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { ModularStorage, Rocket } from "../models";
import { PersonalBox, Portal } from "../models/building";
import { WIPSign } from "../models/WIPSign";
import type { PortalParams } from "../portal";
import type { PurityTier, ResourceType } from "../models/ResourceNode";
import { ResourceNode } from "../models/ResourceNode";
import { runFork, runSync } from "../effectRuntime";
import type {
  ChunkBounds,
  ChunkGenerationElement,
  ChunkGenerationPayload,
} from "./chunkGeneration.types";
import { ChunkWorkerClient, ChunkWorkerUnavailableError } from "./chunkWorkerClient";

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

import { buildSpatialHash, type NatureEl, type SpatialHash } from "./collision";
import { WORLD_RADIUS } from "./constants";
import { surfaceHeightAt } from "./surface";
import { type Biome, biomeAt, biomeDensity, groundColor } from "./terrain";
import { isInWater, lakeDepthFactor, WATER_COLOR, WaterSurface } from "./water";
import { logWorldLoadEvent } from "./worldLoadLog";

const WORLD_VISUAL_READY_EVENT = "world-visual-ready";

const PlayerController = lazy(() =>
  import("./PlayerController").then((module) => ({
    default: module.PlayerController,
  })),
);

const WorldNature = lazy(() =>
  import("./WorldNature").then((module) => ({
    default: module.WorldNature,
  })),
);

/* ── Seeded PRNG (mulberry32) ──────────────────────────────── */

function mulberry32(seed: number) {
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
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
const TOPOGRAPHIC_STEP = 0.45;
const TOPOGRAPHIC_LINE_WIDTH = 0.08;
const TOPOGRAPHIC_STRENGTH = 0.14;
const MAP_TILE_SIZE = 2;
const MAP_CENTER_X = 6;
const MAP_CENTER_Z = 6;
const CHUNK_WORKER_CONCURRENCY = 2;

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
  const geo = new THREE.PlaneGeometry(
    CHUNK_SIZE,
    CHUNK_SIZE,
    TERRAIN_SUBDIVS,
    TERRAIN_SUBDIVS,
  );
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  if (!pos) {
    return geo;
  }
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

function buildTerrainGeometryFromPayload(
  payload: ChunkGenerationPayload,
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(
    CHUNK_SIZE,
    CHUNK_SIZE,
    TERRAIN_SUBDIVS,
    TERRAIN_SUBDIVS,
  );
  geo.rotateX(-Math.PI / 2);

  const position = geo.attributes.position;
  if (position) {
    const positionArray = position.array as Float32Array;
    for (let i = 0; i < payload.heights.length; i++) {
      positionArray[i * 3 + 1] = payload.heights[i] ?? 0;
    }
    position.needsUpdate = true;
  }

  geo.setAttribute("color", new THREE.Float32BufferAttribute(payload.colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/* ── Nature picker per biome ───────────────────────────────── */

type NaturePick = { type: string; size: "sm" | "md" | "lg"; sc: number };

type Bounds = ChunkBounds;

type NatureRenderEl = ChunkGenerationElement;

type VisibleChunk = {
  key: string;
  cx: number;
  cz: number;
  geometry: THREE.BufferGeometry;
  elements: readonly NatureRenderEl[];
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
  frustumProjectionMatrix.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
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

function sameVisibleChunks(
  left: readonly VisibleChunk[],
  right: readonly VisibleChunk[],
): boolean {
  if (left.length !== right.length) return false;

  for (let i = 0; i < left.length; i++) {
    const leftChunk = left[i];
    const rightChunk = right[i];
    if (
      !leftChunk ||
      !rightChunk ||
      leftChunk.key !== rightChunk.key ||
      leftChunk.geometry !== rightChunk.geometry ||
      !sameRefs(leftChunk.elements, rightChunk.elements)
    ) {
      return false;
    }
  }

  return true;
}

function collectVisibleChunks(
  keys: readonly string[],
  camera: THREE.Camera,
): VisibleChunk[] {
  updateViewFrustum(camera);

  return pipe(
    keys,
    EffectArray.flatMap((key) => {
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
            EffectArray.filter((element) => isBoundsVisible(element.bounds)),
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
      if (r < 0.68)
        return { type: "mushroom", size: "sm", sc: 3 + rng() * 1.5 };
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

/* ── Chunk data cache ──────────────────────────────────────── */

type ChunkData = {
  geometry: THREE.BufferGeometry;
  elements: NatureRenderEl[];
  terrainBounds: Bounds;
};

const chunkDataCache = new Map<string, ChunkData>();

const toChunkData = (payload: ChunkGenerationPayload): ChunkData => ({
  geometry: buildTerrainGeometryFromPayload(payload),
  elements: [...payload.elements],
  terrainBounds: payload.terrainBounds,
});

function getOrCreateChunk(cx: number, cz: number): ChunkData {
  const key = chunkKey(cx, cz);
  let data = chunkDataCache.get(key);
  if (!data) {
    data = {
      geometry: buildTerrainGeometry(cx, cz),
      elements: generateChunkNature(cx, cz),
      terrainBounds: makeBounds(
        cx * CHUNK_SIZE,
        2,
        cz * CHUNK_SIZE,
        TERRAIN_CULL_RADIUS,
      ),
    };
    chunkDataCache.set(key, data);
  }
  return data;
}

function evictDistantChunks(playerCx: number, playerCz: number) {
  const maxDist = TERRAIN_RENDER_DIST + 2;
  for (const [key, data] of chunkDataCache) {
    const [cx, cz] = parseChunkKey(key);
    if (
      Math.abs(cx - playerCx) > maxDist ||
      Math.abs(cz - playerCz) > maxDist
    ) {
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

type InitialWorldSceneData = {
  keys: string[];
  spatialHash: SpatialHash;
};

let initialWorldSceneData: InitialWorldSceneData | undefined;

function buildInitialWorldSceneData(): InitialWorldSceneData {
  const keys: string[] = [];
  for (let dx = -TERRAIN_RENDER_DIST; dx <= TERRAIN_RENDER_DIST; dx++) {
    for (let dz = -TERRAIN_RENDER_DIST; dz <= TERRAIN_RENDER_DIST; dz++) {
      keys.push(chunkKey(dx, dz));
      getOrCreateChunk(dx, dz);
    }
  }

  return {
    keys,
    spatialHash: rebuildSpatialHash(0, 0),
  };
}

function getInitialWorldSceneData(): InitialWorldSceneData {
  initialWorldSceneData ??= buildInitialWorldSceneData();
  return initialWorldSceneData;
}

export function preloadInitialWorldSceneData(): void {
  void getInitialWorldSceneData();
}

const fallbackRuntimeObjects: ReadonlyArray<RuntimePlacedObject> = [
  {
    buildableId: "iron_node_impure",
    containerIds: [],
    fixed: true,
    objectId: "node:iron:1",
    origin: { x: 2, y: 5 },
    removable: false,
    resourceNodeId: "node:iron:1",
  },
  {
    buildableId: "iron_node_impure",
    containerIds: [],
    fixed: true,
    objectId: "node:iron:2",
    origin: { x: 2, y: 8 },
    removable: false,
    resourceNodeId: "node:iron:2",
  },
  {
    buildableId: "rocket",
    containerIds: [],
    fixed: true,
    objectId: "system:rocket",
    origin: { x: 6, y: 3 },
    removable: false,
    rotation: "south",
  },
  {
    buildableId: "portal_entry",
    containerIds: [],
    fixed: true,
    objectId: "system:portal-entry",
    origin: { x: 8, y: 4 },
    removable: false,
    rotation: "east",
  },
  {
    buildableId: "portal_exit",
    containerIds: [],
    fixed: true,
    objectId: "system:portal-exit",
    origin: { x: 9, y: 2 },
    removable: false,
    rotation: "south",
  },
  {
    buildableId: "wip_sign",
    containerIds: [],
    fixed: true,
    objectId: "system:wip-sign",
    origin: { x: 4, y: 4 },
    removable: false,
    rotation: "east",
  },
  {
    buildableId: "modular_storage",
    containerIds: ["system:modular-storage"],
    fixed: true,
    objectId: "system:modular-storage-object",
    origin: { x: 9, y: 5 },
    removable: false,
    rotation: "east",
  },
];

const rotationYByFacing: Record<Facing, number> = {
  east: 0,
  north: -Math.PI / 2,
  south: Math.PI / 2,
  west: Math.PI,
};

const gridToWorldXZ = (coordinate: GridCoordinate): readonly [number, number] =>
  [
    (coordinate.x - MAP_CENTER_X) * MAP_TILE_SIZE,
    (coordinate.y - MAP_CENTER_Z) * MAP_TILE_SIZE,
  ] as const;

const gridToWorldPosition = (
  coordinate: GridCoordinate,
): [number, number, number] => {
  const [x, z] = gridToWorldXZ(coordinate);
  return [x, surfaceHeightAt(x, z), z];
};

const resourceRenderMeta = (
  buildableId: string,
):
  | { readonly purity: PurityTier; readonly resource: ResourceType }
  | undefined => {
  switch (buildableId) {
    case "iron_node_impure":
      return { purity: "impure", resource: "iron" };
    case "iron_node_normal":
      return { purity: "normal", resource: "iron" };
    case "iron_node_pure":
      return { purity: "pure", resource: "iron" };
    case "copper_node_impure":
      return { purity: "impure", resource: "copper" };
    case "copper_node_normal":
      return { purity: "normal", resource: "copper" };
    case "copper_node_pure":
      return { purity: "pure", resource: "copper" };
    default:
      return undefined;
  }
};

function RuntimeMapObject({
  hasBackPortal,
  isPortalEntry,
  object,
}: {
  readonly hasBackPortal: boolean;
  readonly isPortalEntry: boolean;
  readonly object: RuntimePlacedObject;
}) {
  const position = gridToWorldPosition(object.origin);
  const rotationY =
    object.rotation === undefined ? 0 : rotationYByFacing[object.rotation];
  const resource = resourceRenderMeta(object.buildableId);

  if (resource !== undefined) {
    return (
      <ResourceNode
        position={position}
        rotation={[0, rotationY, 0]}
        scale={4}
        resource={resource.resource}
        purity={resource.purity}
      />
    );
  }

  switch (object.buildableId) {
    case "modular_storage":
      return (
        <ModularStorage
          position={position}
          rotation={[0, rotationY, 0]}
          scale={1.1}
          status="red"
        />
      );
    case "portal_entry":
      return isPortalEntry && hasBackPortal ? (
        <Portal
          type="entry"
          position={position}
          rotation={[0, rotationY, 0]}
          active
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(
              new CustomEvent("building-interact", {
                detail: { id: "portal-entry" },
              }),
            );
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.classList.add("interactable-hover");
          }}
          onPointerOut={() => {
            document.body.classList.remove("interactable-hover");
          }}
        />
      ) : null;
    case "portal_exit":
      return isPortalEntry ? (
        <Portal
          type="exit"
          position={position}
          rotation={[0, rotationY, 0]}
          active
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(
              new CustomEvent("building-interact", {
                detail: { id: "portal-exit" },
              }),
            );
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.classList.add("interactable-hover");
          }}
          onPointerOut={() => {
            document.body.classList.remove("interactable-hover");
          }}
        />
      ) : null;
    case "rocket":
      return (
        <Rocket position={position} rotation={[0, rotationY, 0]} scale={0.55} />
      );
    case "starter_box":
      return (
        <PersonalBox
          position={position}
          rotation={[0, rotationY, 0]}
          scale={1.1}
        />
      );
    case "wip_sign":
      return (
        <WIPSign
          position={position}
          rotation={[0, rotationY, 0]}
          scale={2}
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(
              new CustomEvent("building-interact", {
                detail: { id: "wip-sign" },
              }),
            );
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.classList.add("interactable-hover");
          }}
          onPointerOut={() => {
            document.body.classList.remove("interactable-hover");
          }}
        />
      );
    default:
      return null;
  }
}

/* ── Scene root ────────────────────────────────────────────── */

export function WorldScene({
  assetId,
  hasBackPortal = false,
  isPaused = false,
  isPortalEntry = false,
  portalParams = null,
  runtimeSnapshot,
}: {
  readonly assetId: AssetId;
  readonly hasBackPortal?: boolean;
  readonly isPaused?: boolean;
  readonly isPortalEntry?: boolean;
  readonly portalParams?: PortalParams | null;
  readonly runtimeSnapshot?: WorldRuntimeSnapshot;
}) {
  const initialWorldData = getInitialWorldSceneData();
  const camera = useThree((state) => state.camera);
  const playerPosRef = useRef(new THREE.Vector3());
  const spatialHashRef = useRef<SpatialHash>(initialWorldData.spatialHash);
  const prevChunkRef = useRef({ cx: 0, cz: 0 });
  const genQueueRef = useRef<[number, number][]>([]);
  const targetKeysRef = useRef<string[]>([]);
  const visibilityElapsedRef = useRef(0);
  const hasLoggedReadyRef = useRef(false);
  const chunkWorkerRef = useRef<ChunkWorkerClient | null>(null);
  const pendingChunkKeysRef = useRef<Set<string>>(new Set());
  const isUnmountedRef = useRef(false);

  const [activeKeys, setActiveKeys] = useState<string[]>(() => [
    ...initialWorldData.keys,
  ]);
  const activeKeysRef = useRef(activeKeys);
  const [visibleChunks, setVisibleChunks] = useState<VisibleChunk[]>(() =>
    collectVisibleChunks(activeKeys, camera),
  );
  const mapObjects = useMemo(
    () => runtimeSnapshot?.objects ?? fallbackRuntimeObjects,
    [runtimeSnapshot],
  );
  const entryPortalXZ = useMemo(
    () =>
      gridToWorldXZ(
        mapObjects.find((object) => object.buildableId === "portal_entry")
          ?.origin ?? { x: 8, y: 4 },
      ),
    [mapObjects],
  );
  const exitPortalXZ = useMemo(
    () =>
      gridToWorldXZ(
        mapObjects.find((object) => object.buildableId === "portal_exit")
          ?.origin ?? { x: 9, y: 2 },
      ),
    [mapObjects],
  );

  const commitGeneratedChunks = useCallback(() => {
    if (
      genQueueRef.current.length > 0 ||
      pendingChunkKeysRef.current.size > 0 ||
      targetKeysRef.current.length === 0
    ) {
      return;
    }

    const { cx, cz } = prevChunkRef.current;
    spatialHashRef.current = rebuildSpatialHash(cx, cz);
    activeKeysRef.current = [...targetKeysRef.current];
    startTransition(() => setActiveKeys([...targetKeysRef.current]));
  }, []);

  const requestChunkGeneration = useCallback(
    (cx: number, cz: number) => {
      const key = chunkKey(cx, cz);
      if (chunkDataCache.has(key) || pendingChunkKeysRef.current.has(key)) {
        return;
      }

      const worker = chunkWorkerRef.current;
      pendingChunkKeysRef.current.add(key);

      const generation =
        worker?.generate(cx, cz) ??
        Effect.fail(
          new ChunkWorkerUnavailableError({
            reason: "Chunk worker unavailable",
          }),
        );

      runFork(
        generation.pipe(
          Effect.match({
            onFailure: () => {
              if (isUnmountedRef.current) {
                return;
              }
              chunkDataCache.set(key, getOrCreateChunk(cx, cz));
            },
            onSuccess: (payload) => {
              if (isUnmountedRef.current) {
                return;
              }
              chunkDataCache.set(key, toChunkData(payload));
            },
          }),
          Effect.ensuring(
            Effect.sync(() => {
              pendingChunkKeysRef.current.delete(key);
              commitGeneratedChunks();
            }),
          ),
        ),
      );
    },
    [commitGeneratedChunks],
  );

  useEffect(() => {
    activeKeysRef.current = activeKeys;
    const nextVisibleChunks = collectVisibleChunks(activeKeys, camera);
    setVisibleChunks((current) =>
      sameVisibleChunks(current, nextVisibleChunks)
        ? current
        : nextVisibleChunks,
    );
  }, [activeKeys, camera]);

  useEffect(() => {
    isUnmountedRef.current = false;
    chunkWorkerRef.current = runSync(
      ChunkWorkerClient.make.pipe(
        Effect.match({
          onFailure: () => null,
          onSuccess: (worker) => worker,
        }),
      ),
    );

    return () => {
      isUnmountedRef.current = true;
      pendingChunkKeysRef.current.clear();
      const worker = chunkWorkerRef.current;
      if (worker) {
        runSync(worker.dispose());
      }
      chunkWorkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (visibleChunks.length === 0 || hasLoggedReadyRef.current) {
      return;
    }

    let firstFrameId = 0;
    let secondFrameId = 0;

    firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        hasLoggedReadyRef.current = true;
        logWorldLoadEvent(
          "world-threejs-playable",
          "Threejs fully loaded and game is playable",
        );
        window.dispatchEvent(new Event(WORLD_VISUAL_READY_EVENT));
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      window.cancelAnimationFrame(secondFrameId);
    };
  }, [visibleChunks]);

  useFrame((_, delta) => {
    /* ── 1. Process generation queue (spread across frames) ── */
    const queue = genQueueRef.current;
    if (queue.length > 0) {
      while (
        queue.length > 0 &&
        pendingChunkKeysRef.current.size < CHUNK_WORKER_CONCURRENCY
      ) {
        const chunkToGenerate = queue.shift();
        if (!chunkToGenerate) {
          break;
        }
        requestChunkGeneration(chunkToGenerate[0], chunkToGenerate[1]);
      }
      commitGeneratedChunks();
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
          const key = chunkKey(kcx, kcz);
          keys.push(key);
          if (
            !chunkDataCache.has(key) &&
            !pendingChunkKeysRef.current.has(key)
          ) {
            needGen.push([kcx, kcz]);
          }
        }
      }

      evictDistantChunks(cx, cz);
      targetKeysRef.current = keys;

      const hasPendingForTargetKeys = keys.some((key) =>
        pendingChunkKeysRef.current.has(key),
      );

      if (needGen.length === 0 && !hasPendingForTargetKeys) {
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
    const nextVisibleChunks = collectVisibleChunks(
      activeKeysRef.current,
      camera,
    );
    setVisibleChunks((current) =>
      sameVisibleChunks(current, nextVisibleChunks)
        ? current
        : nextVisibleChunks,
    );
  });

  return (
    <>
      {visibleChunks.map(({ key, cx, cz, geometry, elements }) => {
        return (
          <group key={key}>
            <TerrainChunk cx={cx} cz={cz} geometry={geometry} />
            {elements.length > 0 ? (
              <Suspense fallback={null}>
                <WorldNature elements={elements} />
              </Suspense>
            ) : null}
          </group>
        );
      })}
      <WaterSurface />

      <Suspense fallback={null}>
        <PlayerController
          assetId={assetId}
          enabled={!isPaused}
          playerPosRef={playerPosRef}
          spatialHashRef={spatialHashRef}
          hasBackPortal={hasBackPortal}
          isPortalEntry={isPortalEntry}
          backPortalXZ={entryPortalXZ}
          exitPortalXZ={exitPortalXZ}
          portalParams={portalParams}
        />
      </Suspense>

      {mapObjects.map((object) => (
        <RuntimeMapObject
          key={object.objectId}
          hasBackPortal={hasBackPortal}
          isPortalEntry={isPortalEntry}
          object={object}
        />
      ))}
    </>
  );
}
