import { Antenna } from "./Antenna";
import { MAT, type ModelProps } from "./colors";
import { StatusPole, type StatusPoleStatus } from "./StatusPole";

// Industrial palette (matching MinerFoundation)
const HULL_DARK = "#2d3550";
const HULL_MID = "#4a4f5a";
const HULL_LIGHT = "#8a8e95";
const HULL_BRIGHT = "#b0b4ba";
const ACCENT = "#e8945a";
const WINDOW = "#0d1018";

const SIDES = 8;

type MinerTopProps = ModelProps & {
  status?: StatusPoleStatus;
};

export function MinerTop({ status = "green", ...props }: MinerTopProps) {
  return (
    <group {...props}>
      {/* ── Bottom mounting flange ──────────────────── */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.19, 0.02, SIDES]} />
        <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
      </mesh>

      {/* ── Flared overhang (structural skirt) ──────── */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.34, 0.24, 0.025, SIDES]} />
        <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
      </mesh>

      {/* Overhang bottom lip */}
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.35, 0.34, 0.01, SIDES]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
      </mesh>

      {/* 16× Overhang rim bolts */}
      {Array.from({ length: SIDES * 2 }, (_, i) => {
        const a = (i / (SIDES * 2)) * Math.PI * 2;
        return (
          <mesh
            key={`ob-${a.toFixed(3)}`}
            position={[Math.sin(a) * 0.34, 0.008, Math.cos(a) * 0.34]}
          >
            <cylinderGeometry args={[0.007, 0.007, 0.012, 6]} />
            <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.5} />
          </mesh>
        );
      })}

      {/* ── Orange accent stripe ───────────────────── */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.342, 0.345, 0.016, SIDES]} />
        <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
      </mesh>

      {/* ── Main cabin body ────────────────────────── */}
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.305, 0.335, 0.17, SIDES]} />
        <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.5} />
      </mesh>

      {/* 8× Recessed side panels with door-like frames */}
      {Array.from({ length: SIDES }, (_, i) => {
        const a = (i / SIDES) * Math.PI * 2;
        const r = 0.315;
        const isCardinal = i % 2 === 0;
        const panelW = isCardinal ? 0.12 : 0.09;
        const panelH = isCardinal ? 0.1 : 0.075;
        return (
          <group
            key={`sp-${a.toFixed(3)}`}
            position={[Math.sin(a) * r, 0.14, Math.cos(a) * r]}
            rotation={[0, -a, 0]}
          >
            {/* Dark recessed opening */}
            <mesh>
              <boxGeometry args={[panelW, panelH, 0.022]} />
              <meshStandardMaterial
                color={HULL_DARK}
                {...MAT}
                roughness={0.65}
              />
            </mesh>
            {/* Frame — top edge */}
            <mesh position={[0, panelH / 2 + 0.005, 0.003]}>
              <boxGeometry args={[panelW + 0.025, 0.008, 0.018]} />
              <meshStandardMaterial
                color={HULL_LIGHT}
                {...MAT}
                roughness={0.5}
              />
            </mesh>
            {/* Frame — bottom edge */}
            <mesh position={[0, -(panelH / 2 + 0.005), 0.003]}>
              <boxGeometry args={[panelW + 0.025, 0.008, 0.018]} />
              <meshStandardMaterial
                color={HULL_LIGHT}
                {...MAT}
                roughness={0.5}
              />
            </mesh>
          </group>
        );
      })}

      {/* 8× Orange bracket + conduit details between panels */}
      {Array.from({ length: SIDES }, (_, i) => {
        const a = (i / SIDES) * Math.PI * 2 + Math.PI / SIDES;
        return (
          <group key={`br-${a.toFixed(3)}`}>
            {/* Bracket block */}
            <mesh
              position={[Math.sin(a) * 0.31, 0.11, Math.cos(a) * 0.31]}
              rotation={[0, -a, 0]}
            >
              <boxGeometry args={[0.018, 0.065, 0.018]} />
              <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
            </mesh>
            {/* Conduit pipe */}
            <mesh position={[Math.sin(a) * 0.315, 0.14, Math.cos(a) * 0.315]}>
              <cylinderGeometry args={[0.005, 0.005, 0.11, 5]} />
              <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.45} />
            </mesh>
          </group>
        );
      })}

      {/* 4× Vertical pipe runs on octagon edges */}
      {Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
        return (
          <mesh
            key={`vp-${a.toFixed(3)}`}
            position={[Math.sin(a) * 0.31, 0.14, Math.cos(a) * 0.31]}
          >
            <cylinderGeometry args={[0.007, 0.007, 0.16, 6]} />
            <meshStandardMaterial
              color={HULL_LIGHT}
              {...MAT}
              roughness={0.45}
            />
          </mesh>
        );
      })}

      {/* ── Upper window band ──────────────────────── */}
      {/* Dark tinted viewport section */}
      <mesh position={[0, 0.245, 0]}>
        <cylinderGeometry args={[0.275, 0.3, 0.065, SIDES]} />
        <meshStandardMaterial
          color={WINDOW}
          {...MAT}
          roughness={0.25}
          metalness={0.12}
        />
      </mesh>

      {/* Window bottom frame rim */}
      <mesh position={[0, 0.208, 0]}>
        <cylinderGeometry args={[0.308, 0.305, 0.012, SIDES]} />
        <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.5} />
      </mesh>

      {/* Window top frame rim */}
      <mesh position={[0, 0.282, 0]}>
        <cylinderGeometry args={[0.28, 0.278, 0.012, SIDES]} />
        <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.5} />
      </mesh>

      {/* 4× Window divider bars on cardinal faces */}
      {Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh
            key={`wd-${a.toFixed(3)}`}
            position={[Math.sin(a) * 0.288, 0.245, Math.cos(a) * 0.288]}
            rotation={[0, -a, 0]}
          >
            <boxGeometry args={[0.007, 0.065, 0.018]} />
            <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.5} />
          </mesh>
        );
      })}

      {/* ── Top cap (stepped roof) ─────────────────── */}
      {/* Outer roof plate */}
      <mesh position={[0, 0.296, 0]}>
        <cylinderGeometry args={[0.265, 0.275, 0.022, SIDES]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
      </mesh>

      {/* Inner stepped plate */}
      <mesh position={[0, 0.312, 0]}>
        <cylinderGeometry args={[0.22, 0.24, 0.018, SIDES]} />
        <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
      </mesh>

      {/* Center mounting disc */}
      <mesh position={[0, 0.324, 0]}>
        <cylinderGeometry args={[0.14, 0.16, 0.012, SIDES]} />
        <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.5} />
      </mesh>

      {/* 4× Roof ventilation grooves */}
      {Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
        return (
          <mesh
            key={`rv-${a.toFixed(3)}`}
            position={[Math.sin(a) * 0.19, 0.326, Math.cos(a) * 0.19]}
            rotation={[Math.PI / 2, 0, -a]}
          >
            <boxGeometry args={[0.035, 0.008, 0.008]} />
            <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
          </mesh>
        );
      })}

      {/* ── StatusPole — right side of roof ────────── */}
      <StatusPole position={[0.16, 0.34, 0]} scale={0.25} status={status} />

      {/* ── Antenna — left-rear of roof ────────────── */}
      <Antenna position={[-0.06, 0.32, -0.06]} scale={0.24} speed={0.4} />
    </group>
  );
}
