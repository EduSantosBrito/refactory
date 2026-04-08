import { MAT } from "./colors";

// Dark industrial palette
const HULL_DARK = "#2d3550";
const HULL_MID = "#4a4f5a";
const HULL_LIGHT = "#8a8e95";
const HULL_BRIGHT = "#b0b4ba";
const ACCENT = "#e8945a";

type MechLegSize = "sm" | "md";
type MechLegVariant = "square" | "rounded";

type MechLegProps = {
  /** Angle in radians around Y — which direction the leg faces outward */
  direction: number;
  /** Size variant */
  size?: MechLegSize;
  /** Shoulder mount style */
  variant?: MechLegVariant;
};

export function MechLeg({
  direction,
  size = "md",
  variant = "square",
}: MechLegProps) {
  return size === "sm" ? (
    <MechLegSm direction={direction} variant={variant} />
  ) : (
    <MechLegMd direction={direction} />
  );
}

// ── Small: compact crab-leg — horizontal reach then short drop ──

const SM_ELBOW_X = 0.09;
const SM_ELBOW_Y = -0.015;
const SM_FOOT_X = 0.12;
const SM_FOOT_Y = -0.1;

const SM_UPPER_LEN = Math.sqrt(
  SM_ELBOW_X * SM_ELBOW_X + SM_ELBOW_Y * SM_ELBOW_Y,
);
const SM_UPPER_ANGLE = Math.atan2(SM_ELBOW_Y, SM_ELBOW_X);
const SM_LOWER_DX = SM_FOOT_X - SM_ELBOW_X;
const SM_LOWER_DY = SM_FOOT_Y - SM_ELBOW_Y;
const SM_LOWER_LEN = Math.sqrt(
  SM_LOWER_DX * SM_LOWER_DX + SM_LOWER_DY * SM_LOWER_DY,
);
const SM_LOWER_ANGLE = Math.atan2(SM_LOWER_DY, SM_LOWER_DX);

