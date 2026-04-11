import { useFrame } from "@react-three/fiber";
import type { AtomRegistry } from "effect/unstable/reactivity";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";
import { COLORS } from "../colors";
import { B } from "../building/palette";
import { syncMinerMotion } from "../Miner.state";
import {
  BELT_COLORS,
  BELT_MAT,
  DEFAULT_BELT_RATE_PER_MINUTE,
  resolveBeltSpeed,
} from "./constants";
import { useGrooveMaterial } from "./useGrooveMaterial";

/* ── Palette ──────────────────────────────────────────────── */

const OUTPUT_COLOR = COLORS.processor;
const HULL_BRIGHT = B.bright;

/* ── Output box ───────────────────────────────────────────── */

const BOX_W = 0.14;
const BOX_H = 0.12;
const BOX_D = 0.2;
const BOX_X = 0.75;

/* ── Door panel in body-local space ───────────────────────── */

const DOOR_FACE_X = 0.326;
const DOOR_Y = 0.245;

/* ── Ramp belt profile ────────────────────────────────────── */

const R_BASE_H = 0.018;
const R_FRAME_H = 0.05;
const R_SURFACE_W = 0.16;
const R_FRAME_W = 0.2;
const R_BASE_W = 0.24;
const R_RAIL_W = 0.018;
const R_RAIL_H = 0.012;
const R_ACCENT_Y = R_BASE_H + 0.003;
const R_GROOVE_REPEAT = 8;

/* Center offset so the belt profile is centered at y=0 */
const BELT_Y = -R_FRAME_H / 2;

/* ── Support struts ───────────────────────────────────────── */

const STRUT_COUNT = 4;
const RUNG_COUNT = 12;

/* ── Pre-computed keys ────────────────────────────────────── */

const RUNG_KEYS = Array.from({ length: RUNG_COUNT }, (_, i) => `r-${i}`);
const STRUT_KEYS = Array.from({ length: STRUT_COUNT }, (_, i) => `s-${i}`);

/* ── Static geometry ──────────────────────────────────────── */

function computeGeometry(groundDistance: number) {
  const staticGroundY = -groundDistance;
  const boxY = staticGroundY + BOX_H / 2;

  const rampBtmX = BOX_X - 0.015;
  const rampBtmY = staticGroundY + BOX_H + 0.01;
  const rampTopX = DOOR_FACE_X;
  const rampTopY = DOOR_Y;

  const dx = rampTopX - rampBtmX;
  const dy = rampTopY - rampBtmY;
  const rampLen = Math.sqrt(dx * dx + dy * dy);
  const rampAngle = Math.atan2(dy, dx);
  const rampMidX = (rampBtmX + rampTopX) / 2;
  const rampMidY = (rampBtmY + rampTopY) / 2;

  const struts = Array.from({ length: STRUT_COUNT }, (_, i) => {
    const t = (i + 1) / (STRUT_COUNT + 1);
    return {
      x: rampBtmX + dx * t,
      topY: rampBtmY + dy * t,
      baseHeight: rampBtmY + dy * t - staticGroundY,
    };
  });

  return {
    boxY,
    rampLen,
    rampAngle,
    rampMidX,
    rampMidY,
    staticGroundY,
    struts,
  };
}

/* ── Component ────────────────────────────────────────────── */

export interface MinerPortDockProps {
  registry: AtomRegistry.AtomRegistry;
  groundDistance: number;
}

