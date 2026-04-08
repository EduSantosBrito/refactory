import { memo } from "react";
import { CylinderGeometry } from "three";
import { BARK, COLORS, type ModelProps } from "../colors";

/**
 * Fallen log — horizontal cylinder with flat-shaded bark.
 * Slightly tapered for natural shape.
 */

const logBody = new CylinderGeometry(0.035, 0.04, 0.24, 6);

export const Log = memo(function Log(props: ModelProps) {
  return (
    <group {...props}>
      <mesh
        geometry={logBody}
        position={[0, 0.04, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <meshStandardMaterial color={COLORS.trunk} {...BARK} />
      </mesh>
    </group>
  );
});
