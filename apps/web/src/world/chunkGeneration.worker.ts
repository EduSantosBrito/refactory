/// <reference lib="webworker" />

import { type NatureSize } from "./collision";
import { surfaceHeightAt } from "./surface";
import { biomeAt, biomeDensity, groundColor, type Biome } from "./terrain";
import { isInWater, lakeDepthFactor, WATER_COLOR } from "./water";
import type {
  ChunkBounds,
  ChunkGenerationElement,
  ChunkGenerationPayload,
  ChunkGenerationRequestMessage,
  ChunkGenerationResponseMessage,
} from "./chunkGeneration.types";

type NaturePick = { type: string; size: NatureSize; sc: number };

const CHUNK_SIZE = 48;
const TERRAIN_SUBDIVS = 48;
const NATURE_SPACING = 3;
const WORLD_SEED = 42;
const TERRAIN_CULL_RADIUS = Math.hypot(CHUNK_SIZE * 0.5, CHUNK_SIZE * 0.5, 10);

const colorCache = new Map<string, readonly [number, number, number]>();

const parseHexColor = (value: string): readonly [number, number, number] => {
  const cached = colorCache.get(value);
  if (cached !== undefined) {
    return cached;
  }

  const normalized = value.startsWith("#") ? value.slice(1) : value;
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const parsed = [r, g, b] as const;
  colorCache.set(value, parsed);
  return parsed;
};

const [waterR, waterG, waterB] = parseHexColor(WATER_COLOR);

const makeBounds = (x: number, y: number, z: number, radius: number): ChunkBounds => ({
  x,
  y,
  z,
  radius,
});

const natureCullRadius = (type: string, sc: number): number => {
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
};

function mulberry32(seed: number) {
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

const generateTerrainData = (
  cx: number,
  cz: number,
): { readonly colors: Float32Array; readonly heights: Float32Array } => {
  const vertexCount = (TERRAIN_SUBDIVS + 1) * (TERRAIN_SUBDIVS + 1);
  const heights = new Float32Array(vertexCount);
  const colors = new Float32Array(vertexCount * 3);
  const half = CHUNK_SIZE / 2;
  const originX = cx * CHUNK_SIZE;
  const originZ = cz * CHUNK_SIZE;
  let vertexIndex = 0;

  for (let iz = 0; iz <= TERRAIN_SUBDIVS; iz++) {
    const localZ = -half + (iz / TERRAIN_SUBDIVS) * CHUNK_SIZE;

    for (let ix = 0; ix <= TERRAIN_SUBDIVS; ix++) {
      const localX = -half + (ix / TERRAIN_SUBDIVS) * CHUNK_SIZE;
      const wx = originX + localX;
      const wz = originZ + localZ;
      const water = isInWater(wx, wz);

      const [baseR, baseG, baseB] = parseHexColor(groundColor(wx, wz));
      const y = surfaceHeightAt(wx, wz);
      heights[vertexIndex] = y;

      let finalR = baseR;
      let finalG = baseG;
      let finalB = baseB;

      if (water) {
        const df = lakeDepthFactor(wx, wz);
        const depthT = df >= 0 ? Math.min(df * 2.5, 1) : 0.5;
        const lerpT = 0.5 + depthT * 0.4;
        finalR = (baseR + (waterR - baseR) * lerpT) * 0.45;
        finalG = (baseG + (waterG - baseG) * lerpT) * 0.45;
        finalB = (baseB + (waterB - baseB) * lerpT) * 0.45;
      }

      const colorIndex = vertexIndex * 3;
      colors[colorIndex] = finalR;
      colors[colorIndex + 1] = finalG;
      colors[colorIndex + 2] = finalB;
      vertexIndex++;
    }
  }

  return {
    colors,
    heights,
  };
};

const generateChunkNature = (
  cx: number,
  cz: number,
): ReadonlyArray<ChunkGenerationElement> => {
  const chunkSeed = WORLD_SEED ^ (cx * 73856093) ^ (cz * 19349663);
  const rng = mulberry32(chunkSeed);
  const elements: Array<ChunkGenerationElement> = [];
  const originX = cx * CHUNK_SIZE;
  const originZ = cz * CHUNK_SIZE;
  const half = CHUNK_SIZE / 2;
  let localId = 0;

  for (let gx = -half; gx < half; gx += NATURE_SPACING) {
    for (let gz = -half; gz < half; gz += NATURE_SPACING) {
      const x = originX + gx + (rng() - 0.5) * NATURE_SPACING * 0.8;
      const z = originZ + gz + (rng() - 0.5) * NATURE_SPACING * 0.8;

      if (isInWater(x, z)) continue;
      if (x * x + z * z < 64) continue;

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
};

const generateChunkPayload = (cx: number, cz: number): ChunkGenerationPayload => {
  const { colors, heights } = generateTerrainData(cx, cz);

  return {
    cx,
    cz,
    colors,
    elements: generateChunkNature(cx, cz),
    heights,
    terrainBounds: makeBounds(cx * CHUNK_SIZE, 2, cz * CHUNK_SIZE, TERRAIN_CULL_RADIUS),
  };
};

const selfWorker = self as DedicatedWorkerGlobalScope;

selfWorker.onmessage = (event: MessageEvent<ChunkGenerationRequestMessage>) => {
  const message = event.data;

  if (message._tag !== "generate") {
    return;
  }

  try {
    const payload = generateChunkPayload(message.cx, message.cz);
    const response: ChunkGenerationResponseMessage = {
      _tag: "generated",
      id: message.id,
      payload,
    };
    selfWorker.postMessage(response, [
      payload.colors.buffer,
      payload.heights.buffer,
    ]);
  } catch (error) {
    const response: ChunkGenerationResponseMessage = {
      _tag: "failed",
      id: message.id,
      message: error instanceof Error ? error.message : "Chunk generation failed",
    };
    selfWorker.postMessage(response);
  }
};