function MechLegSm({
  direction,
  variant = "square",
}: {
  direction: number;
  variant?: MechLegVariant;
}) {
  return (
    <group rotation={[0, direction - Math.PI / 2, 0]}>
      {/* ── Shoulder mount ─────────────────────── */}
      {variant === "rounded" ? (
        <>
          {/* Rounded: spherical core + cylinder barrel */}
          <mesh>
            <sphereGeometry args={[0.032, 10, 8]} />
            <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.028, 0.028, 0.07, 10]} />
            <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
          </mesh>
          {/* Axle */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.085, 8]} />
            <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.5} />
          </mesh>
          {/* End caps */}
          <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
            <sphereGeometry args={[0.02, 8, 6]} />
            <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
            <sphereGeometry args={[0.02, 8, 6]} />
            <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
          </mesh>
        </>
      ) : (
        <>
          <mesh>
            <boxGeometry args={[0.045, 0.045, 0.07]} />
            <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.65} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.085, 8]} />
            <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.045]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.023, 0.02, 0.01, 8]} />
            <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0, -0.045]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.023, 0.02, 0.01, 8]} />
            <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
          </mesh>
        </>
      )}

      {/* ── Upper arm — mostly horizontal reach ── */}
      <group rotation={[0, 0, SM_UPPER_ANGLE]}>
        <mesh position={[SM_UPPER_LEN / 2, 0, 0]}>
          <boxGeometry args={[SM_UPPER_LEN, 0.03, 0.05]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
        {/* Top detail strip */}
        <mesh position={[SM_UPPER_LEN / 2, 0.018, 0]}>
          <boxGeometry args={[SM_UPPER_LEN * 0.6, 0.008, 0.035]} />
          <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.5} />
        </mesh>
      </group>

      {/* ── Elbow joint (compact) ──────────────── */}
      <group position={[SM_ELBOW_X, SM_ELBOW_Y, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.055, 8]} />
          <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.026, 0.024, 0.008, 8]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, -0.03]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.026, 0.024, 0.008, 8]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
        </mesh>
        {/* Orange accent on joint */}
        <mesh position={[0.02, 0, 0.028]}>
          <boxGeometry args={[0.012, 0.018, 0.01]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
        <mesh position={[0.02, 0, -0.028]}>
          <boxGeometry args={[0.012, 0.018, 0.01]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
      </group>

      {/* ── Lower arm — drops down steeply ─────── */}
      <group
        position={[SM_ELBOW_X, SM_ELBOW_Y, 0]}
        rotation={[0, 0, SM_LOWER_ANGLE]}
      >
        <mesh position={[SM_LOWER_LEN / 2, 0, 0]}>
          <boxGeometry args={[SM_LOWER_LEN, 0.026, 0.04]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
      </group>

      {/* ── Foot assembly ─────────────────────── */}
      <group position={[SM_FOOT_X, SM_FOOT_Y, 0]}>
        {/* Main foot body */}
        <mesh position={[0.01, 0, 0]}>
          <boxGeometry args={[0.09, 0.04, 0.08]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.65} />
        </mesh>
        {/* Sole plate */}
        <mesh position={[0.01, -0.025, 0]}>
          <boxGeometry args={[0.095, 0.01, 0.085]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.6} />
        </mesh>
        {/* Top plate */}
        <mesh position={[0.01, 0.022, 0]}>
          <boxGeometry args={[0.08, 0.008, 0.07]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
        </mesh>

        {/* Prominent drill wheel */}
        <mesh position={[0.05, 0.003, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.07, 10]} />
          <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.35} />
        </mesh>
        {/* Wheel hub */}
        <mesh position={[0.05, 0.003, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.076, 10]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
        </mesh>
        {/* Wheel rims */}
        <mesh position={[0.05, 0.003, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.042, 0.039, 0.012, 10]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.55} />
        </mesh>
        <mesh position={[0.05, 0.003, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.042, 0.039, 0.012, 10]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.55} />
        </mesh>
        {/* Axle */}
        <mesh position={[0.05, 0.003, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.1, 6]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.55} />
        </mesh>
        {/* Mounting bracket */}
        <mesh position={[0.05, -0.005, 0]}>
          <boxGeometry args={[0.03, 0.02, 0.055]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>

        {/* Orange side accents */}
        <mesh position={[-0.015, 0.003, 0.045]}>
          <boxGeometry args={[0.03, 0.025, 0.012]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
        <mesh position={[-0.015, 0.003, -0.045]}>
          <boxGeometry args={[0.03, 0.025, 0.012]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

// ── Medium: full yoke structure with elbow joint ─────────────

const MD_ELBOW_X = 0.1;
const MD_ELBOW_Y = -0.06;
const MD_FOOT_X = 0.15;
const MD_FOOT_Y = -0.18;
const MD_BEAM_GAP = 0.03;

const MD_UPPER_LEN = Math.sqrt(
  MD_ELBOW_X * MD_ELBOW_X + MD_ELBOW_Y * MD_ELBOW_Y,
);
const MD_UPPER_ANGLE = Math.atan2(MD_ELBOW_Y, MD_ELBOW_X);
const MD_LOWER_DX = MD_FOOT_X - MD_ELBOW_X;
const MD_LOWER_DY = MD_FOOT_Y - MD_ELBOW_Y;
const MD_LOWER_LEN = Math.sqrt(
  MD_LOWER_DX * MD_LOWER_DX + MD_LOWER_DY * MD_LOWER_DY,
);
const MD_LOWER_ANGLE = Math.atan2(MD_LOWER_DY, MD_LOWER_DX);

function MechLegMd({ direction }: { direction: number }) {
  return (
    <group rotation={[0, direction - Math.PI / 2, 0]}>
      {/* ── Shoulder mount ─────────────────────── */}
      <mesh>
        <boxGeometry args={[0.06, 0.065, 0.08]} />
        <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.65} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.1, 8]} />
        <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.053]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.027, 0.012, 8]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0, -0.053]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.027, 0.012, 8]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
      </mesh>
      <mesh position={[0.025, -0.015, 0.038]}>
        <boxGeometry args={[0.015, 0.03, 0.015]} />
        <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
      </mesh>
      <mesh position={[0.025, -0.015, -0.038]}>
        <boxGeometry args={[0.015, 0.03, 0.015]} />
        <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
      </mesh>

      {/* ── Upper arm (yoke) ───────────────────── */}
      <group rotation={[0, 0, MD_UPPER_ANGLE]}>
        <mesh position={[MD_UPPER_LEN / 2, 0, MD_BEAM_GAP]}>
          <boxGeometry args={[MD_UPPER_LEN, 0.04, 0.025]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
        <mesh position={[MD_UPPER_LEN / 2, 0, -MD_BEAM_GAP]}>
          <boxGeometry args={[MD_UPPER_LEN, 0.04, 0.025]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
        <mesh position={[MD_UPPER_LEN * 0.5, 0, 0]}>
          <boxGeometry args={[0.025, 0.028, MD_BEAM_GAP * 2 - 0.002]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
        </mesh>
        <mesh position={[MD_UPPER_LEN * 0.5, -0.026, 0]}>
          <boxGeometry args={[0.02, 0.01, MD_BEAM_GAP * 2 + 0.025]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
      </group>

      {/* ── Elbow joint ────────────────────────── */}
      <group position={[MD_ELBOW_X, MD_ELBOW_Y, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.07, 8]} />
          <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.033, 0.012, 8]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.033, 0.012, 8]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
        </mesh>
      </group>

      {/* ── Lower arm (yoke) ───────────────────── */}
      <group
        position={[MD_ELBOW_X, MD_ELBOW_Y, 0]}
        rotation={[0, 0, MD_LOWER_ANGLE]}
      >
        <mesh position={[MD_LOWER_LEN / 2, 0, MD_BEAM_GAP]}>
          <boxGeometry args={[MD_LOWER_LEN, 0.035, 0.022]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
        <mesh position={[MD_LOWER_LEN / 2, 0, -MD_BEAM_GAP]}>
          <boxGeometry args={[MD_LOWER_LEN, 0.035, 0.022]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
      </group>

      {/* ── Foot ───────────────────────────────── */}
      <group position={[MD_FOOT_X, MD_FOOT_Y, 0]}>
        <mesh position={[0.008, 0, 0]}>
          <boxGeometry args={[0.09, 0.04, 0.08]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.65} />
        </mesh>
        <mesh position={[0.008, -0.025, 0]}>
          <boxGeometry args={[0.095, 0.012, 0.085]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.6} />
        </mesh>
        <mesh position={[0.04, 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.07, 8]} />
          <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.35} />
        </mesh>
        <mesh position={[0.04, 0.005, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.037, 0.034, 0.012, 8]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.55} />
        </mesh>
        <mesh position={[0.04, 0.005, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.037, 0.034, 0.012, 8]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.55} />
        </mesh>
        <mesh position={[-0.02, 0.005, 0.045]}>
          <boxGeometry args={[0.025, 0.025, 0.012]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
        <mesh position={[-0.02, 0.005, -0.045]}>
          <boxGeometry args={[0.025, 0.025, 0.012]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}
