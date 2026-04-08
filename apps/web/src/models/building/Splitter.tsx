import type { ModelProps } from "../colors";
import { PortDock, type PortHighlight } from "../belt/PortDock";
import { SPLITTER_PORTS } from "../belt/ports";
import type { StatusPoleStatus } from "../StatusPole";
import { B, M } from "./palette";

/**
 * Splitter — "The Distributor"
 *
 * Compact logistics junction: 1 input (west) fans out to 3 outputs
 * (east, north, south). Round-robin distribution, skips blocked,
 * stalls only if all outputs are blocked.
 *
 * FORM: wide squat box-octagon that fills most of the 1×1 tile.
 * Wide enough that the belt-width port docks integrate naturally
 * into the building faces. Structural silver palette = "belt infra."
 *
 * MOTIF: raised orange chevron on top pointing west → east.
 */

/* ── Dimensions ── */
const SIDES = 8;

const BASE_H = 0.04;
const BASE_R_TOP = 0.46;
const BASE_R_BOT = 0.48;

const BODY_H = 0.30;
const BODY_R = 0.44;
const BODY_Y = BASE_H + BODY_H / 2;

const SEAM_Y = BODY_Y;

const CAP_H = 0.08;
const CAP_R_BOT = 0.40;
const CAP_R_TOP = 0.36;
const CAP_Y = BASE_H + BODY_H + CAP_H / 2;

const TOTAL_H = BASE_H + BODY_H + CAP_H; // ~0.42

/* ── Chevron arrow ── */
const ARROW_Y = TOTAL_H + 0.003;

/* ── Status dot ── */
const DOT_R = 0.025;
const DOT_Y = TOTAL_H + 0.006;

type SplitterProps = ModelProps & {
  status?: StatusPoleStatus;
  portHighlight?: PortHighlight;
};

export function Splitter({
  status = "green",
  portHighlight = "normal",
  ...props
}: SplitterProps) {
  const allPorts = [...SPLITTER_PORTS.inputs, ...SPLITTER_PORTS.outputs];

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
          2. BODY HUB — wide octagonal drum
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

      {/* Decorative bolts on the 4 diagonal faces */}
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
          3. TOP CAP
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
          4. ARROW MOTIF — chevron pointing east
          ═══════════════════════════════════════════ */}
      <group position={[0, ARROW_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh position={[0.05, 0.06, 0]} rotation={[0, 0, -0.6]}>
          <boxGeometry args={[0.18, 0.03, 0.008]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.45} />
        </mesh>
        <mesh position={[0.05, -0.06, 0]} rotation={[0, 0, 0.6]}>
          <boxGeometry args={[0.18, 0.03, 0.008]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.45} />
        </mesh>
        <mesh position={[-0.08, 0, 0]}>
          <boxGeometry args={[0.1, 0.03, 0.008]} />
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
