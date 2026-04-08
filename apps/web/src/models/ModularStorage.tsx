import { MAT, type ModelProps } from "./colors";
import { StatusPole } from "./StatusPole";
import type { StatusPoleStatus } from "./StatusPole";
import { Antenna } from "./Antenna";

// Dark industrial palette
const HULL_DARK = "#2d3550";
const HULL_MID = "#4a4f5a";
const HULL_LIGHT = "#8a8e95";
const HULL_BRIGHT = "#b0b4ba";
const ACCENT = "#e8945a";
const WINDOW_COLOR = "#1a1e2a";

const PORT_COUNT = 4;

// Hex body circumradius — face width equals this value, must be ≥ belt tile width (1.0)
const HEX_BOTTOM_R = 1.05;
const HEX_TOP_R = 0.95;
const HEX_APOTHEM = HEX_BOTTOM_R * Math.cos(Math.PI / 6);

// Dock dimensions matching BELT_TILE (1×1×0.4)
const DOCK_WIDTH = 1.0;
const DOCK_DEPTH = 0.4;
const DOCK_HEIGHT = 0.5;
const DOCK_RADIUS = HEX_APOTHEM + DOCK_DEPTH / 2 - 0.06;

type ModularStorageProps = ModelProps & {
  status?: StatusPoleStatus;
  statusPoleX?: number;
  statusPoleY?: number;
  statusPoleZ?: number;
};

export function ModularStorage({
  status = "red",
  statusPoleX = 0.42,
  statusPoleY = 1.46,
  statusPoleZ = 0.3,
  ...props
}: ModularStorageProps) {

  return (
    <group {...props}>
      {/* ── Base platform (wide circle) ──────────── */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[1.4, 1.5, 0.06, 24]} />
        <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.6} />
      </mesh>
      {/* Orange accent ring at base */}
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[1.37, 1.42, 0.025, 24]} />
        <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
      </mesh>

      {/* ── Main hexagonal body ─────────────────── */}
      <mesh position={[0, 0.58, 0]}>
        <cylinderGeometry args={[HEX_TOP_R, HEX_BOTTOM_R, 0.92, 6]} />
        <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.55} />
      </mesh>
      {/* Orange stripe around lower body */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[1.06, 1.07, 0.06, 6]} />
        <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
      </mesh>

      {/* ── Stepped roof tiers ──────────────────── */}
      {/* Tier 1 — light ledge */}
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.87, 0.95, 0.08, 6]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.6} />
      </mesh>
      {/* Tier 2 — dark band */}
      <mesh position={[0, 1.19, 0]}>
        <cylinderGeometry args={[0.78, 0.87, 0.12, 6]} />
        <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.65} />
      </mesh>
      {/* Tier 3 — mid */}
      <mesh position={[0, 1.28, 0]}>
        <cylinderGeometry args={[0.7, 0.78, 0.08, 6]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.6} />
      </mesh>
      {/* Top cap */}
      <mesh position={[0, 1.36, 0]}>
        <cylinderGeometry args={[0.58, 0.7, 0.08, 6]} />
        <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.55} />
      </mesh>

      {/* ── Antenna ───────────────────────────── */}
      <Antenna position={[0, 1.36, 0]} />

      {/* ── StatusPole on rooftop edge ──────────── */}
      <StatusPole
        position={[statusPoleX, statusPoleY, statusPoleZ]}
        scale={0.4}
        status={status}
      />

      {/* ── 4 input ports, one per cardinal side ─────────────── */}
      {Array.from({ length: PORT_COUNT }, (_, i) => {
        const angle = (i / PORT_COUNT) * Math.PI * 2;
        const x = Math.sin(angle) * DOCK_RADIUS;
        const z = Math.cos(angle) * DOCK_RADIUS;
        return (
          <group key={i} position={[x, 0.3, z]} rotation={[0, angle - Math.PI / 2, 0]}>
            {/* Dock body */}
            <mesh>
              <boxGeometry args={[DOCK_DEPTH, DOCK_HEIGHT, DOCK_WIDTH]} />
              <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.55} />
            </mesh>
            {/* Roof cap */}
            <mesh position={[0, DOCK_HEIGHT / 2 + 0.01, 0]}>
              <boxGeometry args={[DOCK_DEPTH + 0.04, 0.02, DOCK_WIDTH + 0.04]} />
              <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.6} />
            </mesh>
            {/* Orange accent stripe */}
            <mesh position={[0, 0.08, 0]}>
              <boxGeometry args={[DOCK_DEPTH + 0.01, 0.06, DOCK_WIDTH + 0.01]} />
              <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
            </mesh>
            {/* Door / window opening (outward face) */}
            <mesh position={[DOCK_DEPTH / 2 + 0.005, -0.03, 0]}>
              <boxGeometry args={[0.01, 0.3, 0.82]} />
              <meshStandardMaterial color={WINDOW_COLOR} {...MAT} roughness={0.8} />
            </mesh>
            {/* Door frame top */}
            <mesh position={[DOCK_DEPTH / 2 + 0.005, 0.13, 0]}>
              <boxGeometry args={[0.015, 0.025, 0.86]} />
              <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.6} />
            </mesh>
            {/* Door frame sides */}
            <mesh position={[DOCK_DEPTH / 2 + 0.005, -0.03, 0.42]}>
              <boxGeometry args={[0.015, 0.3, 0.025]} />
              <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.6} />
            </mesh>
            <mesh position={[DOCK_DEPTH / 2 + 0.005, -0.03, -0.42]}>
              <boxGeometry args={[0.015, 0.3, 0.025]} />
              <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
