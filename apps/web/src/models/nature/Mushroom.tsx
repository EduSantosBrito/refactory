import { memo } from "react";
import { CylinderGeometry, SphereGeometry } from "three";
import { COLORS, BARK, FOLIAGE, type ModelProps } from "../colors";

/**
 * Small mushroom — red cap on cream stem, flat-shaded.
 */

const stemGeo = new CylinderGeometry(0.012, 0.016, 0.06, 5);
const capGeo = new SphereGeometry(0.04, 6, 4);

export const Mushroom = memo(function Mushroom(props: ModelProps) {
  return (
    <group {...props}>
      <mesh geometry={stemGeo} position={[0, 0.03, 0]}>
        <meshStandardMaterial color={COLORS.mushroomStem} {...BARK} />
      </mesh>
      <mesh geometry={capGeo} position={[0, 0.075, 0]} scale={[1, 0.5, 1]}>
        <meshStandardMaterial color={COLORS.mushroomCap} {...FOLIAGE} />
      </mesh>
    </group>
  );
});
