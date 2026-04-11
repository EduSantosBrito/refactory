import { useTexture } from "@react-three/drei";
import { memo } from "react";
import { Select } from "../components/OutlineProvider";
import { useOutlineHover } from "../hooks/useOutlineHover";
import { COLORS, MAT, type ModelProps } from "./colors";

/**
 * WIP Warning Sign — cute construction-themed ground marker
 *
 * Chunky warning sign on a stubby post, with construction stripes
 * and a playful "work in progress" vibe. Fits the toylike aesthetic.
 */

/* ── Palette ── */
const POST_WOOD = "#8b6b4a";
const POST_DARK = "#6b4e35";
const SIGN_YELLOW = "#f5d24a";
const SIGN_ORANGE = "#e8945a";
const STRIPE_DARK = "#2d3550";
const BOLT_METAL = "#8a8e95";


/* ── Dimensions ── */
const BASE_H = 0.02;
const POST_H = 0.28;
const POST_R = 0.025;
const SIGN_W = 0.22;
const SIGN_H = 0.18;
const SIGN_D = 0.02;

function ShovelIcon() {
  const texture = useTexture("/icons/shovel.png");
  texture.anisotropy = 16;
  return (
    <mesh position={[0, 0, 0.013]}>
      <planeGeometry args={[0.09, 0.09]} />
      <meshBasicMaterial
        map={texture}
        transparent
      />
    </mesh>
  );
}

export const WIPSign = memo(function WIPSign({
  onClick,
  onPointerOver,
  onPointerOut,
  ...props
}: ModelProps) {
  const { groupRef, hovered, pointerEvents } = useOutlineHover({
    onPointerOver,
    onPointerOut,
  });

  return (
    <Select enabled={hovered}>
      <group ref={groupRef} onClick={onClick} {...props} {...pointerEvents}>
      {/* Dedicated interaction mesh to avoid child-mesh hover churn */}
      <mesh
        visible={false}
        position={[0, 0.2, 0]}
        userData={{ isHitArea: true }}
      >
        <cylinderGeometry args={[0.35, 0.35, 0.5, 8]} />
        <meshBasicMaterial />
      </mesh>

      {/* ── Ground base — dirt mound ── */}
      <mesh position={[0, BASE_H / 2, 0]}>
        <cylinderGeometry args={[0.1, 0.14, BASE_H, 8]} />
        <meshStandardMaterial
          color={COLORS.trunkDark}
          roughness={0.95}
          metalness={0}
          flatShading
        />
      </mesh>

      {/* ── Small rocks around base ── */}
      {[
        { pos: [0.08, 0.015, 0.06] as const, s: 0.025 },
        { pos: [-0.1, 0.012, 0.03] as const, s: 0.02 },
        { pos: [0.05, 0.01, -0.09] as const, s: 0.018 },
      ].map((rock, i) => (
        <mesh key={i} position={rock.pos}>
          <dodecahedronGeometry args={[rock.s, 0]} />
          <meshStandardMaterial
            color={COLORS.stone}
            roughness={0.9}
            flatShading
          />
        </mesh>
      ))}

      {/* ── Wooden post — chunky and slightly tapered ── */}
      <mesh position={[0, BASE_H + POST_H / 2, 0]}>
        <cylinderGeometry args={[POST_R * 0.85, POST_R, POST_H, 6]} />
        <meshStandardMaterial color={POST_WOOD} roughness={0.85} flatShading />
      </mesh>

      {/* ── Post cap — rounded top ── */}
      <mesh position={[0, BASE_H + POST_H + 0.012, 0]}>
        <sphereGeometry args={[POST_R * 0.9, 6, 4]} />
        <meshStandardMaterial color={POST_DARK} roughness={0.8} flatShading />
      </mesh>

      {/* ── Metal band on post ── */}
      <mesh position={[0, BASE_H + 0.05, 0]}>
        <cylinderGeometry args={[POST_R + 0.005, POST_R + 0.005, 0.015, 6]} />
        <meshStandardMaterial color={BOLT_METAL} {...MAT} roughness={0.5} />
      </mesh>

      {/* ── Sign board — diamond shape (rotated square) ── */}
      <group position={[0, BASE_H + POST_H - 0.02, POST_R + SIGN_D / 2 + 0.005]}>
        {/* Dark border frame (behind main panel) */}
        <mesh rotation={[0, 0, Math.PI / 4]} position={[0, 0, -0.003]}>
          <boxGeometry args={[SIGN_W * 0.82, SIGN_W * 0.82, SIGN_D]} />
          <meshStandardMaterial
            color={STRIPE_DARK}
            roughness={0.6}
            flatShading
          />
        </mesh>

        {/* Main sign panel */}
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[SIGN_W * 0.75, SIGN_W * 0.75, SIGN_D]} />
          <meshStandardMaterial
            color={SIGN_YELLOW}
            roughness={0.7}
            flatShading
          />
        </mesh>

        {/* Border frame */}
        <mesh rotation={[0, 0, Math.PI / 4]} position={[0, 0, 0.005]}>
          <boxGeometry args={[SIGN_W * 0.68, SIGN_W * 0.68, 0.005]} />
          <meshStandardMaterial
            color={SIGN_ORANGE}
            roughness={0.65}
            flatShading
          />
        </mesh>

        {/* Shovel icon */}
        <ShovelIcon />

        {/* Corner bolts */}
        {(
          [
            [0, 0.07],
            [0, -0.07],
            [0.07, 0],
            [-0.07, 0],
          ] as const
        ).map(([x, y], i) => (
          <mesh key={i} position={[x, y, 0.012]}>
            <cylinderGeometry args={[0.008, 0.008, 0.008, 6]} />
            <meshStandardMaterial color={BOLT_METAL} {...MAT} roughness={0.4} />
          </mesh>
        ))}
      </group>

      {/* ── Small traffic cone beside sign (cute detail) ── */}
      <group position={[0.12, 0, 0.08]}>
        {/* Cone base */}
        <mesh position={[0, 0.008, 0]}>
          <boxGeometry args={[0.05, 0.012, 0.05]} />
          <meshStandardMaterial color={STRIPE_DARK} roughness={0.7} />
        </mesh>
        {/* Cone body */}
        <mesh position={[0, 0.045, 0]}>
          <coneGeometry args={[0.022, 0.06, 6]} />
          <meshStandardMaterial
            color={SIGN_ORANGE}
            roughness={0.65}
            flatShading
          />
        </mesh>
        {/* White stripe */}
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.017, 0.02, 0.012, 6]} />
          <meshStandardMaterial color="#f0e8dc" roughness={0.7} />
        </mesh>
      </group>

      {/* ── Hard hat on ground (extra cute) ── */}
      <group position={[-0.1, 0, 0.1]} rotation={[0.15, 0.8, 0.1]}>
        {/* Hat dome */}
        <mesh position={[0, 0.025, 0]}>
          <sphereGeometry args={[0.035, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={COLORS.hardHat}
            roughness={0.6}
            flatShading
          />
        </mesh>
        {/* Hat brim */}
        <mesh position={[0, 0.012, 0]}>
          <cylinderGeometry args={[0.042, 0.04, 0.01, 8]} />
          <meshStandardMaterial
            color={COLORS.hardHatDark}
            roughness={0.65}
            flatShading
          />
        </mesh>
        </group>
      </group>
    </Select>
  );
});
