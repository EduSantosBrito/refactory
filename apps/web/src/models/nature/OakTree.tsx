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
 * Oak — round canopy, growth-based.
 *
 * Trunk bottom: 0.022 → 0.07 → 0.18 (8.2x growth).
 * Canopy radius: 0.14  → 0.28 → 0.46 (3.3x growth).
 * Trunk grows 2.5x faster than canopy → LG trunk dominates.
 *
 * SM: hair-thin sapling, single small sphere.
 * MD: thicker trunk, round sphere + crown bump.
 * LG: stout thick trunk, very wide oblate sphere + larger crown.
 *     Width dominates height (scale=[1.2, 0.72, 1.2]).
 */

const trunkSm = new CylinderGeometry(0.01, 0.022, 0.1, 6);
const trunkMd = new CylinderGeometry(0.028, 0.07, 0.24, 6);
const trunkLg = new CylinderGeometry(0.065, 0.18, 0.28, 6);

const canopySm = new SphereGeometry(0.14, 7, 5);
const canopyMd = new SphereGeometry(0.28, 8, 6);
const canopyLg = new SphereGeometry(0.46, 8, 6);
const crownMd = new SphereGeometry(0.12, 6, 5);
const crownLg = new SphereGeometry(0.18, 6, 5);

export const OakTree = memo(function OakTree({
  size = "md",
  ...props
}: ModelProps & { size?: TreeSize }) {
  const ref = useRef<Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.z =
      Math.sin(t * 0.7 + (props.position?.[0] ?? 0) * 2) * 0.012;
  });

  return (
    <group {...props}>
      {size === "sm" && (
        <>
          <mesh geometry={trunkSm} position={[0, 0.05, 0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <group ref={ref}>
            <mesh geometry={canopySm} position={[0, 0.2, 0]}>
              <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
            </mesh>
          </group>
        </>
      )}
      {size === "md" && (
        <>
          <mesh geometry={trunkMd} position={[0, 0.12, 0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <group ref={ref}>
            <mesh geometry={canopyMd} position={[0, 0.4, 0]}>
              <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
            </mesh>
            <mesh geometry={crownMd} position={[0.02, 0.62, 0.01]}>
              <meshStandardMaterial color={COLORS.canopyLight} {...FOLIAGE} />
            </mesh>
          </group>
        </>
      )}
      {size === "lg" && (
        <>
          <mesh geometry={trunkLg} position={[0, 0.14, 0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <group ref={ref}>
            <mesh
              geometry={canopyLg}
              position={[0, 0.5, 0]}
              scale={[1.2, 0.72, 1.2]}
            >
              <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
            </mesh>
            <mesh geometry={crownLg} position={[0.03, 0.76, 0.02]}>
              <meshStandardMaterial color={COLORS.canopyLight} {...FOLIAGE} />
            </mesh>
          </group>
        </>
      )}
    </group>
  );
});
