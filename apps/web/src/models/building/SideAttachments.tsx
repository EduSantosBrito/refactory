import { B, M } from "./palette";

/* ── Side Tank ──────────────────────────────────────────── */

/** Cylindrical utility tank mounted on a building face */
export function SideTank() {
  return (
    <group>
      {/* Mounting bracket */}
      <mesh position={[0, 0, 0.012]}>
        <boxGeometry args={[0.065, 0.04, 0.02]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
      </mesh>

      {/* Tank body */}
      <mesh position={[0, 0, 0.045]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.09, 8]} />
        <meshStandardMaterial color={B.red} {...M} roughness={0.5} />
      </mesh>
    </group>
  );
}

/* ── Side Vent ──────────────────────────────────────────── */

/** Ventilation grille mounted on a building face */
export function SideVent() {
  return (
    <group>
      {/* Vent frame */}
      <mesh position={[0, 0, 0.005]}>
        <boxGeometry args={[0.07, 0.05, 0.012]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.7} />
      </mesh>

      {/* 2× Horizontal slats */}
      {[-1, 1].map((row) => (
        <mesh key={`sl-${row}`} position={[0, row * 0.012, 0.012]}>
          <boxGeometry args={[0.055, 0.006, 0.005]} />
          <meshStandardMaterial color={B.light} {...M} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Side Pipe ──────────────────────────────────────────── */

/** Horizontal pipe running along a building face */
export function SidePipe() {
  return (
    <group>
      {/* Mounting bracket */}
      <mesh position={[0, 0, 0.012]}>
        <boxGeometry args={[0.04, 0.04, 0.02]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
      </mesh>

      {/* Pipe — horizontal along face */}
      <mesh position={[0, 0, 0.03]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, 0.1, 8]} />
        <meshStandardMaterial color={B.red} {...M} roughness={0.5} />
      </mesh>
    </group>
  );
}

/* ── Side Panel ─────────────────────────────────────────── */

/** Equipment or cargo panel mounted on a building face */
export function SidePanel() {
  return (
    <group>
      {/* Panel frame */}
      <mesh position={[0, 0, 0.005]}>
        <boxGeometry args={[0.08, 0.06, 0.01]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.7} />
      </mesh>

      {/* Panel face */}
      <mesh position={[0, 0, 0.012]}>
        <boxGeometry args={[0.065, 0.045, 0.006]} />
        <meshStandardMaterial color={B.bright} {...M} roughness={0.5} />
      </mesh>
    </group>
  );
}

/* ── Side Lamp ──────────────────────────────────────────── */

/** Warning indicator lamp mounted on a building face */
export function SideLamp() {
  return (
    <group>
      {/* Mount bracket */}
      <mesh position={[0, 0, 0.008]}>
        <boxGeometry args={[0.025, 0.025, 0.015]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
      </mesh>

      {/* Lamp bulb */}
      <mesh position={[0, 0, 0.022]}>
        <sphereGeometry args={[0.015, 8, 6]} />
        <meshStandardMaterial color={B.warm} {...M} roughness={0.4} />
      </mesh>
    </group>
  );
}