export function MinerPortDock({
  registry,
  groundDistance,
}: MinerPortDockProps) {
  const geo = useMemo(() => computeGeometry(groundDistance), [groundDistance]);

  const boxRef = useRef<Group>(null);
  const grooveRef = useRef<Mesh>(null);
  const strutBarRefs = useRef<(Group | null)[]>([]);
  const strutFootRefs = useRef<(Group | null)[]>([]);

  const beltSpeed = resolveBeltSpeed({
    ratePerMinute: DEFAULT_BELT_RATE_PER_MINUTE,
  });

  const grooveRepeat = geo.rampLen * R_GROOVE_REPEAT;

  // Dual-mode groove material (GLSL for WebGL, TSL for WebGPU)
  const { material: grooveMaterial } = useGrooveMaterial({
    repeat: grooveRepeat,
    running: true,
    speed: beltSpeed,
  });

  // Strut animation (separate from groove animation)
  useFrame(({ clock }) => {
    const { drop } = syncMinerMotion(registry, clock.elapsedTime);
    const groundY = -groundDistance + drop;

    // Pin output box to ground
    if (boxRef.current) {
      boxRef.current.position.y = groundY + BOX_H / 2;
    }

    // Animate strut legs (IK feet)
    for (let i = 0; i < STRUT_COUNT; i++) {
      const strut = geo.struts[i]!;
      const currentHeight = strut.topY - groundY;
      const scale = currentHeight / strut.baseHeight;

      const barGroup = strutBarRefs.current[i];
      if (barGroup) {
        barGroup.position.y = (strut.topY + groundY) / 2;
        barGroup.scale.y = scale;
      }

      const footGroup = strutFootRefs.current[i];
      if (footGroup) {
        footGroup.position.y = groundY;
      }
    }
  });

  const {
    boxY,
    rampLen,
    rampAngle,
    rampMidX,
    rampMidY,
    staticGroundY,
    struts,
  } = geo;

  return (
    <group>
      {/* ══════════════════════════════════════════════════════
       *  Output Box — pinned to ground, belt-styled
       * ══════════════════════════════════════════════════════ */}
      <group ref={boxRef} position={[BOX_X, boxY, 0]}>
        {/* Frame body */}
        <mesh>
          <boxGeometry args={[BOX_W, BOX_H, BOX_D]} />
          <meshStandardMaterial color={BELT_COLORS.frame} {...BELT_MAT.frame} />
        </mesh>

        {/* Teal output face */}
        <mesh position={[BOX_W / 2 + 0.002, 0, 0]}>
          <boxGeometry args={[0.008, BOX_H * 0.65, BOX_D * 0.7]} />
          <meshStandardMaterial
            color={OUTPUT_COLOR}
            emissive={OUTPUT_COLOR}
            emissiveIntensity={0.12}
            roughness={0.4}
            metalness={0}
          />
        </mesh>

        {/* Connection sphere */}
        <mesh position={[BOX_W / 2 + 0.008, 0, BOX_D / 2 - 0.03]}>
          <sphereGeometry args={[0.012, 8, 6]} />
          <meshStandardMaterial
            color={HULL_BRIGHT}
            roughness={0.35}
            metalness={0}
          />
        </mesh>

        {/* 4× Face bolts */}
        {(
          [
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
          ] as const
        ).map(([sy, sz]) => (
          <mesh
            key={`fb-${sy}-${sz}`}
            position={[
              BOX_W / 2 + 0.005,
              sy * (BOX_H / 2 - 0.018),
              sz * (BOX_D / 2 - 0.02),
            ]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.006, 0.006, 0.008, 6]} />
            <meshStandardMaterial color={BELT_COLORS.base} {...BELT_MAT.base} />
          </mesh>
        ))}

        {/* Top rim */}
        <mesh position={[0, BOX_H / 2 + 0.005, 0]}>
          <boxGeometry args={[BOX_W + 0.012, 0.01, BOX_D + 0.012]} />
          <meshStandardMaterial color={BELT_COLORS.base} {...BELT_MAT.base} />
        </mesh>

        {/* Bottom rim */}
        <mesh position={[0, -(BOX_H / 2 + 0.003), 0]}>
          <boxGeometry args={[BOX_W + 0.006, 0.006, BOX_D + 0.006]} />
          <meshStandardMaterial color={BELT_COLORS.base} {...BELT_MAT.base} />
        </mesh>

        {/* Side accent stripes — rail orange */}
        {([-1, 1] as const).map((sz) => (
          <mesh key={`sa-${sz}`} position={[0, 0, sz * (BOX_D / 2 + 0.002)]}>
            <boxGeometry args={[BOX_W * 0.75, BOX_H * 0.22, 0.005]} />
            <meshStandardMaterial color={BELT_COLORS.rail} {...BELT_MAT.rail} />
          </mesh>
        ))}
      </group>

      {/* ══════════════════════════════════════════════════════
       *  Conveyor Ramp — NarrowBeltRun-style layered belt
       * ══════════════════════════════════════════════════════ */}
      <group position={[rampMidX, rampMidY, 0]} rotation={[0, 0, rampAngle]}>
        {/* ── Layer 1: Base plate (widest, bottom) ── */}
        <mesh position={[0, BELT_Y + R_BASE_H / 2, 0]}>
          <boxGeometry args={[rampLen + 0.02, R_BASE_H, R_BASE_W]} />
          <meshStandardMaterial color={BELT_COLORS.base} {...BELT_MAT.base} />
        </mesh>

        {/* ── Accent stripe on base ── */}
        <mesh position={[0, BELT_Y + R_ACCENT_Y, 0]}>
          <boxGeometry args={[rampLen + 0.01, 0.005, R_FRAME_W + 0.01]} />
          <meshStandardMaterial
            color={BELT_COLORS.accent}
            {...BELT_MAT.accent}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>

        {/* ── Layer 2: Frame body ── */}
        <mesh
          position={[0, BELT_Y + R_BASE_H + (R_FRAME_H - R_BASE_H) / 2, 0]}
        >
          <boxGeometry args={[rampLen, R_FRAME_H - R_BASE_H, R_FRAME_W]} />
          <meshStandardMaterial color={BELT_COLORS.frame} {...BELT_MAT.frame} />
        </mesh>

        {/* ── Layer 3: Belt surface (dark plane) ── */}
        <mesh
          position={[0, BELT_Y + R_FRAME_H + 0.001, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[rampLen, R_SURFACE_W]} />
          <meshStandardMaterial
            color={BELT_COLORS.surface}
            {...BELT_MAT.surface}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>

        {/* ── Layer 4: Side rails (orange) ── */}
        {([-1, 1] as const).map((side) => (
          <mesh
            key={`rail-${side}`}
            position={[
              0,
              BELT_Y + R_FRAME_H + R_RAIL_H / 2,
              side * (R_SURFACE_W / 2 + R_RAIL_W / 2),
            ]}
          >
            <boxGeometry args={[rampLen + 0.02, R_RAIL_H, R_RAIL_W]} />
            <meshStandardMaterial color={BELT_COLORS.rail} {...BELT_MAT.rail} />
          </mesh>
        ))}

        {/* ── Groove overlay — TSL/GLSL scrolling ── */}
        <mesh
          ref={grooveRef}
          position={[0, BELT_Y + R_FRAME_H + 0.003, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={grooveMaterial}
        >
          <planeGeometry args={[rampLen, R_SURFACE_W]} />
        </mesh>

        {/* ── Cross-bar rungs (structural, on top of surface) ── */}
        {RUNG_KEYS.map((key, i) => {
          const t = (i + 0.5) / RUNG_COUNT;
          const x = (t - 0.5) * rampLen;
          return (
            <mesh
              key={key}
              position={[x, BELT_Y + R_FRAME_H + R_RAIL_H + 0.003, 0]}
            >
              <boxGeometry args={[0.012, 0.006, R_SURFACE_W]} />
              <meshStandardMaterial color={BELT_COLORS.cap} {...BELT_MAT.cap} />
            </mesh>
          );
        })}

        {/* ── End-cap brackets ── */}
        {([-1, 1] as const).map((end) => (
          <mesh
            key={`ec-${end}`}
            position={[end * (rampLen / 2 + 0.005), BELT_Y + R_FRAME_H / 2, 0]}
          >
            <boxGeometry args={[0.015, R_FRAME_H * 0.7, R_SURFACE_W + 0.02]} />
            <meshStandardMaterial color={BELT_COLORS.cap} {...BELT_MAT.cap} />
          </mesh>
        ))}

        {/* ── Accent bolts at rail corners ── */}
        {([-1, 1] as const).map((end) =>
          ([-1, 1] as const).map((sz) => (
            <mesh
              key={`ab-${end}-${sz}`}
              position={[
                end * (rampLen / 2 - 0.025),
                BELT_Y + R_FRAME_H + R_RAIL_H,
                sz * (R_SURFACE_W / 2 + R_RAIL_W / 2),
              ]}
            >
              <boxGeometry args={[0.012, 0.012, 0.012]} />
              <meshStandardMaterial
                color={BELT_COLORS.accent}
                {...BELT_MAT.accent}
              />
            </mesh>
          )),
        )}
      </group>

      {/* ══════════════════════════════════════════════════════
       *  Top mounting bracket — frames the cabin door
       * ══════════════════════════════════════════════════════ */}
      <group position={[DOOR_FACE_X + 0.005, DOOR_Y, 0]}>
        <mesh>
          <boxGeometry args={[0.02, 0.12, R_FRAME_W + 0.03]} />
          <meshStandardMaterial color={BELT_COLORS.frame} {...BELT_MAT.frame} />
        </mesh>
        <mesh position={[0.005, 0.065, 0]}>
          <boxGeometry args={[0.025, 0.012, R_FRAME_W + 0.04]} />
          <meshStandardMaterial color={BELT_COLORS.cap} {...BELT_MAT.cap} />
        </mesh>
        <mesh position={[0.005, -0.065, 0]}>
          <boxGeometry args={[0.025, 0.012, R_FRAME_W + 0.04]} />
          <meshStandardMaterial color={BELT_COLORS.cap} {...BELT_MAT.cap} />
        </mesh>
      </group>

      {/* ══════════════════════════════════════════════════════
       *  Support Struts — feet pinned to ground via drop IK
       * ══════════════════════════════════════════════════════ */}
      {STRUT_KEYS.map((key, i) => {
        const strut = struts[i]!;
        const baseCenterY = (strut.topY + staticGroundY) / 2;

        return (
          <group key={key} position={[strut.x, 0, 0]}>
            {/* Bar group — animated */}
            <group
              ref={(el) => {
                strutBarRefs.current[i] = el;
              }}
              position={[0, baseCenterY, 0]}
            >
              {/* Left leg */}
              <mesh position={[0, 0, 0.08]}>
                <boxGeometry args={[0.01, strut.baseHeight, 0.01]} />
                <meshStandardMaterial
                  color={BELT_COLORS.frame}
                  {...BELT_MAT.frame}
                />
              </mesh>
              {/* Right leg */}
              <mesh position={[0, 0, -0.08]}>
                <boxGeometry args={[0.01, strut.baseHeight, 0.01]} />
                <meshStandardMaterial
                  color={BELT_COLORS.frame}
                  {...BELT_MAT.frame}
                />
              </mesh>
              {/* Cross-brace (lower third) */}
              <mesh position={[0, -strut.baseHeight * 0.3, 0]}>
                <boxGeometry args={[0.008, 0.008, 0.16]} />
                <meshStandardMaterial
                  color={BELT_COLORS.base}
                  {...BELT_MAT.base}
                />
              </mesh>
              {/* Diagonal brace */}
              <mesh
                position={[0, strut.baseHeight * 0.1, 0.04]}
                rotation={[0.35, 0, 0]}
              >
                <boxGeometry args={[0.006, strut.baseHeight * 0.4, 0.006]} />
                <meshStandardMaterial
                  color={BELT_COLORS.base}
                  {...BELT_MAT.base}
                />
              </mesh>
              <mesh
                position={[0, strut.baseHeight * 0.1, -0.04]}
                rotation={[-0.35, 0, 0]}
              >
                <boxGeometry args={[0.006, strut.baseHeight * 0.4, 0.006]} />
                <meshStandardMaterial
                  color={BELT_COLORS.base}
                  {...BELT_MAT.base}
                />
              </mesh>
            </group>

            {/* Foot pad — animated to ground */}
            <group
              ref={(el) => {
                strutFootRefs.current[i] = el;
              }}
              position={[0, staticGroundY, 0]}
            >
              <mesh>
                <boxGeometry args={[0.03, 0.008, 0.18]} />
                <meshStandardMaterial
                  color={BELT_COLORS.cap}
                  {...BELT_MAT.cap}
                />
              </mesh>
              {/* Foot accent stripe */}
              <mesh position={[0, 0.005, 0]}>
                <boxGeometry args={[0.025, 0.003, 0.14]} />
                <meshStandardMaterial
                  color={BELT_COLORS.accent}
                  {...BELT_MAT.accent}
                />
              </mesh>
            </group>

            {/* Upper bracket */}
            <mesh position={[0, strut.topY - 0.015, 0]}>
              <boxGeometry args={[0.025, 0.014, R_FRAME_W + 0.01]} />
              <meshStandardMaterial color={BELT_COLORS.cap} {...BELT_MAT.cap} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
