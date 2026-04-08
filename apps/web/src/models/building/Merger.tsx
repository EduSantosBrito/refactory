import type { ModelProps } from "../colors";
import { PortDock, type PortHighlight } from "../belt/PortDock";
import { MERGER_PORTS } from "../belt/ports";
import type { StatusPoleStatus } from "../StatusPole";
import { B, M } from "./palette";

/**
 * Merger — "The Collector"
 *
 * Compact logistics junction: 3 inputs (west, north, south) converge
 * into 1 output (east). First-come-first-served, output capped by belt
 * speed, all inputs backpressure if output is blocked.
 *
 * Same wide octagonal form as the Splitter but distinguishable by:
 * - Convergent arrow motif (3 lines merging to one point)
 * - Slightly more dished top cap
 * - Inverted dock colors (3 orange inputs vs 1 teal output)
 */

/* ── Dimensions (matches Splitter) ── */
const SIDES = 8;

const BASE_H = 0.04;
const BASE_R_TOP = 0.46;
const BASE_R_BOT = 0.48;

const BODY_H = 0.30;
const BODY_R = 0.44;
const BODY_Y = BASE_H + BODY_H / 2;

const SEAM_Y = BODY_Y;

const CAP_H = 0.08;
const CAP_R_BOT = 0.41;
const CAP_R_TOP = 0.33;
const CAP_Y = BASE_H + BODY_H + CAP_H / 2;

const TOTAL_H = BASE_H + BODY_H + CAP_H;

/* ── Arrow motif ── */
const ARROW_Y = TOTAL_H + 0.003;

/* ── Status dot ── */
const DOT_R = 0.025;
const DOT_Y = TOTAL_H + 0.006;

type MergerProps = ModelProps & {
  status?: StatusPoleStatus;
  portHighlight?: PortHighlight;
};

export function Merger({
  status = "green",
  portHighlight = "normal",
  ...props
}: MergerProps) {
  const allPorts = [...MERGER_PORTS.inputs, ...MERGER_PORTS.outputs];

  return (
    <group {...props}>
      {/* ═══════════════════════════════════════════
          1. BASE PLATE
          ═══════════════════════════════════════════ */}
      <mesh position={[0, BASE_H / 2, 0]}>
        <cylinderGeometry args={[BASE_R_TOP, BASE_R_BOT, BASE_H, SIDES]} />
        <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.005, 0]}>
        <cylinderGeometry
          args={[BASE_R_BOT + 0.02, BASE_R_BOT + 0.03, 0.01, SIDES]}
        />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
      </mesh>

      {/* ═══════════════════════════════════════════
          2. BODY HUB
          ═══════════════════════════════════════════ */}
      <mesh position={[0, BODY_Y, 0]}>
        <cylinderGeometry args={[BODY_R, BODY_R + 0.01, BODY_H, SIDES]} />
        <meshStandardMaterial color={B.bright} {...M} roughness={0.55} />
      </mesh>

      {/* Dark equator seam band */}
      <mesh position={[0, SEAM_Y, 0]}>
        <cylinderGeometry
          args={[BODY_R + 0.008, BODY_R + 0.01, 0.025, SIDES]}
        />
        <meshStandardMaterial
          color={B.dark}
          {...M}
          roughness={0.6}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* Accent stripe below seam */}
      <mesh position={[0, SEAM_Y - 0.022, 0]}>
        <cylinderGeometry
          args={[BODY_R + 0.006, BODY_R + 0.008, 0.012, SIDES]}
        />
        <meshStandardMaterial
          color={B.accent}
          {...M}
          roughness={0.5}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* Decorative bolts on diagonal faces */}
      {[1, 3, 5, 7].map((i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh
            key={`bolt-${i}`}
            position={[
              Math.sin(angle) * (BODY_R + 0.005),
              SEAM_Y + 0.04,
              Math.cos(angle) * (BODY_R + 0.005),
            ]}
          >
            <cylinderGeometry args={[0.014, 0.014, 0.01, 6]} />
            <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
          </mesh>
        );
      })}

      {/* ═══════════════════════════════════════════
          3. TOP CAP — more dished than Splitter
          ═══════════════════════════════════════════ */}
      <mesh position={[0, CAP_Y, 0]}>
        <cylinderGeometry args={[CAP_R_TOP, CAP_R_BOT, CAP_H, SIDES]} />
        <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
      </mesh>
      <mesh position={[0, CAP_Y - CAP_H / 2 + 0.005, 0]}>
        <cylinderGeometry
          args={[CAP_R_BOT + 0.01, CAP_R_BOT + 0.012, 0.008, SIDES]}
        />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
      </mesh>

      {/* ═══════════════════════════════════════════
          4. CONVERGENT ARROW MOTIF — 3 lines merging east
          ═══════════════════════════════════════════ */}
      <group position={[0, ARROW_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {/* Center bar */}
        <mesh position={[-0.02, 0, 0]}>
          <boxGeometry args={[0.2, 0.03, 0.008]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.45} />
        </mesh>
        {/* Upper convergent arm */}
        <mesh position={[0.02, 0.07, 0]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[0.16, 0.03, 0.008]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.45} />
        </mesh>
        {/* Lower convergent arm */}
        <mesh position={[0.02, -0.07, 0]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[0.16, 0.03, 0.008]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.45} />
        </mesh>
        {/* Arrowhead diamond at east */}
        <mesh position={[0.12, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.035, 0.035, 0.008]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.45} />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════════
          5. STATUS DOT
          ═══════════════════════════════════════════ */}
      <mesh position={[0.15, DOT_Y, -0.15]}>
        <cylinderGeometry args={[DOT_R, DOT_R, 0.006, 8]} />
        <meshStandardMaterial
          color={status === "green" ? B.accent : B.mid}
          emissive={status === "green" ? B.accent : B.mid}
          emissiveIntensity={status === "green" ? 0.6 : 0}
          {...M}
          roughness={0.4}
        />
      </mesh>

      {/* ═══════════════════════════════════════════
          6. PORT DOCKS
          ═══════════════════════════════════════════ */}
      {allPorts.map((port) => (
        <PortDock key={port.id} port={port} highlight={portHighlight} />
      ))}
    </group>
  );
}
