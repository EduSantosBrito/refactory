import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { AtomRegistry } from "effect/unstable/reactivity";
import type { Group } from "three";
import { MAT } from "./colors";
import { syncMinerMotion } from "./Miner.state";

// Dark industrial palette
const HULL_DARK = "#2d3550";
const HULL_MID = "#4a4f5a";
const HULL_LIGHT = "#8a8e95";
const HULL_BRIGHT = "#b0b4ba";
const ACCENT = "#e8945a";

// ── Leg geometry ──
const ELBOW_X = 0.24;
const ELBOW_Y = -0.16;
const FOOT_X = 0.34;
const FOOT_Y = -0.42;

const UPPER_LEN = Math.sqrt(ELBOW_X * ELBOW_X + ELBOW_Y * ELBOW_Y);
const UPPER_ANGLE = Math.atan2(ELBOW_Y, ELBOW_X);

const LOWER_DX = FOOT_X - ELBOW_X;
const LOWER_DY = FOOT_Y - ELBOW_Y;
const LOWER_LEN = Math.sqrt(LOWER_DX * LOWER_DX + LOWER_DY * LOWER_DY);
const LOWER_ANGLE = Math.atan2(LOWER_DY, LOWER_DX);

const BEAM_GAP = 0.035;

type MinerLegProps = {
  /** Angle in radians around Y — which direction the leg faces outward */
  direction: number;
  registry: AtomRegistry.AtomRegistry;
};

