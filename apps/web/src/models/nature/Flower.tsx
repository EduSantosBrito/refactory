import { memo } from "react";
import { ConeGeometry, CylinderGeometry, SphereGeometry } from "three";
import { COLORS, FOLIAGE, BARK, type ModelProps } from "../colors";

const stemGeo = new CylinderGeometry(0.008, 0.01, 0.1, 4);
const bloomGeo = new SphereGeometry(0.035, 6, 5);
const leafGeo = new ConeGeometry(0.025, 0.04, 4, 1);

const BLOOM_COLORS = {
  purple: COLORS.flowerPurple,
  red: COLORS.flowerRed,
  yellow: COLORS.flowerYellow,
} as const;

/**
 * Small ground flower — thin stem, faceted bloom, tiny leaves.
 */
export const Flower = memo(function Flower({
  color = "purple",
  ...props
}: ModelProps & { color?: "purple" | "red" | "yellow" }) {
  return (
    <group {...props}>
      <mesh geometry={stemGeo} position={[0, 0.05, 0]}>
        <meshStandardMaterial color={COLORS.stem} {...BARK} />
      </mesh>
      <mesh geometry={leafGeo} position={[0.015, 0.025, 0.005]} rotation={[0.2, 0, 0.5]}>
        <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
      </mesh>
      <mesh geometry={leafGeo} position={[-0.012, 0.02, -0.008]} rotation={[-0.15, 0, -0.6]}>
        <meshStandardMaterial color={COLORS.canopyDark} {...FOLIAGE} />
      </mesh>
      <mesh geometry={bloomGeo} position={[0, 0.115, 0]}>
        <meshStandardMaterial color={BLOOM_COLORS[color]} roughness={0.7} metalness={0} flatShading />
      </mesh>
    </group>
  );
});
