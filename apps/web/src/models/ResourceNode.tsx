import { memo } from "react";
import { DodecahedronGeometry, SphereGeometry } from "three";
import { type ModelProps, STONE_MAT } from "./colors";

/* ── Public types ──────────────────────────────────────── */

export type ResourceType = "iron" | "copper";
export type PurityTier = "impure" | "normal" | "pure";

/* ── Color palettes per resource ───────────────────────── */

type ResourcePalette = {
  rock: string;
  rockLight: string;
  rockDark: string;
  ore: string;
  oreGlow: string;
};

const PALETTES: Record<ResourceType, ResourcePalette> = {
  iron: {
    rock: "#6a6575",
    rockLight: "#807a8a",
    rockDark: "#504b5a",
    ore: "#d05535",
    oreGlow: "#e87050",
  },
  copper: {
    rock: "#8a7060",
    rockLight: "#a08570",
    rockDark: "#6a5545",
    ore: "#c87840",
    oreGlow: "#e0a060",
  },
};

/* ── Shared geometries (allocated once, reused) ────────── */

const geoLg = new DodecahedronGeometry(0.24, 0);
const geoMd = new DodecahedronGeometry(0.165, 0);
const geoSm = new DodecahedronGeometry(0.105, 0);
const geoPebble = new SphereGeometry(0.045, 5, 4);
const geoOre = new SphereGeometry(0.048, 8, 6);
const geoOreSm = new SphereGeometry(0.033, 8, 6);
const geoOreChunk = new DodecahedronGeometry(0.057, 0);

/* ── Layout definition types ───────────────────────────── */

type Shade = "rock" | "rockLight" | "rockDark";
type GeoKey = "lg" | "md" | "sm" | "pebble";

const GEO_MAP: Record<GeoKey, DodecahedronGeometry | SphereGeometry> = {
  lg: geoLg,
  md: geoMd,
  sm: geoSm,
  pebble: geoPebble,
};

type RockDef = {
  geo: GeoKey;
  pos: [number, number, number];
  scale: [number, number, number];
  rot?: [number, number, number];
  shade: Shade;
};

type OreDef = {
  kind: "vein" | "veinSm" | "chunk";
  pos: [number, number, number];
  scale?: [number, number, number];
  rot?: [number, number, number];
};

type PurityLayout = {
  rocks: RockDef[];
  ores: OreDef[];
  groundRadius: number;
};

/* ── Impure: small deposit ─────────────────────────────── */

const impureLayout: PurityLayout = {
  groundRadius: 0.55,
  rocks: [
    { geo: "lg", pos: [0, 0.06, 0], scale: [1.3, 0.5, 1.2], shade: "rock" },
    {
      geo: "md",
      pos: [0.22, 0.045, 0.1],
      scale: [1.1, 0.55, 1.0],
      rot: [0, 0.4, 0.05],
      shade: "rockDark",
    },
    {
      geo: "sm",
      pos: [-0.18, 0.035, -0.14],
      scale: [1.0, 0.55, 1.05],
      rot: [0, -0.3, -0.05],
      shade: "rockLight",
    },
    {
      geo: "pebble",
      pos: [0.32, 0.014, -0.1],
      scale: [1.3, 0.65, 1.1],
      shade: "rockDark",
    },
    {
      geo: "pebble",
      pos: [-0.27, 0.012, 0.21],
      scale: [1.1, 0.7, 1.2],
      shade: "rock",
    },
  ],
  ores: [],
};

/* ── Normal: medium deposit ────────────────────────────── */

