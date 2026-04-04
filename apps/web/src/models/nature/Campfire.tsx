import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { SphereGeometry } from "three";
import type { Mesh, MeshStandardMaterial } from "three";
import { COLORS, STONE_MAT, type ModelProps } from "../colors";

const stoneGeo = new SphereGeometry(0.03, 6, 5);

const STONE_COUNT = 7;
const RING_RADIUS = 0.08;
const STONE_POSITIONS = Array.from({ length: STONE_COUNT }, (_, i) => {
  const angle = (i / STONE_COUNT) * Math.PI * 2;
  return [Math.cos(angle) * RING_RADIUS, 0.02, Math.sin(angle) * RING_RADIUS] as const;
});

/**
 * Ring of stones with warm center glow. Matches kenney campfire_stones:
 * small rounded stones arranged in a circle with a cozy fire glow.
 */
export const Campfire = memo(function Campfire({ lit = true, ...props }: ModelProps & { lit?: boolean }) {
  const glowRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (!glowRef.current || !lit) return;
    const mat = glowRef.current.material as MeshStandardMaterial;
    mat.emissiveIntensity = 0.5 + Math.sin(state.clock.getElapsedTime() * 3.5) * 0.25;
  });

  return (
    <group {...props}>
      {/* Stone ring */}
      {STONE_POSITIONS.map((pos, i) => (
        <mesh
          key={i}
          geometry={stoneGeo}
          position={pos}
          scale={[1, 0.7, 1]}
        >
          <meshStandardMaterial
            color={i % 2 === 0 ? COLORS.stone : COLORS.stoneDark}
            {...STONE_MAT}
          />
        </mesh>
      ))}

      {/* Center glow */}
      {lit && (
        <mesh ref={glowRef} position={[0, 0.025, 0]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshStandardMaterial
            color={COLORS.glow}
            emissive={COLORS.glow}
            emissiveIntensity={0.6}
            roughness={0.3}
          />
        </mesh>
      )}
    </group>
  );
});
