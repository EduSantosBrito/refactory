import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { B, M } from "./palette";
import { MechLeg } from "../MechLeg";
import type { ModelProps } from "../colors";
import { COLORS } from "../colors";

/**
 * Processor Unit — Satisfactory Constructor-inspired Machine
 *
 * Based on Satisfactory's Constructor: a chunky rectangular housing
 * with a visible open cavity on the front face showing a hydraulic
 * press/stamp mechanism that cycles up and down.
 *
 * FLOW: input port (+X) -> press cavity (front visible) -> output port (-X)
 * SILHOUETTE: boxy machine + raised header + visible press arm
 */

/* ── Dimensions ── */
const LEG_H = 0.14;
const FOUND_H = 0.04;
const FOUND_Y = LEG_H + FOUND_H / 2;

/* Main housing body — chunky, roughly cubic */
const BODY_W = 0.44;
const BODY_D = 0.40;
const BODY_H = 0.26;
const BODY_Y = LEG_H + FOUND_H + BODY_H / 2;
const BODY_TOP = LEG_H + FOUND_H + BODY_H;

/* Top header — raised section housing upper press mechanism */
const HEADER_W = BODY_W * 0.70;
const HEADER_D = BODY_D * 0.65;
const HEADER_H = 0.09;

/* Press animation */
const PRESS_TRAVEL = 0.032;

