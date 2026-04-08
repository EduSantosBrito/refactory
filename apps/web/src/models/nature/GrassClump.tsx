import { useFrame } from "@react-three/fiber";
import { memo, useRef } from "react";
import type { Group } from "three";
import { ConeGeometry } from "three";
import { COLORS, FOLIAGE, type ModelProps } from "../colors";

const bladeTall = new ConeGeometry(0.014, 0.18, 3, 1);
const bladeMed = new ConeGeometry(0.012, 0.14, 3, 1);
const bladeShort = new ConeGeometry(0.01, 0.1, 3, 1);

/**
 * Grass clump — thin triangular blades with flat shading.
 */
export const GrassClump = memo(function GrassClump(props: ModelProps) {
  const ref = useRef<Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.z =
      Math.sin(
        state.clock.getElapsedTime() * 1.1 + (props.position?.[0] ?? 0) * 3,
      ) * 0.04;
  });

  return (
    <group {...props}>
      <group ref={ref}>
        <mesh geometry={bladeTall} position={[0, 0.09, 0]}>
          <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
        </mesh>
        <mesh
          geometry={bladeMed}
          position={[0.025, 0.07, 0.01]}
          rotation={[0.1, 0, 0.15]}
        >
          <meshStandardMaterial color={COLORS.canopyDark} {...FOLIAGE} />
        </mesh>
        <mesh
          geometry={bladeTall}
          position={[-0.02, 0.09, -0.015]}
          rotation={[-0.08, 0, -0.12]}
        >
          <meshStandardMaterial color={COLORS.canopyLight} {...FOLIAGE} />
        </mesh>
        <mesh
          geometry={bladeMed}
          position={[0.01, 0.07, -0.025]}
          rotation={[0.15, 0.3, 0.08]}
        >
          <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
        </mesh>
        <mesh
          geometry={bladeShort}
          position={[-0.018, 0.05, 0.02]}
          rotation={[-0.12, -0.2, -0.2]}
        >
          <meshStandardMaterial color={COLORS.canopyDark} {...FOLIAGE} />
        </mesh>
        <mesh
          geometry={bladeShort}
          position={[0.022, 0.05, 0.018]}
          rotation={[0.08, 0.1, 0.25]}
        >
          <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
        </mesh>
      </group>
    </group>
  );
});
