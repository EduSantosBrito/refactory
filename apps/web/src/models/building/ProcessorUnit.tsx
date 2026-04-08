import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, Mesh } from "three";
import { MeshStandardMaterial } from "three";
import { Antenna } from "../Antenna";
import { PortDock } from "../belt/PortDock";
import { PROCESSOR_PORTS } from "../belt/ports";
import type { ModelProps } from "../colors";
import { COLORS } from "../colors";
import { StatusPole, type StatusPoleStatus } from "../StatusPole";
import { B, M } from "./palette";

/* ── Exhaust smoke — lighter/smaller than furnace smoke ── */
const SMOKE_COUNT = 8;
const SMOKE_KEYS = Array.from(
  { length: SMOKE_COUNT },
  (_, index) => `sm-${index}`,
);

type PuffState = { driftX: number; driftZ: number; riseSpeed: number };

function ExhaustSmoke() {
  const refs = useRef<Mesh[]>([]);
  const puffs = useRef<Map<number, PuffState>>(new Map());
  const nextSpawn = useRef(0);
  const nextIdx = useRef(0);

  useFrame(({ clock }, delta) => {
    for (let i = 0; i < refs.current.length; i++) {
      const smoke = refs.current[i];
      if (!smoke) continue;
      if (!smoke.visible) continue;
      const p = puffs.current.get(i);
      if (!p) continue;

      smoke.scale.setScalar(smoke.scale.x + delta * 0.1);
      smoke.position.y += delta * p.riseSpeed;
      smoke.position.x += delta * p.driftX;
      smoke.position.z +=
        delta * p.driftZ +
        Math.sin(clock.elapsedTime * 0.6 + i) * delta * 0.003;

      if (smoke.material instanceof MeshStandardMaterial) {
        smoke.material.opacity = Math.max(
          0,
          smoke.material.opacity - delta * 0.09,
        );
        if (smoke.material.opacity <= 0) {
          smoke.visible = false;
        }
      }
    }

    if (clock.elapsedTime >= nextSpawn.current) {
      const idx = nextIdx.current % SMOKE_COUNT;
      const smoke = refs.current[idx];
      if (smoke) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.02;
        smoke.visible = true;
        smoke.scale.setScalar(0.6 + Math.random() * 0.4);
        smoke.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        puffs.current.set(idx, {
          driftX: (Math.random() - 0.3) * 0.01,
          driftZ: (Math.random() - 0.5) * 0.007,
          riseSpeed: 0.02 + Math.random() * 0.015,
        });
        if (smoke.material instanceof MeshStandardMaterial) {
          smoke.material.opacity = 0.25 + Math.random() * 0.12;
        }
      }
      nextIdx.current = idx + 1;
      nextSpawn.current = clock.elapsedTime + 0.35 + Math.random() * 0.45;
    }
  });

  return (
    <group>
      {SMOKE_KEYS.map((smokeKey, i) => (
        <mesh
          key={smokeKey}
          ref={(el) => {
            if (el) refs.current[i] = el;
          }}
          visible={false}
        >
          <sphereGeometry args={[0.025, 8, 6]} />
          <meshStandardMaterial
            color="#b8c0b8"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * ProcessorUnit — "Assembler Press"
 *
 * Compact industrial crafting machine. Material enters through a front intake,
 * gets processed under a raised mechanical press deck supported by four chunky
 * piston columns, and exits through a side output linkage.
 *
 * FORM: squat rectangular base + 4 support columns + elevated press deck
 * FLOW: front intake (+Z) → central chamber → side output arm (-X)
 *       exhaust → short pipe (back-right)
 */

/* ── Dimensions ── */
const SIDES = 8;

const FOUND_H = 0.05;
const FOUND_Y = FOUND_H / 2;

const PLAT_H = 0.08;
const PLAT_BOT = FOUND_H;
const PLAT_Y = PLAT_BOT + PLAT_H / 2;

const COL_H = 0.15;
const COL_BOT = PLAT_BOT + PLAT_H;
const COL_Y = COL_BOT + COL_H / 2;

const DECK_H = 0.04;
const DECK_BOT = COL_BOT + COL_H;
const DECK_Y = DECK_BOT + DECK_H / 2;

const BODY_TOP = DECK_BOT + DECK_H;

const PLAT_W = 0.48;
const PLAT_D = 0.36;

const COL_X = 0.17;
const COL_Z = 0.12;
const COL_R = 0.028;

const DECK_W = 0.5;
const DECK_D = 0.38;

type ProcessorProps = ModelProps & {
  status?: StatusPoleStatus;
};

export function ProcessorUnit({ status = "green", ...props }: ProcessorProps) {
  const glowActive = status === "green" || status === "yellow";
  const smokeActive = status === "green";

  const intakeGlowRef = useRef<Mesh>(null);
  const exhaustGlowRef = useRef<Mesh>(null);
  const pressGlowRef = useRef<Mesh>(null);
  const armRef = useRef<Group>(null);
  const pressRef = useRef<Group>(null);

  useFrame(() => {
    /* ── Emissive off when red ── */
    if (!glowActive) {
      for (const ref of [intakeGlowRef, exhaustGlowRef, pressGlowRef]) {
        if (ref.current) {
          (ref.current.material as MeshStandardMaterial).emissiveIntensity = 0;
        }
      }
      if (armRef.current) {
        armRef.current.rotation.y = 0;
        armRef.current.rotation.z = 0;
      }
      if (pressRef.current) pressRef.current.position.y = 0;
      return;
    }

    const t = Date.now() * 0.004;

    /* ── Emissive pulses (green + yellow) ── */
    if (intakeGlowRef.current) {
      const mat = intakeGlowRef.current.material as MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.sin(t) * 0.3;
    }
    if (exhaustGlowRef.current) {
      const mat = exhaustGlowRef.current.material as MeshStandardMaterial;
      mat.emissiveIntensity = 0.4 + Math.sin(t * 1.2 + 1) * 0.25;
    }
    if (pressGlowRef.current) {
      const mat = pressGlowRef.current.material as MeshStandardMaterial;
      mat.emissiveIntensity = 0.6 + Math.sin(t * 0.8 + 2) * 0.3;
    }

    /* ── Mechanical animation — green only ── */
    if (smokeActive) {
      const CYCLE = 2.5;
      const phase = ((Date.now() * 0.001) % CYCLE) / CYCLE; // 0..1
      const ss = (x: number) => x * x * (3 - 2 * x); // smoothstep

      // Arm: lift up (+Z rot) and swing inward (+Y rot) simultaneously
      // Like a mechanical arm reaching up to place item under the press
      // 0.00–0.30  swing up & inward
      // 0.30–0.42  hold at center (depositing)
      // 0.42–0.75  swing back down & outward
      // 0.75–1.00  rest
      const ARM_SWING = Math.PI * 0.55; // ~100° horizontal sweep toward center
      const ARM_LIFT = -0.5; // ~29° upward lift (negative because arm extends in -X)
      let armProgress = 0;
      if (phase < 0.3) {
        armProgress = ss(phase / 0.3);
      } else if (phase < 0.42) {
        armProgress = 1;
      } else if (phase < 0.75) {
        armProgress = 1 - ss((phase - 0.42) / 0.33);
      }
      if (armRef.current) {
        armRef.current.rotation.y = armProgress * ARM_SWING;
        armRef.current.rotation.z = armProgress * ARM_LIFT;
      }

      // Press: stamps down AFTER arm retracts
      // 0.60–0.72  descend (fast slam)
      // 0.72–0.80  hold at bottom (stamping)
      // 0.80–0.92  rise back up
      const PRESS_TRAVEL = -0.09; // nearly full gap between deck and platform
      let pressY = 0;
      if (phase >= 0.6 && phase < 0.72) {
        pressY = ss((phase - 0.6) / 0.12) * PRESS_TRAVEL;
      } else if (phase >= 0.72 && phase < 0.8) {
        pressY = PRESS_TRAVEL;
      } else if (phase >= 0.8 && phase < 0.92) {
        pressY = (1 - ss((phase - 0.8) / 0.12)) * PRESS_TRAVEL;
      }
      if (pressRef.current) pressRef.current.position.y = pressY;
    } else {
      // Yellow — mechanical parts at rest
      if (armRef.current) {
        armRef.current.rotation.y = 0;
        armRef.current.rotation.z = 0;
      }
      if (pressRef.current) pressRef.current.position.y = 0;
    }
  });

  return (
    <group {...props}>
      {/* ═══════════════════════════════════════════
          1. FOUNDATION — octagonal pad
          ═══════════════════════════════════════════ */}
      <group position={[0, FOUND_Y, 0]}>
        <mesh>
          <cylinderGeometry args={[0.3, 0.33, FOUND_H, SIDES]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
        <mesh position={[0, -FOUND_H / 2 + 0.005, 0]}>
          <cylinderGeometry args={[0.34, 0.36, 0.012, SIDES]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════════
          2. BASE PLATFORM — squat rectangular machine body
          ═══════════════════════════════════════════ */}
      <group position={[0, PLAT_Y, 0]}>
        <mesh>
          <boxGeometry args={[PLAT_W, PLAT_H, PLAT_D]} />
          <meshStandardMaterial color={B.bright} {...M} flatShading />
        </mesh>
        {/* Bottom edge trim */}
        <mesh position={[0, -PLAT_H / 2 + 0.008, 0]}>
          <boxGeometry args={[PLAT_W + 0.02, 0.015, PLAT_D + 0.02]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
        </mesh>
        {/* Top collar */}
        <mesh position={[0, PLAT_H / 2 - 0.008, 0]}>
          <boxGeometry args={[PLAT_W + 0.01, 0.012, PLAT_D + 0.01]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
        {/* Recessed side panels — left and right */}
        {[-1, 1].map((side) => (
          <mesh
            key={`sp-${side}`}
            position={[side * (PLAT_W / 2 + 0.002), 0, 0.04]}
          >
            <boxGeometry args={[0.012, 0.055, 0.14]} />
            <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
          </mesh>
        ))}
      </group>

      {/* ═══════════════════════════════════════════
          3. SUPPORT COLUMNS — four chunky pistons
          ═══════════════════════════════════════════ */}
      {(
        [
          [COL_X, COL_Z],
          [-COL_X, COL_Z],
          [COL_X, -COL_Z],
          [-COL_X, -COL_Z],
        ] as const
      ).map(([cx, cz]) => (
        <group key={`col-${cx}-${cz}`} position={[cx, COL_Y, cz]}>
          {/* Main column shaft */}
          <mesh>
            <cylinderGeometry args={[COL_R, COL_R + 0.005, COL_H, 6]} />
            <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
          </mesh>
          {/* Lower piston ring */}
          <mesh position={[0, -COL_H / 2 + 0.02, 0]}>
            <cylinderGeometry args={[COL_R + 0.012, COL_R + 0.012, 0.015, 6]} />
            <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
          </mesh>
          {/* Upper piston ring */}
          <mesh position={[0, COL_H / 2 - 0.02, 0]}>
            <cylinderGeometry args={[COL_R + 0.01, COL_R + 0.01, 0.012, 6]} />
            <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* ═══════════════════════════════════════════
          4. PRESS DECK — elevated top assembly
          ═══════════════════════════════════════════ */}
      <group position={[0, DECK_Y, 0]}>
        {/* Main deck plate */}
        <mesh>
          <boxGeometry args={[DECK_W, DECK_H, DECK_D]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
        </mesh>
        {/* Top rail — hazard-trim accent */}
        <mesh position={[0, DECK_H / 2 + 0.008, 0]}>
          <boxGeometry args={[DECK_W + 0.02, 0.015, DECK_D + 0.02]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.5} />
        </mesh>
        {/* Press glow — underside process light */}
        <mesh ref={pressGlowRef} position={[0, -DECK_H / 2 + 0.005, 0]}>
          <boxGeometry args={[0.16, 0.012, 0.16]} />
          <meshStandardMaterial
            color={COLORS.processor}
            emissive={COLORS.processor}
            emissiveIntensity={0.6}
            {...M}
            roughness={0.3}
          />
        </mesh>
        {/* Press head — descending stamp block (animated) */}
        <group ref={pressRef}>
          <mesh position={[0, -DECK_H / 2 - 0.025, 0]}>
            <boxGeometry args={[0.12, 0.04, 0.12]} />
            <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
          </mesh>
          {/* Press head accent ring */}
          <mesh position={[0, -DECK_H / 2 - 0.04, 0]}>
            <boxGeometry args={[0.14, 0.008, 0.14]} />
            <meshStandardMaterial color={B.accent} {...M} roughness={0.5} />
          </mesh>
        </group>
      </group>

      {/* ═══════════════════════════════════════════
          5. FRONT INTAKE — framed mouth with belt tunnel
          ═══════════════════════════════════════════ */}
      <group position={[0, PLAT_Y + 0.01, PLAT_D / 2 + 0.01]}>
        {/* Door frame */}
        <mesh>
          <boxGeometry args={[0.18, 0.1, 0.025]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>
        {/* Recessed tunnel glow */}
        <mesh ref={intakeGlowRef} position={[0, 0, -0.005]}>
          <boxGeometry args={[0.13, 0.07, 0.015]} />
          <meshStandardMaterial
            color={COLORS.processor}
            emissive={COLORS.processor}
            emissiveIntensity={0.5}
            {...M}
            roughness={0.3}
          />
        </mesh>
        {/* Belt roller bars (3 horizontal) */}
        {[-1, 0, 1].map((row) => (
          <mesh key={`belt-${row}`} position={[0, row * 0.025, 0.008]}>
            <boxGeometry args={[0.14, 0.006, 0.005]} />
            <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
          </mesh>
        ))}
        {/* Intake hinges */}
        {[-1, 1].map((side) => (
          <mesh key={`ih-${side}`} position={[side * 0.08, 0, 0.005]}>
            <cylinderGeometry args={[0.008, 0.008, 0.09, 6]} />
            <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
          </mesh>
        ))}
      </group>

      {/* ═══════════════════════════════════════════
          6. OUTPUT ARM — side-mounted mechanical linkage (-X)
          ═══════════════════════════════════════════ */}
      <group
        ref={armRef}
        position={[-PLAT_W / 2 - 0.02, PLAT_Y + PLAT_H / 2 + 0.02, 0]}
      >
        {/* Shoulder bracket */}
        <mesh>
          <boxGeometry args={[0.04, 0.06, 0.08]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
        </mesh>
        {/* Arm segment 1 */}
        <mesh position={[-0.06, 0.01, 0]} rotation={[0, 0, -0.2]}>
          <boxGeometry args={[0.1, 0.03, 0.05]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
        </mesh>
        {/* Arm joint (accent pivot) */}
        <mesh position={[-0.1, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.06, 6]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.5} />
        </mesh>
        {/* Arm segment 2 — angled down */}
        <mesh position={[-0.15, -0.02, 0]} rotation={[0, 0, 0.3]}>
          <boxGeometry args={[0.08, 0.025, 0.04]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
        </mesh>
        {/* Gripper / output end */}
        <mesh position={[-0.18, -0.04, 0]}>
          <boxGeometry args={[0.04, 0.04, 0.05]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════════
          7. BACK PANEL — recessed detail (-Z face)
          ═══════════════════════════════════════════ */}
      <group position={[0, PLAT_Y, -PLAT_D / 2 - 0.008]}>
        <mesh>
          <boxGeometry args={[0.22, 0.06, 0.015]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>
        <mesh position={[0, 0, -0.005]}>
          <boxGeometry args={[0.17, 0.04, 0.008]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════════
          8. EXHAUST PIPE — short vent, back-right corner
          ═══════════════════════════════════════════ */}
      <group
        position={[PLAT_W / 2 - 0.06, BODY_TOP, -PLAT_D / 2 + 0.04]}
        rotation={[0, 0, -0.06]}
      >
        {/* Base collar */}
        <mesh position={[0, 0.015, 0]}>
          <cylinderGeometry args={[0.032, 0.038, 0.03, SIDES]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
        {/* Pipe */}
        <mesh position={[0, 0.09, 0]}>
          <cylinderGeometry args={[0.025, 0.03, 0.14, SIDES]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
        </mesh>
        {/* Heat band */}
        <mesh position={[0, 0.06, 0]}>
          <torusGeometry args={[0.033, 0.006, 6, SIDES]} />
          <meshStandardMaterial
            color={B.accent}
            {...M}
            roughness={0.5}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
        {/* Pipe lip */}
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.035, 0.027, 0.015, SIDES]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
        </mesh>
        {/* Cap */}
        <mesh position={[0, 0.175, 0]}>
          <cylinderGeometry args={[0.042, 0.042, 0.008, SIDES]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
        </mesh>
        {/* Exhaust glow ring */}
        <mesh ref={exhaustGlowRef} position={[0, 0.155, 0]}>
          <torusGeometry args={[0.028, 0.004, 6, SIDES]} />
          <meshStandardMaterial
            color={COLORS.processor}
            emissive={COLORS.processor}
            emissiveIntensity={0.4}
            {...M}
            roughness={0.4}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>

        {/* Smoke */}
        {smokeActive && (
          <group position={[0, 0.18, 0]}>
            <ExhaustSmoke />
          </group>
        )}
      </group>

      {/* ═══════════════════════════════════════════
          9. ACCESSORIES
          ═══════════════════════════════════════════ */}
      <StatusPole
        position={[PLAT_W / 2 - 0.04, BODY_TOP + 0.22, PLAT_D / 2 - 0.04]}
        scale={0.22}
        status={status}
      />
      <Antenna
        position={[-PLAT_W / 2 + 0.06, BODY_TOP + 0.005, -PLAT_D / 2 + 0.04]}
        scale={0.2}
        speed={0.5}
      />

      {/* ═══════════════════════════════════════════
          10. PORT DOCKS — west input, east output
          ═══════════════════════════════════════════ */}
      {[...PROCESSOR_PORTS.inputs, ...PROCESSOR_PORTS.outputs].map((port) => (
        <PortDock key={port.id} port={port} />
      ))}
    </group>
  );
}