export function ProcessorUnit(props: ModelProps) {
  const pressRef = useRef<Group>(null);

  useFrame(() => {
    if (!pressRef.current) return;
    const t = Date.now() * 0.003;
    /* Quick stamp down, slow rise up */
    const raw = Math.sin(t);
    const eased = raw > 0 ? raw : raw * 0.4;
    pressRef.current.position.y = -eased * PRESS_TRAVEL;
  });

  return (
    <group {...props}>
      {/* ═══════════════════════════════════════════
          1. FOUNDATION — wide platform base
          ═══════════════════════════════════════════ */}
      <group position={[0, FOUND_Y, 0]}>
        <mesh>
          <boxGeometry args={[BODY_W + 0.06, FOUND_H, BODY_D + 0.04]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
        <mesh position={[0, -FOUND_H / 2 + 0.005, 0]}>
          <boxGeometry args={[BODY_W + 0.08, 0.01, BODY_D + 0.06]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>

        {([[-1, -1], [-1, 1], [1, -1], [1, 1]] as const).map(([sx, sz], i) => (
          <group key={i} position={[sx * 0.21, 0, sz * 0.19]}>
            <MechLeg direction={Math.atan2(sx, sz)} size="md" />
          </group>
        ))}
      </group>

      {/* ═══════════════════════════════════════════
          2. MAIN HOUSING — chunky rectangular body
          ═══════════════════════════════════════════ */}
      <group position={[0, BODY_Y, 0]}>
        {/* Body shell */}
        <mesh>
          <boxGeometry args={[BODY_W, BODY_H, BODY_D]} />
          <meshStandardMaterial color={B.bright} {...M} />
        </mesh>

        {/* Bottom structural band */}
        <mesh position={[0, -BODY_H / 2 + 0.015, 0]}>
          <boxGeometry args={[BODY_W + 0.016, 0.028, BODY_D + 0.016]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>

        {/* Top structural band */}
        <mesh position={[0, BODY_H / 2 - 0.015, 0]}>
          <boxGeometry args={[BODY_W + 0.016, 0.028, BODY_D + 0.016]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>

        {/* Horizontal seam */}
        <mesh position={[0, -0.01, 0]}>
          <boxGeometry args={[BODY_W + 0.005, 0.007, BODY_D + 0.005]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>

        {/* Side panels — decorative raised plates on +-X */}
        {[-1, 1].map((side) => (
          <mesh key={`sidepanel-${side}`} position={[side * (BODY_W / 2 + 0.004), 0.02, -0.03]}>
            <boxGeometry args={[0.008, BODY_H * 0.5, BODY_D * 0.45]} />
            <meshStandardMaterial color={B.light} {...M} roughness={0.5} />
          </mesh>
        ))}

        {/* Back vertical panel seams (-Z face) */}
        {[-1, 1].map((pos) => (
          <mesh key={`backseam-${pos}`} position={[pos * 0.10, 0, -BODY_D / 2 - 0.004]}>
            <boxGeometry args={[0.008, BODY_H * 0.75, 0.008]} />
            <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
          </mesh>
        ))}
      </group>

      {/* ═══════════════════════════════════════════
          3. FRONT CAVITY — open window showing press (+Z)
          The Constructor's signature: you see inside.
          ═══════════════════════════════════════════ */}
      <group position={[0, BODY_Y, BODY_D / 2]}>
        {/* Cavity frame — 4 thick dark bars forming the window */}
        {/* Top bar */}
        <mesh position={[0, BODY_H * 0.30, 0.006]}>
          <boxGeometry args={[0.26, 0.03, 0.016]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.7} />
        </mesh>
        {/* Bottom bar */}
        <mesh position={[0, -BODY_H * 0.30, 0.006]}>
          <boxGeometry args={[0.26, 0.03, 0.016]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.7} />
        </mesh>
        {/* Left pillar */}
        <mesh position={[-0.125, 0, 0.006]}>
          <boxGeometry args={[0.03, BODY_H * 0.66, 0.016]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.7} />
        </mesh>
        {/* Right pillar */}
        <mesh position={[0.125, 0, 0.006]}>
          <boxGeometry args={[0.03, BODY_H * 0.66, 0.016]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.7} />
        </mesh>

        {/* Internal cavity — dark recessed interior */}
        <mesh position={[0, 0, -0.025]}>
          <boxGeometry args={[0.20, BODY_H * 0.54, 0.04]} />
          <meshStandardMaterial color="#1a1a2a" roughness={0.9} metalness={0} />
        </mesh>

        {/* Work surface / anvil platform inside cavity */}
        <mesh position={[0, -BODY_H * 0.20, 0.002]}>
          <boxGeometry args={[0.18, 0.02, 0.05]} />
          <meshStandardMaterial color={B.light} {...M} roughness={0.5} />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════════
          4. PRESS ARM — animated stamping mechanism
          The animated part the user liked!
          ═══════════════════════════════════════════ */}
      <group ref={pressRef}>
        {/* Press piston column */}
        <mesh position={[0, BODY_Y + BODY_H * 0.10, BODY_D / 2 - 0.02]}>
          <boxGeometry args={[0.05, BODY_H * 0.28, 0.03]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
        </mesh>
        {/* Press head — the stamp die, teal accent */}
        <mesh position={[0, BODY_Y - BODY_H * 0.06, BODY_D / 2 - 0.02]}>
          <boxGeometry args={[0.14, 0.035, 0.04]} />
          <meshStandardMaterial color={COLORS.processor} {...M} roughness={0.45} />
        </mesh>
        {/* Stamp face detail */}
        <mesh position={[0, BODY_Y - BODY_H * 0.08, BODY_D / 2 - 0.02]}>
          <boxGeometry args={[0.11, 0.008, 0.042]} />
          <meshStandardMaterial color={COLORS.processorDark} {...M} roughness={0.5} />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════════
          5. INPUT PORT — components in (+X side)
          ═══════════════════════════════════════════ */}
      <group position={[BODY_W / 2 + 0.008, BODY_Y - 0.03, 0]}>
        <mesh>
          <boxGeometry args={[0.02, 0.12, 0.14]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>
        <mesh position={[0.007, 0, 0]}>
          <boxGeometry args={[0.012, 0.08, 0.10]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
        {/* Input indicator — teal */}
        <mesh position={[0.014, 0.065, 0]}>
          <boxGeometry args={[0.008, 0.012, 0.14]} />
          <meshStandardMaterial color={COLORS.processor} {...M} roughness={0.45} />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════════
          6. OUTPUT PORT — products out (-X side)
          ═══════════════════════════════════════════ */}
      <group position={[-BODY_W / 2 - 0.008, BODY_Y - 0.03, 0]}>
        <mesh>
          <boxGeometry args={[0.02, 0.12, 0.14]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>
        <mesh position={[-0.007, 0, 0]}>
          <boxGeometry args={[0.012, 0.08, 0.10]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
        {/* Output indicator — accent orange */}
        <mesh position={[-0.014, 0.065, 0]}>
          <boxGeometry args={[0.008, 0.012, 0.14]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.5} />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════════
          7. TOP HEADER — raised upper section
          Houses upper press mechanism, gives height.
          ═══════════════════════════════════════════ */}
      <group position={[0, BODY_TOP, 0]}>
        {/* Header block */}
        <mesh position={[0, HEADER_H / 2, 0]}>
          <boxGeometry args={[HEADER_W, HEADER_H, HEADER_D]} />
          <meshStandardMaterial color={B.bright} {...M} />
        </mesh>
        {/* Header cap plate */}
        <mesh position={[0, HEADER_H + 0.004, 0]}>
          <boxGeometry args={[HEADER_W + 0.01, 0.008, HEADER_D + 0.01]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
        {/* Header mid-band */}
        <mesh position={[0, HEADER_H * 0.5, 0]}>
          <boxGeometry args={[HEADER_W + 0.005, 0.008, HEADER_D + 0.005]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>

        {/* External pipe runs along body sides — industrial cabling */}
        {[-1, 1].map((side) => (
          <group key={`pipes-${side}`}>
            {/* Vertical pipe connecting header to body */}
            <mesh position={[side * (BODY_W * 0.42), HEADER_H * 0.2, 0]}>
              <cylinderGeometry args={[0.012, 0.012, HEADER_H * 1.2, 6]} />
              <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
            </mesh>
            {/* Pipe bracket */}
            <mesh position={[side * (BODY_W * 0.42), 0, 0]}>
              <boxGeometry args={[0.03, 0.015, 0.03]} />
              <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
            </mesh>
          </group>
        ))}

        {/* Vent grilles on top */}
        {[-1, 1].map((pos) => (
          <mesh key={`vent-${pos}`} position={[pos * 0.08, HEADER_H + 0.01, 0]}>
            <boxGeometry args={[0.04, 0.005, 0.06]} />
            <meshStandardMaterial color={B.light} {...M} roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* ═══════════════════════════════════════════
          8. EXTERNAL DETAILS
          ═══════════════════════════════════════════ */}
      {/* Horizontal pipe run on back */}
      <mesh position={[0, BODY_Y + BODY_H * 0.15, -BODY_D / 2 - 0.012]}>
        <boxGeometry args={[BODY_W * 0.6, 0.016, 0.016]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
      </mesh>

      {/* Status indicator — back panel */}
      <group position={[-0.08, BODY_Y + BODY_H * 0.25, -BODY_D / 2 - 0.006]}>
        <mesh>
          <boxGeometry args={[0.05, 0.03, 0.008]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, -0.005]}>
          <boxGeometry args={[0.035, 0.018, 0.004]} />
          <meshStandardMaterial color={COLORS.processorDark} {...M} roughness={0.45} />
        </mesh>
      </group>
    </group>
  );
}
