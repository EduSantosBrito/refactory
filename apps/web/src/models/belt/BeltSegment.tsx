import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { FrontSide, type ShaderMaterial, Vector3 } from "three";
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
import {
  GROOVE_RUNNING,
  GROOVE_STOPPED,
  grooveFrag,
  grooveVert,
} from "./shaders";
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
 */
export function BeltSegment({
  power = "running",
  content: _content = "empty",
  ratePerMinute = DEFAULT_BELT_RATE_PER_MINUTE,
  speed,
  endCap,
  ...props
}: BeltSegmentProps) {
  const overlayRef = useRef<ShaderMaterial>(null);
  const beltSpeed = resolveBeltSpeed({ ratePerMinute, speed }) ?? BELT_SPEED;

  const running = power === "running";
  const groove = running ? GROOVE_RUNNING : GROOVE_STOPPED;
  const repeat = LENGTH * GROOVE_DENSITY;

  useFrame((_, delta) => {
    const mat = overlayRef.current;
    if (!mat) return;

    const u = mat.uniforms as {
      uTime: { value: number };
      uRepeat: { value: number };
      uOpacity: { value: number };
      uColor: { value: Vector3 };
    };

    if (running) {
      u.uTime.value += delta * beltSpeed;
    }

    u.uOpacity.value += (groove.opacity - u.uOpacity.value) * 0.1;
    u.uColor.value.lerp(
      _lerpTarget.set(groove.color[0], groove.color[1], groove.color[2]),
      0.1,
    );
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
      <mesh position={[0, H + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[EXT, SURFACE_W]} />
        <shaderMaterial
          ref={overlayRef}
          transparent
          depthWrite={false}
          side={FrontSide}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
          vertexShader={grooveVert}
          fragmentShader={grooveFrag}
          uniforms={{
            uTime: { value: 0 },
            uRepeat: { value: repeat },
            uOpacity: { value: groove.opacity },
            uColor: { value: new Vector3(...groove.color) },
          }}
        />
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

/** Reusable vector for lerp target (avoids allocation per frame) */
const _lerpTarget = new Vector3();
