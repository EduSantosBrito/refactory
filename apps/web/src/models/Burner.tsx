import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshStandardMaterial } from "three";
import { COLORS, MAT, type ModelProps } from "./colors";

/**
 * Warm burgundy pot-belly burner.
 * Rounded, cozy, like an AC wood stove.
 * Smooth sphere body + chimney + glowing window.
 */
export function Burner(props: ModelProps) {
  const glowRef = useRef<Mesh>(null);

  useFrame(() => {
    if (!glowRef.current) return;
    const mat = glowRef.current.material as MeshStandardMaterial;
    mat.emissiveIntensity = 0.35 + Math.random() * 0.3;
  });

  return (
    <group {...props}>
      {/* Rounded feet — four smooth bumps */}
      {([[-0.15, 0, -0.15], [-0.15, 0, 0.15], [0.15, 0, -0.15], [0.15, 0, 0.15]] as const).map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.05, 10, 8]} />
          <meshStandardMaterial color={COLORS.burnerDark} {...MAT} />
        </mesh>
      ))}

      {/* Belly — smooth squashed sphere */}
      <mesh position={[0, 0.32, 0]} scale={[1, 0.85, 1]}>
        <sphereGeometry args={[0.34, 18, 14]} />
        <meshStandardMaterial color={COLORS.burner} {...MAT} />
      </mesh>

      {/* Belly ring — decorative band */}
      <mesh position={[0, 0.26, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.32, 0.018, 8, 18]} />
        <meshStandardMaterial color={COLORS.burnerLight} {...MAT} roughness={0.4} />
      </mesh>

      {/* Fire window — warm glow */}
      <mesh position={[0, 0.28, 0.3]} ref={glowRef}>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshStandardMaterial
          color={COLORS.glow}
          emissive={COLORS.glowHot}
          emissiveIntensity={0.5}
          roughness={0.3}
        />
      </mesh>
      {/* Window frame — dark ring around glow */}
      <mesh position={[0, 0.28, 0.28]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.1, 0.02, 8, 14]} />
        <meshStandardMaterial color={COLORS.burnerDark} {...MAT} />
      </mesh>

      {/* Chimney — smooth, short */}
      <mesh position={[0, 0.58, 0]}>
        <cylinderGeometry args={[0.065, 0.085, 0.2, 12]} />
        <meshStandardMaterial color={COLORS.burnerDark} {...MAT} />
      </mesh>
      {/* Chimney lip */}
      <mesh position={[0, 0.68, 0]}>
        <torusGeometry args={[0.07, 0.02, 8, 12]} />
        <meshStandardMaterial color={COLORS.burner} {...MAT} />
      </mesh>

      {/* Door handle — tiny smooth knob */}
      <mesh position={[0.1, 0.2, 0.32]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color={COLORS.burnerDark} roughness={0.3} metalness={0.2} />
      </mesh>
    </group>
  );
}
