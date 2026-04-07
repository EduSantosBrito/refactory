import { useRef, useMemo } from "react";
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

// ── Base proportions (groundDistance = 0.42) ──
const BASE_GROUND = 0.42;
const BASE_ELBOW_Y = -0.16;
const ELBOW_X = 0.24;
const FOOT_X = 0.34;
const BEAM_GAP = 0.035;

function computeArms(groundDist: number) {
  const yFactor = groundDist / BASE_GROUND;
  const elbowY = BASE_ELBOW_Y * yFactor;
  const footY = -groundDist;

  const upperLen = Math.sqrt(ELBOW_X * ELBOW_X + elbowY * elbowY);
  const upperAngle = Math.atan2(elbowY, ELBOW_X);

  const lowerDx = FOOT_X - ELBOW_X;
  const lowerDy = footY - elbowY;
  const lowerLen = Math.sqrt(lowerDx * lowerDx + lowerDy * lowerDy);
  const lowerAngle = Math.atan2(lowerDy, lowerDx);

  return { elbowY, footY, upperLen, upperAngle, lowerLen, lowerAngle };
}

type MinerLegProps = {
  /** Angle in radians around Y — which direction the leg faces outward */
  direction: number;
  registry: AtomRegistry.AtomRegistry;
  /** Distance from shoulder to ground. Default 0.42. */
  groundDistance?: number;
};

export function MinerLeg({ direction, registry, groundDistance = BASE_GROUND }: MinerLegProps) {
  const upperArmRef = useRef<Group>(null);
  const elbowRef = useRef<Group>(null);
  const lowerArmRef = useRef<Group>(null);
  const footRef = useRef<Group>(null);

  const arms = useMemo(() => computeArms(groundDistance), [groundDistance]);

  useFrame(({ clock }) => {
    const { drop } = syncMinerMotion(registry, clock.elapsedTime);

    // IK target: foot stays at ground level, so in local space it rises by drop
    const fx = FOOT_X;
    const fy = arms.footY + drop;
    const d = Math.sqrt(fx * fx + fy * fy);

    const baseAngle = Math.atan2(fy, fx);
    const cosA = Math.min(1, Math.max(-1,
      (arms.upperLen * arms.upperLen + d * d - arms.lowerLen * arms.lowerLen) / (2 * arms.upperLen * d),
    ));
    const A = Math.acos(cosA);

    const upperAngle = baseAngle + A;
    const ex = arms.upperLen * Math.cos(upperAngle);
    const ey = arms.upperLen * Math.sin(upperAngle);
    const lowerAngle = Math.atan2(fy - ey, fx - ex);

    if (upperArmRef.current) upperArmRef.current.rotation.z = upperAngle;
    if (elbowRef.current) elbowRef.current.position.set(ex, ey, 0);
    if (lowerArmRef.current) {
      lowerArmRef.current.position.set(ex, ey, 0);
      lowerArmRef.current.rotation.z = lowerAngle;
    }
    if (footRef.current) footRef.current.position.set(fx, fy, 0);
  });

  const { elbowY, footY, upperLen, lowerLen, upperAngle, lowerAngle } = arms;

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
      <group ref={upperArmRef} rotation={[0, 0, upperAngle]}>
        <mesh position={[upperLen / 2, 0, BEAM_GAP]}>
          <boxGeometry args={[upperLen, 0.04, 0.025]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
        <mesh position={[upperLen / 2, 0, -BEAM_GAP]}>
          <boxGeometry args={[upperLen, 0.04, 0.025]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
        <mesh position={[0.06, 0, 0]}>
          <boxGeometry args={[0.03, 0.028, BEAM_GAP * 2 - 0.002]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
        </mesh>
        <mesh position={[upperLen - 0.05, 0, 0]}>
          <boxGeometry args={[0.03, 0.028, BEAM_GAP * 2 - 0.002]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
        </mesh>
        <mesh
          position={[upperLen * 0.45, 0.015, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.012, 0.015, upperLen * 0.55, 6]} />
          <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.45} />
        </mesh>
        <mesh
          position={[upperLen * 0.7, 0.015, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.007, 0.007, upperLen * 0.3, 6]} />
          <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.35} />
        </mesh>
        <mesh position={[upperLen * 0.3, -0.03, BEAM_GAP]}>
          <boxGeometry args={[0.025, 0.012, 0.028]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
        <mesh position={[upperLen * 0.3, -0.03, -BEAM_GAP]}>
          <boxGeometry args={[0.025, 0.012, 0.028]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
      </group>

      {/* ── Elbow joint ────────────────────────── */}
      <group ref={elbowRef} position={[ELBOW_X, elbowY, 0]}>
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
        position={[ELBOW_X, elbowY, 0]}
        rotation={[0, 0, lowerAngle]}
      >
        <mesh position={[lowerLen / 2, 0, BEAM_GAP]}>
          <boxGeometry args={[lowerLen, 0.035, 0.022]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
        <mesh position={[lowerLen / 2, 0, -BEAM_GAP]}>
          <boxGeometry args={[lowerLen, 0.035, 0.022]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
        <mesh position={[lowerLen * 0.5, 0, 0]}>
          <boxGeometry args={[0.025, 0.024, BEAM_GAP * 2 - 0.002]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
        </mesh>
        <mesh
          position={[lowerLen * 0.4, 0.013, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.01, 0.013, lowerLen * 0.5, 6]} />
          <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.45} />
        </mesh>
        <mesh position={[lowerLen * 0.8, -0.026, 0]}>
          <boxGeometry args={[0.035, 0.012, BEAM_GAP * 2 - 0.002]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
      </group>

      {/* ── Foot assembly ──────────────────────── */}
      <group ref={footRef} position={[FOOT_X, footY, 0]}>
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
