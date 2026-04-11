import type { Mesh } from "three";
import { useRef } from "react";
import {
  ACCENT_Y,
  BASE_H,
  BASE_W,
  BELT_COLORS,
  BELT_MAT,
  BELT_SPEED,
  BELT_TILE,
  DEFAULT_BELT_RATE_PER_MINUTE,
  FRAME_W,
  GROOVE_DENSITY,
  RAIL_H,
  RAIL_W,
  resolveBeltSpeed,
  SURFACE_HALF_W,
  SURFACE_W,
} from "./constants";
import { useGrooveMaterial } from "./useGrooveMaterial";
import type { BeltPort, BeltSegmentProps } from "./types";

const H = BELT_TILE.height;
const LENGTH = 1.0;

/** Geometry extends past tile boundary for seamless chain joints */
const EXT = LENGTH + 0.02;

/* ── Port definitions for a straight segment ─────────────── */

export const STRAIGHT_PORTS: BeltPort[] = [
  { id: "in", role: "input", facing: "west", position: [-0.5, H / 2, 0] },
  { id: "out", role: "output", facing: "east", position: [0.5, H / 2, 0] },
];

/* ── Component ───────────────────────────────────────────── */

/**
 * Procedural straight belt segment — 1×1 tile.
 *
 * Items travel along +X (west → east in local space).
 * Aesthetic: flat dark belt surface with scrolling groove lines,
 * orange accent rails, beveled base.
 *
 * Automatically uses TSL shaders when WebGPU is active.
 */
export function BeltSegment({
  power = "running",
  content: _content = "empty",
  ratePerMinute = DEFAULT_BELT_RATE_PER_MINUTE,
  speed,
  endCap,
  reverseScroll = false,
  ...props
}: BeltSegmentProps) {
  const overlayRef = useRef<Mesh>(null);
  const beltSpeed = resolveBeltSpeed({ ratePerMinute, speed }) ?? BELT_SPEED;
  const running = power === "running";
  const repeat = LENGTH * GROOVE_DENSITY;

  // Dual-mode groove material (GLSL for WebGL, TSL for WebGPU)
  const { material } = useGrooveMaterial({
    repeat,
    running,
    speed: beltSpeed,
    reverseScroll,
  });

  return (
    <group {...props}>
      {/* ── Base plate — wider, grounding ───────────────── */}
      <mesh position={[0, BASE_H / 2, 0]}>
        <boxGeometry args={[EXT, BASE_H, BASE_W]} />
        <meshStandardMaterial color={BELT_COLORS.base} {...BELT_MAT.base} />
      </mesh>

      {/* ── Accent stripe at base ───────────────────────── */}
      <mesh position={[0, ACCENT_Y, 0]}>
        <boxGeometry args={[EXT, 0.015, FRAME_W + 0.01]} />
        <meshStandardMaterial
          color={BELT_COLORS.accent}
          {...BELT_MAT.accent}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* ── Frame body — main structure ──────────────────── */}
      <mesh position={[0, BASE_H - 0.005 + (H - BASE_H + 0.005) / 2, 0]}>
        <boxGeometry args={[EXT, H - BASE_H + 0.005, FRAME_W]} />
        <meshStandardMaterial color={BELT_COLORS.frame} {...BELT_MAT.frame} />
      </mesh>

      {/* ── Belt surface — dark plane above frame ────────── */}
      <mesh position={[0, H + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[EXT, SURFACE_W]} />
        <meshStandardMaterial
          color={BELT_COLORS.surface}
          {...BELT_MAT.surface}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* ── Side rails — orange accent edges ────────────── */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[0, H + RAIL_H / 2, side * (SURFACE_HALF_W + RAIL_W / 2)]}
        >
          <boxGeometry args={[EXT, RAIL_H, RAIL_W]} />
          <meshStandardMaterial color={BELT_COLORS.rail} {...BELT_MAT.rail} />
        </mesh>
      ))}

      {/* ── Groove overlay — scrolling motion lines ─────── */}
      <mesh
        ref={overlayRef}
        position={[0, H + 0.003, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={material}
      >
        <planeGeometry args={[EXT, SURFACE_W]} />
      </mesh>

      {/* ── End-cap brackets — terminus where belt meets building ── */}
      {(endCap === "start" || endCap === "both") && (
        <mesh position={[-0.5, H / 2 + 0.01, 0]}>
          <boxGeometry args={[0.02, H * 0.65, SURFACE_W + 0.02]} />
          <meshStandardMaterial color={BELT_COLORS.cap} {...BELT_MAT.cap} />
        </mesh>
      )}
      {(endCap === "end" || endCap === "both") && (
        <mesh position={[0.5, H / 2 + 0.01, 0]}>
          <boxGeometry args={[0.02, H * 0.65, SURFACE_W + 0.02]} />
          <meshStandardMaterial color={BELT_COLORS.cap} {...BELT_MAT.cap} />
        </mesh>
      )}
    </group>
  );
}
