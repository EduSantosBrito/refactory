import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CylinderGeometry } from "three";
import type { Group } from "three";
import { COLORS, BARK, type ModelProps, type TreeSize } from "../colors";

/**
 * Dead tree — bare trunk with branch stubs, no foliage.
 *
 * SM: thin sapling, 2 small stubs.
 * MD: medium trunk, 3 stubs + forked tip.
 * LG: thick trunk, 4 stubs + forked crown.
 */

const trunkSm = new CylinderGeometry(0.008, 0.02, 0.18, 5);
const trunkMd = new CylinderGeometry(0.018, 0.055, 0.34, 6);
const trunkLg = new CylinderGeometry(0.03, 0.11, 0.42, 6);

const branchLg = new CylinderGeometry(0.005, 0.018, 0.14, 4);
const branchMd = new CylinderGeometry(0.004, 0.014, 0.11, 4);
const branchSm = new CylinderGeometry(0.003, 0.01, 0.08, 4);
const branchTiny = new CylinderGeometry(0.002, 0.007, 0.06, 4);

const forkA = new CylinderGeometry(0.003, 0.012, 0.10, 4);
const forkB = new CylinderGeometry(0.002, 0.01, 0.08, 4);

export const DeadTree = memo(function DeadTree({
  size = "md",
  ...props
}: ModelProps & { size?: TreeSize }) {
  const ref = useRef<Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.z = Math.sin(t * 0.5 + (props.position?.[0] ?? 0) * 2) * 0.008;
  });

  return (
    <group {...props}>
      {size === "sm" && (
        <>
          <mesh geometry={trunkSm} position={[0, 0.09, 0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <group ref={ref}>
            <mesh geometry={branchTiny} position={[0.025, 0.16, 0]} rotation={[0, 0, -0.8]}>
              <meshStandardMaterial color={COLORS.trunkDark} {...BARK} />
            </mesh>
            <mesh geometry={branchTiny} position={[-0.02, 0.12, 0.01]} rotation={[0.2, 0, 0.9]}>
              <meshStandardMaterial color={COLORS.trunk} {...BARK} />
            </mesh>
          </group>
        </>
      )}
      {size === "md" && (
        <>
          <mesh geometry={trunkMd} position={[0, 0.17, 0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <group ref={ref}>
            <mesh geometry={branchMd} position={[0.055, 0.28, 0.01]} rotation={[0.1, 0, -0.7]}>
              <meshStandardMaterial color={COLORS.trunkDark} {...BARK} />
            </mesh>
            <mesh geometry={branchSm} position={[-0.045, 0.20, -0.02]} rotation={[-0.15, 0, 0.8]}>
              <meshStandardMaterial color={COLORS.trunk} {...BARK} />
            </mesh>
            <mesh geometry={branchSm} position={[0.02, 0.14, 0.04]} rotation={[0.6, 0, -0.5]}>
              <meshStandardMaterial color={COLORS.trunkDark} {...BARK} />
            </mesh>
            <mesh geometry={forkA} position={[0.018, 0.38, 0]} rotation={[0, 0, -0.25]}>
              <meshStandardMaterial color={COLORS.trunk} {...BARK} />
            </mesh>
            <mesh geometry={forkB} position={[-0.014, 0.37, 0.005]} rotation={[0.1, 0, 0.3]}>
              <meshStandardMaterial color={COLORS.trunkDark} {...BARK} />
            </mesh>
          </group>
        </>
      )}
      {size === "lg" && (
        <>
          <mesh geometry={trunkLg} position={[0, 0.21, 0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <group ref={ref}>
            <mesh geometry={branchLg} position={[0.08, 0.35, 0.02]} rotation={[0.15, 0, -0.65]}>
              <meshStandardMaterial color={COLORS.trunkDark} {...BARK} />
            </mesh>
            <mesh geometry={branchMd} position={[-0.07, 0.28, -0.03]} rotation={[-0.2, 0, 0.75]}>
              <meshStandardMaterial color={COLORS.trunk} {...BARK} />
            </mesh>
            <mesh geometry={branchMd} position={[0.07, 0.18, 0.05]} rotation={[0.5, 0, -0.4]}>
              <meshStandardMaterial color={COLORS.trunkDark} {...BARK} />
            </mesh>
            <mesh geometry={branchSm} position={[-0.07, 0.22, 0.05]} rotation={[0.4, 0.3, 0.6]}>
              <meshStandardMaterial color={COLORS.trunk} {...BARK} />
            </mesh>
            <mesh geometry={forkA} position={[0.025, 0.46, 0.01]} rotation={[0.1, 0, -0.25]}>
              <meshStandardMaterial color={COLORS.trunk} {...BARK} />
            </mesh>
            <mesh geometry={forkA} position={[-0.02, 0.45, -0.01]} rotation={[-0.1, 0, 0.3]}>
              <meshStandardMaterial color={COLORS.trunkDark} {...BARK} />
            </mesh>
            <mesh geometry={forkB} position={[0.005, 0.47, 0.015]} rotation={[0.2, 0.2, -0.1]}>
              <meshStandardMaterial color={COLORS.trunk} {...BARK} />
            </mesh>
          </group>
        </>
      )}
    </group>
  );
});
