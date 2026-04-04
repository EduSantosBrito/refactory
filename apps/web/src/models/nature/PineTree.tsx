import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ConeGeometry, CylinderGeometry } from "three";
import type { Group } from "three";
import { COLORS, FOLIAGE, BARK, type ModelProps, type TreeSize } from "../colors";

/**
 * Pine — stacked cone tiers, always thinner than oak.
 *
 * Width at same size: Pine SM 0.12 < Oak SM 0.28.
 *                     Pine LG 0.38 < Oak LG 1.10.
 * Trunk bottom: 0.016 → 0.032 → 0.055 (3.4x growth).
 *
 * SM: needle-thin sapling, 2 narrow tiers.
 * MD: slender, 3 stacked tiers.
 * LG: tallest tree, 4 full tiers, wider but still narrow.
 */

const trunkSm = new CylinderGeometry(0.008, 0.016, 0.12, 6);
const trunkMd = new CylinderGeometry(0.014, 0.032, 0.28, 6);
const trunkLg = new CylinderGeometry(0.022, 0.055, 0.38, 6);

const smA = new ConeGeometry(0.06, 0.10, 6, 1);
const smB = new ConeGeometry(0.04, 0.08, 6, 1);

const mdA = new ConeGeometry(0.12, 0.15, 6, 1);
const mdB = new ConeGeometry(0.085, 0.14, 6, 1);
const mdC = new ConeGeometry(0.05, 0.12, 6, 1);

const lgA = new ConeGeometry(0.19, 0.17, 6, 1);
const lgB = new ConeGeometry(0.14, 0.16, 6, 1);
const lgC = new ConeGeometry(0.095, 0.15, 6, 1);
const lgD = new ConeGeometry(0.055, 0.14, 6, 1);

export const PineTree = memo(function PineTree({
  size = "md",
  ...props
}: ModelProps & { size?: TreeSize }) {
  const ref = useRef<Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.z = Math.sin(t * 0.6 + (props.position?.[0] ?? 0) * 1.5) * 0.01;
  });

  return (
    <group {...props}>
      {size === "sm" && (
        <>
          <mesh geometry={trunkSm} position={[0, 0.06, 0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <group ref={ref}>
            <mesh geometry={smA} position={[0, 0.16, 0]}>
              <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
            </mesh>
            <mesh geometry={smB} position={[0, 0.24, 0]}>
              <meshStandardMaterial color={COLORS.canopyLight} {...FOLIAGE} />
            </mesh>
          </group>
        </>
      )}
      {size === "md" && (
        <>
          <mesh geometry={trunkMd} position={[0, 0.14, 0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <group ref={ref}>
            <mesh geometry={mdA} position={[0, 0.32, 0]}>
              <meshStandardMaterial color={COLORS.canopyDark} {...FOLIAGE} />
            </mesh>
            <mesh geometry={mdB} position={[0, 0.44, 0]}>
              <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
            </mesh>
            <mesh geometry={mdC} position={[0, 0.55, 0]}>
              <meshStandardMaterial color={COLORS.canopyLight} {...FOLIAGE} />
            </mesh>
          </group>
        </>
      )}
      {size === "lg" && (
        <>
          <mesh geometry={trunkLg} position={[0, 0.19, 0]}>
            <meshStandardMaterial color={COLORS.trunk} {...BARK} />
          </mesh>
          <group ref={ref}>
            <mesh geometry={lgA} position={[0, 0.42, 0]}>
              <meshStandardMaterial color={COLORS.canopyDark} {...FOLIAGE} />
            </mesh>
            <mesh geometry={lgB} position={[0, 0.55, 0]}>
              <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
            </mesh>
            <mesh geometry={lgC} position={[0, 0.67, 0]}>
              <meshStandardMaterial color={COLORS.canopy} {...FOLIAGE} />
            </mesh>
            <mesh geometry={lgD} position={[0, 0.78, 0]}>
              <meshStandardMaterial color={COLORS.canopyLight} {...FOLIAGE} />
            </mesh>
          </group>
        </>
      )}
    </group>
  );
});
