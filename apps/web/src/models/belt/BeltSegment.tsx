import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { FrontSide, ShaderMaterial, Vector3 } from "three";
import {
  BELT_TILE,
  BELT_SPEED,
  SURFACE_W,
  SURFACE_HALF_W,
  FRAME_W,
  RAIL_W,
  RAIL_H,
  BASE_W,
  BASE_H,
  ACCENT_Y,
  GROOVE_DENSITY,
  BELT_COLORS,
  BELT_MAT,
} from "./constants";
import { grooveVert, grooveFrag, GROOVE_RUNNING, GROOVE_STOPPED } from "./shaders";
import type { BeltSegmentProps, BeltPort } from "./types";

const H = BELT_TILE.height;
const LENGTH = 1.0;

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
 * orange accent rails, beveled base, end brackets.
 */
export function BeltSegment({
  power = "running",
  content = "empty",
  speed = BELT_SPEED,
  ...props
}: BeltSegmentProps) {
  const overlayRef = useRef<ShaderMaterial>(null);

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
      u.uTime.value += delta * speed;
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
        <boxGeometry args={[LENGTH, BASE_H, BASE_W]} />
        <meshStandardMaterial color={BELT_COLORS.base} {...BELT_MAT.base} />
      </mesh>

      {/* ── Accent stripe at base ───────────────────────── */}
      <mesh position={[0, ACCENT_Y, 0]}>
        <boxGeometry args={[LENGTH - 0.04, 0.015, FRAME_W + 0.01]} />
        <meshStandardMaterial color={BELT_COLORS.accent} {...BELT_MAT.accent} />
      </mesh>

      {/* ── Frame body — main structure ──────────────────── */}
      <mesh position={[0, BASE_H + (H - BASE_H) / 2, 0]}>
        <boxGeometry args={[LENGTH, H - BASE_H, FRAME_W]} />
        <meshStandardMaterial color={BELT_COLORS.frame} {...BELT_MAT.frame} />
      </mesh>

      {/* ── Belt surface — darker top panel ──────────────── */}
      <mesh position={[0, H - 0.01, 0]}>
        <boxGeometry args={[LENGTH - 0.02, 0.02, SURFACE_W]} />
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
          <boxGeometry args={[LENGTH - 0.04, RAIL_H, RAIL_W]} />
          <meshStandardMaterial color={BELT_COLORS.rail} {...BELT_MAT.rail} />
        </mesh>
      ))}

      {/* ── End brackets — chunky joint markers ─────────── */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={`cap-${side}`}
          position={[side * 0.485, H * 0.45, 0]}
        >
          <boxGeometry args={[0.03, H * 0.65, FRAME_W + 0.02]} />
          <meshStandardMaterial color={BELT_COLORS.cap} {...BELT_MAT.cap} />
        </mesh>
      ))}

      {/* ── Groove overlay — scrolling motion lines ─────── */}
      <mesh position={[0, H + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[LENGTH - 0.04, SURFACE_W]} />
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
    </group>
  );
}

/** Reusable vector for lerp target (avoids allocation per frame) */
const _lerpTarget = new Vector3();
