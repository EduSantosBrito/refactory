import { memo } from "react";
import { CylinderGeometry } from "three";
import { COLORS, BARK, type ModelProps } from "../colors";

const bodyGeo = new CylinderGeometry(0.08, 0.1, 0.1, 6);
const topGeo = new CylinderGeometry(0.075, 0.08, 0.015, 6);
const ringGeo = new CylinderGeometry(0.04, 0.04, 0.016, 6);

/**
 * Short tree stump — flat-topped cylinder with visible ring.
 * Matches kenney stump_round: squat, warm brown, clean cut.
 */
export const TreeStump = memo(function TreeStump(props: ModelProps) {
  return (
    <group {...props}>
      {/* Body */}
      <mesh geometry={bodyGeo} position={[0, 0.05, 0]}>
        <meshStandardMaterial color={COLORS.trunk} {...BARK} />
      </mesh>
      {/* Cut face — lighter wood */}
      <mesh geometry={topGeo} position={[0, 0.105, 0]}>
        <meshStandardMaterial color={COLORS.trunkPalm} {...BARK} />
      </mesh>
      {/* Growth ring */}
      <mesh geometry={ringGeo} position={[0, 0.108, 0]}>
        <meshStandardMaterial color={COLORS.trunkDark} {...BARK} />
      </mesh>
    </group>
  );
});
