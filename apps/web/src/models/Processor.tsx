import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { COLORS, MAT, type ModelProps } from "./colors";

/**
 * Soft mint processor — clean, precise, toylike.
 * Rounded body with animated stamp press on top.
 * The stamp bobbing = "this machine is active."
 */
export function Processor(props: ModelProps) {
  const stampRef = useRef<Group>(null);

  useFrame(() => {
    if (!stampRef.current) return;
    const t = (Date.now() * 0.003) % (Math.PI * 2);
    stampRef.current.position.y = 0.6 + Math.max(0, Math.sin(t)) * 0.14;
  });

  return (
    <group {...props}>
      {/* Rounded base */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.48, 0.5, 0.08, 16]} />
        <meshStandardMaterial color={COLORS.processorDark} {...MAT} />
      </mesh>

      {/* Main body */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.82, 0.44, 0.68]} />
        <meshStandardMaterial color={COLORS.processor} {...MAT} />
      </mesh>
      {/* Top trim */}
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[0.78, 0.04, 0.64]} />
        <meshStandardMaterial color={COLORS.processorLight} {...MAT} />
      </mesh>

      {/* Stamp guide housing — visible from above */}
      <mesh position={[0, 0.56, 0]}>
        <cylinderGeometry args={[0.14, 0.16, 0.06, 12]} />
        <meshStandardMaterial color={COLORS.processorDark} {...MAT} />
      </mesh>

      {/* Animated stamp */}
      <group ref={stampRef}>
        {/* Stamp rod */}
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.2, 10]} />
          <meshStandardMaterial color={COLORS.processorDark} roughness={0.35} metalness={0.15} />
        </mesh>
        {/* Stamp head */}
        <mesh position={[0, -0.02, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.06, 12]} />
          <meshStandardMaterial color={COLORS.processorDark} roughness={0.4} metalness={0.1} />
        </mesh>
      </group>

      {/* Accent band */}
      <mesh position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.44, 0.015, 8, 20]} />
        <meshStandardMaterial color={COLORS.processorLight} {...MAT} roughness={0.4} />
      </mesh>

      {/* Status light on front */}
      <mesh position={[0.3, 0.45, 0.35]}>
        <sphereGeometry args={[0.025, 10, 10]} />
        <meshStandardMaterial color="#7ecf7e" emissive="#7ecf7e" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}
