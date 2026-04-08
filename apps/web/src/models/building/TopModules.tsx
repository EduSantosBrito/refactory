import { B, M } from "./palette";

/* ── Power Unit ─────────────────────────────────────────── */

export function PowerUnit() {
  return (
    <group>
      {/* Base collar — anchors to body top */}
      <mesh position={[0, 0.008, 0]}>
        <cylinderGeometry args={[0.18, 0.2, 0.015, 8]} />
        <meshStandardMaterial color={B.redDark} {...M} roughness={0.6} />
      </mesh>

      {/* Housing — dominant squat drum */}
      <mesh position={[0, 0.058, 0]}>
        <cylinderGeometry args={[0.14, 0.16, 0.08, 8]} />
        <meshStandardMaterial color={B.red} {...M} roughness={0.5} />
      </mesh>

      {/* Housing cap */}
      <mesh position={[0, 0.102, 0]}>
        <cylinderGeometry args={[0.13, 0.14, 0.012, 8]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
      </mesh>

      {/* Chimney — centered */}
      <mesh position={[0, 0.165, 0]}>
        <cylinderGeometry args={[0.04, 0.048, 0.115, 8]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
      </mesh>

      {/* Chimney lip */}
      <mesh position={[0, 0.228, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.04, 0.009, 6, 8]} />
        <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
      </mesh>
    </group>
  );
}

/* ── Antenna Module ─────────────────────────────────────── */

export function AntennaModule() {
  return (
    <group>
      {/* Base pedestal */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.04, 8]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
      </mesh>

      {/* Mast */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.015, 0.022, 0.16, 6]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.55} />
      </mesh>

      {/* Dish — dominant form */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.12, 0.045, 0.04, 8]} />
        <meshStandardMaterial color={B.bright} {...M} roughness={0.5} />
      </mesh>

      {/* Dish rim */}
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.125, 0.125, 0.008, 8]} />
        <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
      </mesh>
    </group>
  );
}

/* ── Chimney Stack — dual asymmetric stacks ─────────────── */

export function ChimneyStack() {
  return (
    <group>
      {/* Base collar */}
      <mesh position={[0, 0.008, 0]}>
        <cylinderGeometry args={[0.18, 0.2, 0.015, 8]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
      </mesh>

      {/* Main chimney — tall, dominant */}
      <mesh position={[-0.04, 0.11, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.19, 8]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
      </mesh>

      {/* Main chimney lip */}
      <mesh position={[-0.04, 0.21, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.05, 0.01, 6, 8]} />
        <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
      </mesh>

      {/* Secondary chimney — shorter, wider */}
      <mesh position={[0.06, 0.075, 0]}>
        <cylinderGeometry args={[0.04, 0.048, 0.12, 8]} />
        <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
      </mesh>

      {/* Secondary chimney cap */}
      <mesh position={[0.06, 0.14, 0]}>
        <cylinderGeometry args={[0.048, 0.045, 0.012, 8]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
      </mesh>
    </group>
  );
}

/* ── Turbine Plate — wide fan disc with housing ─────────── */

export function TurbinePlate() {
  return (
    <group>
      {/* Base collar */}
      <mesh position={[0, 0.008, 0]}>
        <cylinderGeometry args={[0.18, 0.2, 0.015, 8]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
      </mesh>

      {/* Housing drum */}
      <mesh position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.06, 8]} />
        <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
      </mesh>

      {/* Fan disc — wide and thin, dominant form */}
      <mesh position={[0, 0.085, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.015, 8]} />
        <meshStandardMaterial color={B.bright} {...M} roughness={0.5} />
      </mesh>

      {/* Center hub */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.04, 8]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.55} />
      </mesh>

      {/* Guard rim */}
      <mesh position={[0, 0.085, 0]}>
        <cylinderGeometry args={[0.21, 0.205, 0.02, 8]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
      </mesh>
    </group>
  );
}

/* ── Drill Head — conical drill bit with chuck ──────────── */

export function DrillHead() {
  return (
    <group>
      {/* Base collar */}
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.15, 0.18, 0.02, 8]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
      </mesh>

      {/* Chuck housing */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.06, 8]} />
        <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
      </mesh>

      {/* Drill collar — transition ring */}
      <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.1, 0.012, 6, 8]} />
        <meshStandardMaterial color={B.bright} {...M} roughness={0.5} />
      </mesh>

      {/* Drill shaft — tapered cone, dominant form */}
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.015, 0.08, 0.17, 8]} />
        <meshStandardMaterial color={B.red} {...M} roughness={0.5} />
      </mesh>

      {/* Drill tip */}
      <mesh position={[0, 0.27, 0]}>
        <coneGeometry args={[0.015, 0.03, 6]} />
        <meshStandardMaterial color={B.redDark} {...M} roughness={0.5} />
      </mesh>
    </group>
  );
}