const normalLayout: PurityLayout = {
  groundRadius: 0.7,
  rocks: [
    { geo: "lg", pos: [0, 0.08, 0], scale: [1.5, 0.55, 1.4], shade: "rock" },
    {
      geo: "md",
      pos: [0.28, 0.06, 0.13],
      scale: [1.2, 0.55, 1.05],
      rot: [0, 0.5, 0.04],
      shade: "rockDark",
    },
    {
      geo: "md",
      pos: [-0.24, 0.055, -0.1],
      scale: [1.1, 0.52, 1.15],
      rot: [0, -0.4, -0.03],
      shade: "rockLight",
    },
    {
      geo: "sm",
      pos: [0.1, 0.045, -0.25],
      scale: [1.05, 0.55, 1.1],
      rot: [0, 0.2, 0],
      shade: "rock",
    },
    {
      geo: "sm",
      pos: [-0.16, 0.04, 0.27],
      scale: [1.0, 0.52, 1.05],
      rot: [0, -0.6, 0.03],
      shade: "rockDark",
    },
    {
      geo: "pebble",
      pos: [0.39, 0.014, 0.19],
      scale: [1.3, 0.65, 1.1],
      shade: "rockDark",
    },
    {
      geo: "pebble",
      pos: [-0.35, 0.012, 0.25],
      scale: [1.1, 0.7, 1.2],
      shade: "rock",
    },
    {
      geo: "pebble",
      pos: [0.25, 0.012, -0.33],
      scale: [1.0, 0.65, 1.1],
      shade: "rockLight",
    },
  ],
  ores: [
    {
      kind: "veinSm",
      pos: [0.06, 0.21, 0.06],
      scale: [1.1, 0.55, 0.8],
      rot: [0.2, 0.3, 0.6],
    },
    {
      kind: "veinSm",
      pos: [-0.12, 0.19, -0.08],
      scale: [0.9, 0.5, 0.75],
      rot: [0.5, 0.8, 0.2],
    },
  ],
};

/* ── Pure: large deposit with ore chunks ───────────────── */

const pureLayout: PurityLayout = {
  groundRadius: 0.85,
  rocks: [
    { geo: "lg", pos: [0, 0.1, 0], scale: [1.6, 0.6, 1.5], shade: "rock" },
    {
      geo: "lg",
      pos: [0.31, 0.075, 0.16],
      scale: [1.3, 0.55, 1.15],
      rot: [0, 0.5, 0.03],
      shade: "rockDark",
    },
    {
      geo: "md",
      pos: [-0.28, 0.065, -0.13],
      scale: [1.3, 0.55, 1.2],
      rot: [0, -0.3, -0.04],
      shade: "rockLight",
    },
    {
      geo: "md",
      pos: [0.13, 0.06, -0.3],
      scale: [1.15, 0.55, 1.1],
      rot: [0, 0.2, 0],
      shade: "rock",
    },
    {
      geo: "md",
      pos: [-0.16, 0.055, 0.33],
      scale: [1.1, 0.52, 1.05],
      rot: [0, -0.5, 0.03],
      shade: "rockDark",
    },
    {
      geo: "sm",
      pos: [0.06, 0.14, -0.06],
      scale: [1.0, 0.55, 0.95],
      rot: [0, 0.7, 0],
      shade: "rockLight",
    },
    {
      geo: "sm",
      pos: [0.37, 0.04, -0.19],
      scale: [0.95, 0.52, 1.0],
      rot: [0, 0.4, 0.05],
      shade: "rock",
    },
    {
      geo: "sm",
      pos: [-0.34, 0.04, 0.25],
      scale: [0.9, 0.52, 0.95],
      rot: [0, -0.6, -0.04],
      shade: "rockDark",
    },
    {
      geo: "pebble",
      pos: [0.47, 0.015, 0.22],
      scale: [1.4, 0.65, 1.1],
      shade: "rockDark",
    },
    {
      geo: "pebble",
      pos: [-0.44, 0.013, 0.31],
      scale: [1.2, 0.7, 1.2],
      shade: "rock",
    },
    {
      geo: "pebble",
      pos: [0.31, 0.013, -0.42],
      scale: [1.1, 0.65, 1.0],
      shade: "rockLight",
    },
    {
      geo: "pebble",
      pos: [-0.28, 0.012, -0.37],
      scale: [1.0, 0.65, 1.1],
      shade: "rockDark",
    },
  ],
  ores: [
    {
      kind: "vein",
      pos: [0.04, 0.22, 0.04],
      scale: [1.2, 0.6, 0.9],
      rot: [0.2, 0.3, 0.6],
    },
    {
      kind: "vein",
      pos: [0.22, 0.16, 0.12],
      scale: [1.1, 0.55, 0.85],
      rot: [0.3, 0.6, 0.2],
    },
    {
      kind: "veinSm",
      pos: [-0.14, 0.15, -0.06],
      scale: [1.0, 0.5, 0.8],
      rot: [0.5, 0.8, 0.1],
    },
    {
      kind: "veinSm",
      pos: [-0.06, 0.14, 0.24],
      scale: [0.95, 0.5, 0.75],
      rot: [0.4, 1.0, 0.3],
    },
    {
      kind: "chunk",
      pos: [0.1, 0.24, -0.04],
      scale: [1.2, 0.65, 1.0],
      rot: [0.15, 0.2, -0.1],
    },
    {
      kind: "chunk",
      pos: [-0.07, 0.21, 0.15],
      scale: [1.0, 0.6, 0.9],
      rot: [-0.12, 0.5, 0.15],
    },
  ],
};

