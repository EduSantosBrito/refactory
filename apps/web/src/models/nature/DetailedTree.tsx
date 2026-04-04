import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CylinderGeometry, SphereGeometry } from "three";
import type { Group } from "three";
import { COLORS, FOLIAGE, BARK, type ModelProps, type TreeSize } from "../colors";

/**
 * Detailed — clustered round canopy, richer than oak at every stage.
 *
 * Trunk bottom: 0.028 → 0.065 → 0.15 (5.4x).
 * SM: 2 spheres (main + visible side bump).
 * MD: 3 spheres (main + 2 wide-spread side lobes).
 * LG: 5 spheres (main + 2 sides + front + crown) — full cloud.
 *
 * Side spheres protrude past main sphere edge for bumpy silhouette.
 * Always more complex than oak at same size.
 */

const trunkSm = new CylinderGeometry(0.012, 0.028, 0.14, 6);
const trunkMd = new CylinderGeometry(0.028, 0.065, 0.26, 6);
const trunkLg = new CylinderGeometry(0.055, 0.15, 0.34, 6);

const sA = new SphereGeometry(0.28, 8, 6);
const sB = new SphereGeometry(0.20, 7, 5);
const sC = new SphereGeometry(0.17, 7, 5);
const sD = new SphereGeometry(0.14, 6, 4);
const sE = new SphereGeometry(0.12, 6, 4);
const sF = new SphereGeometry(0.08, 5, 4);

export const DetailedTree = memo(function DetailedTree({
  size = "md",
  ...props
}: ModelProps & { size?: TreeSize }) {
  const ref = useRef<Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.z = Math.sin(t * 0.65 + (props.position?.[0] ?? 0)) * 0.012;
  });

  return (
    <group {...props}>
      {size === "sm" && (
        <>
          <mesh geometry={trunkSm} position={[0, 0.07, 0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <group ref={ref}>
            <mesh geometry={sE} position={[0, 0.22, 0]}>
              <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
            </mesh>
            <mesh geometry={sF} position={[0.10, 0.18, 0.04]}>
              <meshStandardMaterial color={COLORS.canopyLight} {...FOLIAGE} />
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
            <mesh geometry={sB} position={[0, 0.38, 0]}>
              <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
            </mesh>
            <mesh geometry={sD} position={[0.18, 0.34, 0.06]}>
              <meshStandardMaterial color={COLORS.canopyLight} {...FOLIAGE} />
            </mesh>
            <mesh geometry={sE} position={[-0.16, 0.36, -0.05]}>
              <meshStandardMaterial color={COLORS.canopyDark} {...FOLIAGE} />
            </mesh>
          </group>
        </>
      )}
      {size === "lg" && (
        <>
          <mesh geometry={trunkLg} position={[0, 0.17, 0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <group ref={ref}>
            <mesh geometry={sA} position={[0, 0.52, 0]}>
              <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
            </mesh>
            <mesh geometry={sB} position={[0.24, 0.46, 0.08]}>
              <meshStandardMaterial color={COLORS.canopyLight} {...FOLIAGE} />
            </mesh>
            <mesh geometry={sC} position={[-0.22, 0.48, -0.07]}>
              <meshStandardMaterial color={COLORS.canopyDark} {...FOLIAGE} />
            </mesh>
            <mesh geometry={sD} position={[0.06, 0.44, 0.20]}>
              <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
            </mesh>
            <mesh geometry={sD} position={[0.03, 0.76, 0.02]}>
              <meshStandardMaterial color={COLORS.canopyLight} {...FOLIAGE} />
            </mesh>
          </group>
        </>
      )}
    </group>
  );
});
