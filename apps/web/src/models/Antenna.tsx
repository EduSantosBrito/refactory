import { useFrame } from "@react-three/fiber";
import { AtomRef } from "effect/unstable/reactivity";
import { useRef } from "react";
import type { Group } from "three";
import { MAT, type ModelProps } from "./colors";

const HULL_MID = "#4a4f5a";
const HULL_LIGHT = "#8a8e95";
const HULL_BRIGHT = "#b0b4ba";

type AntennaProps = ModelProps & {
  speed?: number;
};

export function Antenna({ speed = 0.5, ...props }: AntennaProps) {
  const ref = useRef<Group>(null);
  const rotationRef = useRef<AtomRef.AtomRef<number> | null>(null);

  if (rotationRef.current === null) {
    rotationRef.current = AtomRef.make(0);
  }

  const rotation = rotationRef.current;

  useFrame((_, delta) => {
    if (ref.current) {
      rotation.update((value) => value + delta * speed);
      ref.current.rotation.y = rotation.value;
    }
  });

  return (
    <group {...props}>
      {/* ── Mount base ─────────────────────────── */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.2, 0.3, 0.14, 8]} />
        <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.04, 8]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
      </mesh>

      {/* ── Rotating assembly ──────────────────── */}
      <group ref={ref} position={[0, 0.14, 0]}>
        {/* Pole */}
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.015, 0.022, 0.2, 6]} />
          <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.5} />
        </mesh>

        {/* Dish assembly — tilted, concave side faces up */}
        <group position={[0, 0.2, 0]} rotation={[0.5, 0, 0]}>
          {/* Dish (flipped cone — wide rim up) */}
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.18, 0.06, 12]} />
            <meshStandardMaterial
              color={HULL_BRIGHT}
              {...MAT}
              roughness={0.4}
              side={2}
            />
          </mesh>
          {/* Feed arm */}
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 0.12, 4]} />
            <meshStandardMaterial
              color={HULL_LIGHT}
              {...MAT}
              roughness={0.45}
            />
          </mesh>
          {/* Feed tip */}
          <mesh position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.01, 6, 4]} />
            <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