/**
 * How much to raise the miner so grinder balls graze the rock peaks.
 * Grinder balls sit at chassis_Y − 0.43. With default chassis at 0.42,
 * balls are at −0.01. Adding nodeHeight raises balls to nodeHeight − 0.01.
 * Values here place balls ≈ at each tier's rock peak.
 */
export const NODE_MINER_OFFSET: Record<PurityTier, number> = {
  impure: 0.2,
  normal: 0.23,
  pure: 0.27,
};

const LAYOUTS: Record<PurityTier, PurityLayout> = {
  impure: impureLayout,
  normal: normalLayout,
  pure: pureLayout,
};

/* ── Ore material presets ──────────────────────────────── */

const ORE_MAT = { roughness: 0.35, metalness: 0.15 } as const;
const CHUNK_MAT = {
  roughness: 0.3,
  metalness: 0.2,
  flatShading: true,
} as const;

/* ── Component ─────────────────────────────────────────── */

export type ResourceNodeProps = ModelProps & {
  resource?: ResourceType;
  purity?: PurityTier;
};

export const ResourceNode = memo(function ResourceNode({
  resource = "iron",
  purity = "normal",
  ...props
}: ResourceNodeProps) {
  const palette = PALETTES[resource];
  const layout = LAYOUTS[purity];

  const shadeColor: Record<Shade, string> = {
    rock: palette.rock,
    rockLight: palette.rockLight,
    rockDark: palette.rockDark,
  };

  return (
    <group {...props}>
      {/* Ground shadow disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[layout.groundRadius, 16]} />
        <meshStandardMaterial
          color="#1a1a1a"
          transparent
          opacity={0.25}
          depthWrite={false}
        />
      </mesh>

      {/* Rock formations */}
      {layout.rocks.map((r) => (
        <mesh
          key={`r-${r.geo}-${r.pos.join("-")}`}
          geometry={GEO_MAP[r.geo]}
          position={r.pos}
          scale={r.scale}
          rotation={r.rot}
        >
          <meshStandardMaterial color={shadeColor[r.shade]} {...STONE_MAT} />
        </mesh>
      ))}

      {/* Ore veins and chunks */}
      {layout.ores.map((o) =>
        o.kind === "chunk" ? (
          <mesh
            key={`o-${o.kind}-${o.pos.join("-")}`}
            geometry={geoOreChunk}
            position={o.pos}
            scale={o.scale}
            rotation={o.rot}
          >
            <meshStandardMaterial
              color={palette.ore}
              emissive={palette.oreGlow}
              emissiveIntensity={0.45}
              {...CHUNK_MAT}
            />
          </mesh>
        ) : (
          <mesh
            key={`o-${o.kind}-${o.pos.join("-")}`}
            geometry={o.kind === "vein" ? geoOre : geoOreSm}
            position={o.pos}
            scale={o.scale}
            rotation={o.rot}
          >
            <meshStandardMaterial
              color={palette.ore}
              emissive={palette.oreGlow}
              emissiveIntensity={0.35}
              {...ORE_MAT}
            />
          </mesh>
        ),
      )}
    </group>
  );
});
