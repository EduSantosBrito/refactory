import { memo } from "react";
import { CylinderGeometry } from "three";
import { COLORS, BARK, type ModelProps, type TreeSize } from "../colors";

/**
 * Tree stump — cut trunk base, flat-shaded.
 *
 * SM: tiny nub.
 * MD: visible stump with cut surface.
 * LG: wide stump with exposed root flare.
 */

const bodySm = new CylinderGeometry(0.03, 0.045, 0.04, 6);
const bodyMd = new CylinderGeometry(0.045, 0.07, 0.06, 7);
const bodyLg = new CylinderGeometry(0.065, 0.11, 0.08, 8);

const topSm = new CylinderGeometry(0.028, 0.03, 0.008, 6);
const topMd = new CylinderGeometry(0.042, 0.045, 0.01, 7);
const topLg = new CylinderGeometry(0.06, 0.065, 0.012, 8);

const rootA = new CylinderGeometry(0.01, 0.025, 0.06, 4);
const rootB = new CylinderGeometry(0.008, 0.02, 0.05, 4);

export const Stump = memo(function Stump({
  size = "md",
  ...props
}: ModelProps & { size?: TreeSize }) {
  return (
    <group {...props}>
      {size === "sm" && (
        <>
          <mesh geometry={bodySm} position={[0, 0.02, 0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <mesh geometry={topSm} position={[0, 0.044, 0]}>
            <meshStandardMaterial color={COLORS.trunkDark} {...BARK} />
          </mesh>
        </>
      )}
      {size === "md" && (
        <>
          <mesh geometry={bodyMd} position={[0, 0.03, 0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <mesh geometry={topMd} position={[0, 0.065, 0]}>
            <meshStandardMaterial color={COLORS.trunkDark} {...BARK} />
          </mesh>
        </>
      )}
      {size === "lg" && (
        <>
          <mesh geometry={bodyLg} position={[0, 0.04, 0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <mesh geometry={topLg} position={[0, 0.086, 0]}>
            <meshStandardMaterial color={COLORS.trunkDark} {...BARK} />
          </mesh>
          <mesh geometry={rootA} position={[0.12, 0.005, 0.03]} rotation={[0.15, 0, -1.2]}>
            <meshStandardMaterial color={COLORS.trunkDark} {...BARK} />
          </mesh>
          <mesh geometry={rootB} position={[-0.08, 0.005, 0.10]} rotation={[0.8, 0, 1.0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <mesh geometry={rootB} position={[-0.06, 0.005, -0.10]} rotation={[-0.7, 0, 0.9]}>
            <meshStandardMaterial color={COLORS.trunkDark} {...BARK} />
          </mesh>
        </>
      )}
    </group>
  );
});