export function MinerLeg({ direction, registry }: MinerLegProps) {
  const upperArmRef = useRef<Group>(null);
  const elbowRef = useRef<Group>(null);
  const lowerArmRef = useRef<Group>(null);
  const footRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    const { drop } = syncMinerMotion(registry, clock.elapsedTime);

    // IK target: foot stays at ground level, so in local space it rises by drop
    const fx = FOOT_X;
    const fy = FOOT_Y + drop;
    const d = Math.sqrt(fx * fx + fy * fy);

    const baseAngle = Math.atan2(fy, fx);
    const cosA = Math.min(1, Math.max(-1,
      (UPPER_LEN * UPPER_LEN + d * d - LOWER_LEN * LOWER_LEN) / (2 * UPPER_LEN * d),
    ));
    const A = Math.acos(cosA);

    const upperAngle = baseAngle + A;
    const ex = UPPER_LEN * Math.cos(upperAngle);
    const ey = UPPER_LEN * Math.sin(upperAngle);
    const lowerAngle = Math.atan2(fy - ey, fx - ex);

    if (upperArmRef.current) upperArmRef.current.rotation.z = upperAngle;
    if (elbowRef.current) elbowRef.current.position.set(ex, ey, 0);
    if (lowerArmRef.current) {
      lowerArmRef.current.position.set(ex, ey, 0);
      lowerArmRef.current.rotation.z = lowerAngle;
    }
    if (footRef.current) footRef.current.position.set(fx, fy, 0);
  });

  return (
    <group rotation={[0, direction - Math.PI / 2, 0]}>
      {/* ── Shoulder mount ─────────────────────── */}
      <mesh>
        <boxGeometry args={[0.08, 0.09, 0.11]} />
        <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.65} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.032, 0.032, 0.13, 8]} />
        <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.038, 0.036, 0.015, 8]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0, -0.07]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.038, 0.036, 0.015, 8]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
      </mesh>
      <mesh position={[0.035, -0.02, 0.05]}>
        <boxGeometry args={[0.02, 0.04, 0.02]} />
        <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
      </mesh>
      <mesh position={[0.035, -0.02, -0.05]}>
        <boxGeometry args={[0.02, 0.04, 0.02]} />
        <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
      </mesh>

      {/* ── Upper arm ──────────────────────────── */}
      <group ref={upperArmRef} rotation={[0, 0, UPPER_ANGLE]}>
        <mesh position={[UPPER_LEN / 2, 0, BEAM_GAP]}>
          <boxGeometry args={[UPPER_LEN, 0.04, 0.025]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
        <mesh position={[UPPER_LEN / 2, 0, -BEAM_GAP]}>
          <boxGeometry args={[UPPER_LEN, 0.04, 0.025]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
        <mesh position={[0.06, 0, 0]}>
          <boxGeometry args={[0.03, 0.028, BEAM_GAP * 2 - 0.002]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
        </mesh>
        <mesh position={[UPPER_LEN - 0.05, 0, 0]}>
          <boxGeometry args={[0.03, 0.028, BEAM_GAP * 2 - 0.002]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
        </mesh>
        <mesh
          position={[UPPER_LEN * 0.45, 0.015, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.012, 0.015, UPPER_LEN * 0.55, 6]} />
          <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.45} />
        </mesh>
        <mesh
          position={[UPPER_LEN * 0.7, 0.015, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.007, 0.007, UPPER_LEN * 0.3, 6]} />
          <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.35} />
        </mesh>
        <mesh position={[UPPER_LEN * 0.3, -0.03, BEAM_GAP]}>
          <boxGeometry args={[0.025, 0.012, 0.028]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
        <mesh position={[UPPER_LEN * 0.3, -0.03, -BEAM_GAP]}>
          <boxGeometry args={[0.025, 0.012, 0.028]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
      </group>

      {/* ── Elbow joint ────────────────────────── */}
      <group ref={elbowRef} position={[ELBOW_X, ELBOW_Y, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.09, 8]} />
          <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.042, 0.015, 8]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.042, 0.015, 8]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.047, 0.047, 0.022, 8]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.55} />
        </mesh>
      </group>

      {/* ── Lower arm ──────────────────────────── */}
      <group
        ref={lowerArmRef}
        position={[ELBOW_X, ELBOW_Y, 0]}
        rotation={[0, 0, LOWER_ANGLE]}
      >
        <mesh position={[LOWER_LEN / 2, 0, BEAM_GAP]}>
          <boxGeometry args={[LOWER_LEN, 0.035, 0.022]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
        <mesh position={[LOWER_LEN / 2, 0, -BEAM_GAP]}>
          <boxGeometry args={[LOWER_LEN, 0.035, 0.022]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
        <mesh position={[LOWER_LEN * 0.5, 0, 0]}>
          <boxGeometry args={[0.025, 0.024, BEAM_GAP * 2 - 0.002]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
        </mesh>
        <mesh
          position={[LOWER_LEN * 0.4, 0.013, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.01, 0.013, LOWER_LEN * 0.5, 6]} />
          <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.45} />
        </mesh>
        <mesh position={[LOWER_LEN * 0.8, -0.026, 0]}>
          <boxGeometry args={[0.035, 0.012, BEAM_GAP * 2 - 0.002]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
      </group>

      {/* ── Foot assembly ──────────────────────── */}
      <group ref={footRef} position={[FOOT_X, FOOT_Y, 0]}>
        <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.065, 8]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
        </mesh>
        <mesh position={[0.015, 0, 0]}>
          <boxGeometry args={[0.13, 0.06, 0.12]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.65} />
        </mesh>
        <mesh position={[0.015, -0.035, 0]}>
          <boxGeometry args={[0.14, 0.015, 0.13]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.6} />
        </mesh>
        <mesh position={[0.015, 0.03, 0]}>
          <boxGeometry args={[0.12, 0.012, 0.11]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
        </mesh>
        <mesh position={[0.07, 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.048, 0.048, 0.1, 10]} />
          <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.35} />
        </mesh>
        <mesh position={[0.07, 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.108, 10]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
        </mesh>
        <mesh position={[0.07, 0.005, 0.055]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.052, 0.015, 10]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.55} />
        </mesh>
        <mesh position={[0.07, 0.005, -0.055]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.052, 0.015, 10]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.55} />
        </mesh>
        <mesh position={[0.07, 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.14, 6]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.55} />
        </mesh>
        <mesh position={[-0.02, 0.005, 0.065]}>
          <boxGeometry args={[0.04, 0.035, 0.018]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
        <mesh position={[-0.02, 0.005, -0.065]}>
          <boxGeometry args={[0.04, 0.035, 0.018]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}
