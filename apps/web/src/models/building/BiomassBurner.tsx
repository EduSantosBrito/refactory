import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshStandardMaterial } from "three";
import { B, M } from "./palette";
import { MechLeg } from "../MechLeg";
import type { ModelProps } from "../colors";

/**
 * Biomass Burner — "The Potbelly"
 *
 * Inspired by Deep Rock Galactic's chunky industrial furnaces.
 * Squat round belly with a side-mounted chimney, top fuel hopper,
 * and front-facing fire grate. Asymmetric, top-heavy silhouette.
 *
 * FLOW: fuel hopper (top) → burn chamber (belly) → exhaust (side chimney)
 */

/* ── Layer heights ── */
const LEG_H = 0.12;
const FOUND_HALF = 0.025;
const FOUND_Y = LEG_H + FOUND_HALF;
const BELLY_Y = FOUND_Y + FOUND_HALF + 0.13;
const CHIMNEY_BASE_Y = BELLY_Y + 0.06;

export function BiomassBurner(props: ModelProps) {
  const glowRef = useRef<Mesh>(null);
  const glowRef2 = useRef<Mesh>(null);

  useFrame(() => {
    const t = Date.now() * 0.004;
    if (glowRef.current) {
      const mat = glowRef.current.material as MeshStandardMaterial;
      mat.emissiveIntensity = 0.4 + Math.sin(t) * 0.3;
    }
    if (glowRef2.current) {
      const mat = glowRef2.current.material as MeshStandardMaterial;
      mat.emissiveIntensity = 0.3 + Math.sin(t * 1.3 + 1) * 0.25;
    }
  });

  return (
    <group {...props}>
      {/* ── Foundation — heavy octagonal pad ── */}
      <group position={[0, FOUND_Y, 0]}>
        <mesh>
          <cylinderGeometry args={[0.26, 0.30, 0.05, 8]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.03, 0]}>
          <cylinderGeometry args={[0.31, 0.33, 0.012, 8]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>

        {/* 3× Tripod legs — asymmetric energy */}
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
          return (
            <group key={`lg-${i}`} position={[Math.sin(a) * 0.20, 0, Math.cos(a) * 0.20]}>
              <MechLeg direction={a} size="sm" variant="rounded" />
            </group>
          );
        })}
      </group>

      {/* ── Belly — squashed sphere (the potbelly) ── */}
      <group position={[0, BELLY_Y, 0]}>
        {/* Main belly volume */}
        <mesh scale={[1, 0.75, 1]}>
          <sphereGeometry args={[0.20, 10, 8]} />
          <meshStandardMaterial color={B.bright} {...M} flatShading />
        </mesh>

        {/* Belly band — industrial strap around the middle */}
        <mesh position={[0, -0.02, 0]}>
          <torusGeometry args={[0.215, 0.012, 6, 10]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.6} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>

        {/* Lower collar — transition to foundation */}
        <mesh position={[0, -0.10, 0]}>
          <cylinderGeometry args={[0.17, 0.22, 0.04, 8]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>

        {/* Upper collar — transition to hopper */}
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.10, 0.16, 0.035, 8]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
      </group>

      {/* ── Fire Door — front-facing grate (INPUT visible) ── */}
      <group position={[0, BELLY_Y - 0.02, 0.19]}>
        {/* Door frame */}
        <mesh>
          <boxGeometry args={[0.12, 0.10, 0.02]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.7} />
        </mesh>
        {/* Grate glow */}
        <mesh ref={glowRef} position={[0, 0, 0.012]}>
          <boxGeometry args={[0.09, 0.07, 0.01]} />
          <meshStandardMaterial
            color="#f07830"
            emissive="#f07830"
            emissiveIntensity={0.5}
            {...M}
            roughness={0.3}
          />
        </mesh>
        {/* Grate bars — 3 horizontal */}
        {[-1, 0, 1].map((row) => (
          <mesh key={`bar-${row}`} position={[0, row * 0.025, 0.018]}>
            <boxGeometry args={[0.095, 0.006, 0.005]} />
            <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
          </mesh>
        ))}
        {/* Door hinges */}
        {[-1, 1].map((side) => (
          <mesh key={`hinge-${side}`} position={[side * 0.055, 0, 0.005]}>
            <cylinderGeometry args={[0.008, 0.008, 0.10, 6]} />
            <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
          </mesh>
        ))}
      </group>

      {/* ── Fuel Hopper — top funnel (where fuel goes in) ── */}
      <group position={[0, BELLY_Y + 0.16, 0]}>
        {/* Funnel — inverted cone */}
        <mesh>
          <cylinderGeometry args={[0.10, 0.06, 0.06, 8]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
        {/* Hopper rim */}
        <mesh position={[0, 0.035, 0]}>
          <cylinderGeometry args={[0.115, 0.105, 0.015, 8]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>
        {/* Inner glow (fuel burning below) */}
        <mesh ref={glowRef2} position={[0, 0.01, 0]}>
          <cylinderGeometry args={[0.05, 0.04, 0.02, 8]} />
          <meshStandardMaterial
            color={B.warm}
            emissive={B.warm}
            emissiveIntensity={0.3}
            {...M}
            roughness={0.4}
          />
        </mesh>
      </group>

      {/* ── Side Chimney — offset to the right (EXHAUST OUTPUT) ── */}
      <group position={[0.14, CHIMNEY_BASE_Y, 0]} rotation={[0, 0, -0.15]}>
        {/* Chimney collar (connects to body) */}
        <mesh position={[-0.02, 0, 0]} rotation={[0, 0, 0.15]}>
          <cylinderGeometry args={[0.055, 0.065, 0.04, 8]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>

        {/* Main chimney pipe */}
        <mesh position={[0.01, 0.14, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 0.26, 8]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
        </mesh>

        {/* Heat bands (2 rings around chimney) */}
        <mesh position={[0.005, 0.08, 0]} rotation={[0.15, 0, 0]}>
          <torusGeometry args={[0.052, 0.008, 6, 8]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.5} />
        </mesh>
        <mesh position={[0.01, 0.18, 0]} rotation={[-0.08, 0, 0]}>
          <torusGeometry args={[0.046, 0.007, 6, 8]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.5} />
        </mesh>

        {/* Chimney lip */}
        <mesh position={[0.012, 0.275, 0]}>
          <cylinderGeometry args={[0.055, 0.042, 0.02, 8]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
        </mesh>

        {/* Chimney cap (rain guard) */}
        <mesh position={[0.012, 0.30, 0]}>
          <cylinderGeometry args={[0.065, 0.065, 0.008, 8]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
        </mesh>
      </group>

      {/* ── Air Blower — back left side ── */}
      <group position={[-0.16, BELLY_Y, -0.10]} rotation={[0, Math.PI * 0.7, 0]}>
        {/* Blower housing */}
        <mesh>
          <cylinderGeometry args={[0.05, 0.055, 0.04, 8]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
        {/* Fan disc */}
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.005, 6]} />
          <meshStandardMaterial color={B.light} {...M} roughness={0.5} />
        </mesh>
        {/* Intake pipe */}
        <mesh position={[0, 0, -0.04]}>
          <cylinderGeometry args={[0.025, 0.03, 0.04, 6]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
        </mesh>
      </group>

      {/* ── Side Lamp — status indicator ── */}
      <group position={[-0.18, BELLY_Y + 0.08, 0.08]} rotation={[0, -Math.PI * 0.3, 0]}>
        <mesh>
          <boxGeometry args={[0.02, 0.02, 0.012]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <sphereGeometry args={[0.012, 8, 6]} />
          <meshStandardMaterial color={B.warm} {...M} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}
