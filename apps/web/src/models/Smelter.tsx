import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshStandardMaterial } from "three";
import { COLORS, MAT, type ModelProps } from "./colors";

/**
 * Warm terracotta smelter — like an AC furniture item.
 * Rounded body with a chunky chimney and glowing furnace mouth.
 * Smooth, warm, toylike.
 */
export function Smelter(props: ModelProps) {
  const glowRef = useRef<Mesh>(null);

  useFrame(() => {
    if (!glowRef.current) return;
    const mat = glowRef.current.material as MeshStandardMaterial;
    mat.emissiveIntensity = 0.4 + Math.sin(Date.now() * 0.004) * 0.2;
  });

  return (
    <group {...props}>
      {/* Rounded base */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.46, 0.48, 0.08, 16]} />
        <meshStandardMaterial color={COLORS.smelterDark} {...MAT} />
      </mesh>

      {/* Main body — rounded box via capsule-ish stacking */}
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.78, 0.5, 0.68]} />
        <meshStandardMaterial color={COLORS.smelter} {...MAT} />
      </mesh>
      {/* Top edge round-off */}
      <mesh position={[0, 0.57, 0]}>
        <boxGeometry args={[0.74, 0.04, 0.64]} />
        <meshStandardMaterial color={COLORS.smelterLight} {...MAT} />
      </mesh>

      {/* Chimney — smooth, chunky cylinder */}
      <mesh position={[0.18, 0.78, -0.12]}>
        <cylinderGeometry args={[0.09, 0.11, 0.4, 12]} />
        <meshStandardMaterial color={COLORS.smelterDark} {...MAT} />
      </mesh>
      {/* Chimney lip — ring at top */}
      <mesh position={[0.18, 0.98, -0.12]}>
        <torusGeometry args={[0.09, 0.025, 8, 12]} />
        <meshStandardMaterial color={COLORS.smelter} {...MAT} />
      </mesh>

      {/* Furnace mouth — warm glow */}
      <mesh position={[0, 0.28, 0.35]} ref={glowRef}>
        <boxGeometry args={[0.3, 0.2, 0.04]} />
        <meshStandardMaterial
          color={COLORS.glow}
          emissive={COLORS.glow}
          emissiveIntensity={0.5}
          roughness={0.3}
        />
      </mesh>
      {/* Mouth arch frame */}
      <mesh position={[0, 0.28, 0.34]}>
        <boxGeometry args={[0.36, 0.26, 0.03]} />
        <meshStandardMaterial color={COLORS.smelterDark} {...MAT} />
      </mesh>

      {/* Decorative band around middle */}
      <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.42, 0.018, 8, 20]} />
        <meshStandardMaterial color={COLORS.smelterLight} {...MAT} roughness={0.4} />
      </mesh>
    </group>
  );
}
