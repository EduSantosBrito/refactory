import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshStandardMaterial } from "three";
import { COLORS, MAT, type ModelProps } from "./colors";

/**
 * Warm wooden power pole with glowing blue tips.
 * Like a cute AC outdoor furniture piece.
 * Smooth wood, rounded shapes, gentle glow.
 */
export function PowerPole(props: ModelProps) {
  const tipRefs = useRef<Mesh[]>([]);

  useFrame(() => {
    tipRefs.current.forEach((tip, i) => {
      if (!tip) return;
      const mat = tip.material as MeshStandardMaterial;
      mat.emissiveIntensity = 0.35 + Math.sin(Date.now() * 0.003 + i * 2.5) * 0.35;
    });
  });

  return (
    <group {...props} rotation={[0.02, 0, 0.03]}>
      {/* Base — smooth rounded disc */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.14, 0.16, 0.06, 12]} />
        <meshStandardMaterial color={COLORS.poleDark} {...MAT} roughness={0.7} />
      </mesh>

      {/* Main pole — smooth tapered cylinder */}
      <mesh position={[0, 0.52, 0]}>
        <cylinderGeometry args={[0.035, 0.055, 0.95, 10]} />
        <meshStandardMaterial color={COLORS.pole} {...MAT} roughness={0.7} />
      </mesh>

      {/* Cross beam — smooth */}
      <mesh position={[0, 0.96, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.028, 0.028, 0.58, 10]} />
        <meshStandardMaterial color={COLORS.pole} {...MAT} roughness={0.7} />
      </mesh>

      {/* Left glow tip — smooth sphere */}
      <mesh
        position={[-0.29, 0.96, 0]}
        ref={(el) => { if (el) tipRefs.current[0] = el; }}
      >
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial
          color={COLORS.electricGlow}
          emissive={COLORS.electric}
          emissiveIntensity={0.5}
          roughness={0.2}
        />
      </mesh>

      {/* Right glow tip */}
      <mesh
        position={[0.29, 0.96, 0]}
        ref={(el) => { if (el) tipRefs.current[1] = el; }}
      >
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial
          color={COLORS.electricGlow}
          emissive={COLORS.electric}
          emissiveIntensity={0.5}
          roughness={0.2}
        />
      </mesh>

      {/* Insulators — ceramic knobs on crossbeam */}
      <mesh position={[-0.2, 1.0, 0]}>
        <cylinderGeometry args={[0.02, 0.025, 0.04, 8]} />
        <meshStandardMaterial color="#e8e0d4" roughness={0.35} />
      </mesh>
      <mesh position={[0.2, 1.0, 0]}>
        <cylinderGeometry args={[0.02, 0.025, 0.04, 8]} />
        <meshStandardMaterial color="#e8e0d4" roughness={0.35} />
      </mesh>
    </group>
  );
}