/* ── Tank Cluster — grouped cylindrical tanks ───────────── */

export function TankCluster() {
  return (
    <group>
      {/* Base plate */}
      <mesh position={[0, 0.006, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.012, 8]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
      </mesh>

      {/* Center tank — tallest */}
      <mesh position={[0, 0.085, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.15, 8]} />
        <meshStandardMaterial color={B.red} {...M} roughness={0.5} />
      </mesh>

      {/* Left tank */}
      <mesh position={[-0.09, 0.065, 0.02]}>
        <cylinderGeometry args={[0.045, 0.045, 0.11, 8]} />
        <meshStandardMaterial color={B.redDark} {...M} roughness={0.5} />
      </mesh>

      {/* Right tank */}
      <mesh position={[0.09, 0.065, 0.02]}>
        <cylinderGeometry args={[0.045, 0.045, 0.11, 8]} />
        <meshStandardMaterial color={B.red} {...M} roughness={0.5} />
      </mesh>

      {/* Connecting bracket */}
      <mesh position={[0, 0.025, 0.02]}>
        <boxGeometry args={[0.2, 0.02, 0.03]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
      </mesh>
    </group>
  );
}

/* ── Heat Sink Array — vertical fin plates ──────────────── */

export function HeatSinkArray() {
  return (
    <group>
      {/* Base plate */}
      <mesh position={[0, 0.006, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.012, 8]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
      </mesh>

      {/* 3× Vertical fins */}
      {[-0.035, 0, 0.035].map((z) => (
        <mesh key={`fin-${z.toFixed(3)}`} position={[0, 0.075, z]}>
          <boxGeometry args={[0.18, 0.12, 0.01]} />
          <meshStandardMaterial color={B.bright} {...M} roughness={0.5} />
        </mesh>
      ))}

      {/* Top rail */}
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[0.2, 0.015, 0.1]} />
        <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
      </mesh>
    </group>
  );
}

/* ── Sorting Frame — open frame with roller ─────────────── */

export function SortingFrame() {
  return (
    <group>
      {/* Base plate */}
      <mesh position={[0, 0.006, 0]}>
        <cylinderGeometry args={[0.18, 0.2, 0.012, 8]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
      </mesh>

      {/* Left post */}
      <mesh position={[-0.09, 0.07, 0]}>
        <boxGeometry args={[0.03, 0.12, 0.03]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
      </mesh>

      {/* Right post */}
      <mesh position={[0.09, 0.07, 0]}>
        <boxGeometry args={[0.03, 0.12, 0.03]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
      </mesh>

      {/* Cross beam */}
      <mesh position={[0, 0.135, 0]}>
        <boxGeometry args={[0.22, 0.025, 0.035]} />
        <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
      </mesh>

      {/* Roller */}
      <mesh position={[0, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.16, 8]} />
        <meshStandardMaterial color={B.bright} {...M} roughness={0.45} />
      </mesh>
    </group>
  );
}
