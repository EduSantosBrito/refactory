import { useFrame } from "@react-three/fiber";
import { memo, useRef } from "react";
import type { Group } from "three";
import { CylinderGeometry, SphereGeometry } from "three";
import {
  BARK,
  COLORS,
  FOLIAGE,
  type ModelProps,
  type TreeSize,
} from "../colors";

/**
 * Flat-top — horizontal disc canopy, growth-based.
 *
 * Trunk bottom: 0.028 → 0.06 → 0.12 (4.3x growth).
 * Canopy width: 0.26  → 0.48 → 0.84 (3.2x growth).
 * LG canopy = 3.5x trunk width.
 *
 * SM: thin trunk, small flat disc.
 * MD: thicker trunk, wider disc.
 * LG: stout SHORT trunk, very wide main disc + layered top disc.
 *     Trunk becomes shorter and thicker relative to canopy.
 */

const trunkSm = new CylinderGeometry(0.015, 0.028, 0.18, 6);
const trunkMd = new CylinderGeometry(0.03, 0.06, 0.26, 6);
const trunkLg = new CylinderGeometry(0.05, 0.12, 0.24, 6);

const discSm = new SphereGeometry(0.13, 7, 4);
const discMd = new SphereGeometry(0.24, 8, 5);
const discLgMain = new SphereGeometry(0.42, 8, 5);
const discLgTop = new SphereGeometry(0.2, 7, 4);

export const FlatTopTree = memo(function FlatTopTree({
  size = "md",
  ...props
}: ModelProps & { size?: TreeSize }) {
  const ref = useRef<Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.z =
      Math.sin(t * 0.55 + (props.position?.[0] ?? 0) * 1.8) * 0.01;
  });

  return (
    <group {...props}>
      {size === "sm" && (
        <>
          <mesh geometry={trunkSm} position={[0, 0.09, 0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <group ref={ref}>
            <mesh
              geometry={discSm}
              position={[0, 0.22, 0]}
              scale={[1, 0.35, 1]}
            >
              <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
            </mesh>
          </group>
        </>
      )}
      {size === "md" && (
        <>
          <mesh geometry={trunkMd} position={[0, 0.13, 0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <group ref={ref}>
            <mesh
              geometry={discMd}
              position={[0, 0.34, 0]}
              scale={[1, 0.35, 1]}
            >
              <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
            </mesh>
          </group>
        </>
      )}
      {size === "lg" && (
        <>
          <mesh geometry={trunkLg} position={[0, 0.12, 0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <group ref={ref}>
            <mesh
              geometry={discLgMain}
              position={[0, 0.34, 0]}
              scale={[1, 0.3, 1]}
            >
              <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
            </mesh>
            <mesh
              geometry={discLgTop}
              position={[0, 0.46, 0]}
              scale={[1, 0.3, 1]}
            >
              <meshStandardMaterial color={COLORS.canopyLight} {...FOLIAGE} />
            </mesh>
          </group>
        </>
      )}
    </group>
  );
});
