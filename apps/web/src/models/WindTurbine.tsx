import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { MAT, type ModelProps } from "./colors";
import { StatusPole } from "./StatusPole";
import type { StatusPoleStatus } from "./StatusPole";

const FAN_SPEED = 1.8;
const BLADE_COUNT = 3;
const BODY_ROTATION = Math.PI / 4;

// Dark industrial palette matching the space-base buildings
const HULL_DARK = "#2d3550";
const HULL_MID = "#4a4f5a";
const HULL_LIGHT = "#8a8e95";
const ACCENT = "#d49040";
const BLADE_COLOR = "#b0b4ba";

type WindTurbineProps = ModelProps & {
  status?: StatusPoleStatus;
  statusPoleX?: number;
  statusPoleY?: number;
  statusPoleZ?: number;
};

export function WindTurbine({
  status = "green",
  statusPoleX = 0.15,
  statusPoleY = 0.89,
  statusPoleZ = 0,
  ...props
}: WindTurbineProps) {
  const rotorRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!rotorRef.current) return;
    rotorRef.current.rotation.x -= delta * FAN_SPEED;
  });

  return (
    <group {...props}>
      <group rotation={[0, BODY_ROTATION, 0]}>
        {/* Stepped base platform */}
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.22, 0.26, 0.04, 8]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.18, 0.22, 0.02, 8]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.65} />
        </mesh>
        <mesh position={[0, 0.07, 0]}>
          <cylinderGeometry args={[0.14, 0.18, 0.02, 8]} />
          <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.6} />
        </mesh>
        {/* Orange accent ring */}
        <mesh position={[0, 0.035, 0]}>
          <cylinderGeometry args={[0.225, 0.245, 0.012, 8]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>

        {/* Tower */}
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.04, 0.08, 0.66, 8]} />
          <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.55} />
        </mesh>
        {/* Structural ring details */}
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.065, 0.07, 0.025, 8]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.05, 0.055, 0.025, 8]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
        </mesh>

        {/* Nacelle */}
        <group position={[0, 0.8, 0]}>
          {/* Main housing */}
          <mesh position={[0.08, 0, 0]}>
            <boxGeometry args={[0.26, 0.13, 0.14]} />
            <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
          </mesh>
          {/* Top cap */}
          <mesh position={[0.08, 0.06, 0]}>
            <boxGeometry args={[0.24, 0.02, 0.12]} />
            <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
          </mesh>
          {/* Orange accent stripe */}
          <mesh position={[0.08, -0.035, 0]}>
            <boxGeometry args={[0.265, 0.018, 0.145]} />
            <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
          </mesh>
          {/* Rear vent */}
          <mesh position={[0.22, 0, 0]}>
            <boxGeometry args={[0.05, 0.1, 0.16]} />
            <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
          </mesh>
          {/* Front connector */}
          <mesh position={[-0.07, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.055, 0.065, 0.08, 8]} />
            <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.55} />
          </mesh>
        </group>

        {/* Rotor */}
        <group ref={rotorRef} position={[-0.12, 0.8, 0]}>
          <mesh>
            <sphereGeometry args={[0.05, 10, 8]} />
            <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
          </mesh>

          {Array.from({ length: BLADE_COUNT }, (_, index) => {
            const angle = (index / BLADE_COUNT) * Math.PI * 2;
            return (
              <group key={index} rotation={[angle, 0, 0]}>
                <mesh position={[0, 0.25, 0]}>
                  <boxGeometry args={[0.035, 0.44, 0.065]} />
                  <meshStandardMaterial color={BLADE_COLOR} {...MAT} roughness={0.45} />
                </mesh>
              </group>
            );
          })}
        </group>

        <StatusPole
          position={[statusPoleX, statusPoleY, statusPoleZ]}
          scale={0.3}
          status={status}
        />
      </group>
    </group>
  );
}
