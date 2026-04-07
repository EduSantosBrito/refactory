import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshStandardMaterial } from "three";
import type { Mesh } from "three";
import { B, M } from "./palette";
import type { ModelProps } from "../colors";
import { StatusPole, type StatusPoleStatus } from "../StatusPole";

/* ── Chimney smoke — wispy rising plume ── */
const SMOKE_COUNT = 12;

/** Per-puff random drift stored at spawn time */
type PuffState = { driftX: number; driftZ: number; riseSpeed: number };

function ChimneySmoke() {
  const refs = useRef<Mesh[]>([]);
  const puffs = useRef<Map<number, PuffState>>(new Map());
  const nextSpawn = useRef(0);
  const nextIdx = useRef(0);

  useFrame(({ clock }, delta) => {
    for (let i = 0; i < refs.current.length; i++) {
      const smoke = refs.current[i]!;
      if (!smoke.visible) continue;
      const p = puffs.current.get(i);
      if (!p) continue;

      // Smooth growth
      smoke.scale.setScalar(smoke.scale.x + delta * 0.12);
      // Rise at per-puff speed
      smoke.position.y += delta * p.riseSpeed;
      // Per-puff lateral drift + gentle wobble
      smoke.position.x += delta * p.driftX;
      smoke.position.z += delta * p.driftZ + Math.sin(clock.elapsedTime * 0.6 + i) * delta * 0.003;

      if (smoke.material instanceof MeshStandardMaterial) {
        smoke.material.opacity = Math.max(0, smoke.material.opacity - delta * 0.07);
        if (smoke.material.opacity <= 0) {
          smoke.visible = false;
        }
      }
    }

    // Spawn new wisp
    if (clock.elapsedTime >= nextSpawn.current) {
      const idx = nextIdx.current % SMOKE_COUNT;
      const smoke = refs.current[idx];
      if (smoke) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.025;
        smoke.visible = true;
        smoke.scale.setScalar(0.8 + Math.random() * 0.6);
        smoke.position.set(
          Math.cos(angle) * r,
          0,
          Math.sin(angle) * r,
        );
        puffs.current.set(idx, {
          driftX: (Math.random() - 0.3) * 0.012,
          driftZ: (Math.random() - 0.5) * 0.008,
          riseSpeed: 0.025 + Math.random() * 0.02,
        });
        if (smoke.material instanceof MeshStandardMaterial) {
          smoke.material.opacity = 0.3 + Math.random() * 0.15;
        }
      }
      nextIdx.current = idx + 1;
      nextSpawn.current = clock.elapsedTime + 0.3 + Math.random() * 0.4;
    }
  });

  return (
    <group>
      {Array.from({ length: SMOKE_COUNT }, (_, i) => (
        <mesh
          key={`sm-${i}`}
          ref={(el) => {
            if (el) refs.current[i] = el;
          }}
          visible={false}
        >
          <sphereGeometry args={[0.03, 10, 8]} />
          <meshStandardMaterial
            color="#c0b8a8"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

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
const FOUND_HALF = 0.025;
const FOUND_Y = FOUND_HALF;
const BELLY_Y = FOUND_Y + FOUND_HALF + 0.13;
const CHIMNEY_BASE_Y = BELLY_Y + 0.06;

type BiomassBurnerProps = ModelProps & {
  status?: StatusPoleStatus;
};

export function BiomassBurner({ status = "green", ...props }: BiomassBurnerProps) {
  const glowActive = status === "green" || status === "yellow";
  const smokeActive = status === "green";

  const glowRef = useRef<Mesh>(null);
  const glowRef2 = useRef<Mesh>(null);

  useFrame(() => {
    if (!glowActive) {
      if (glowRef.current) {
        const mat = glowRef.current.material as MeshStandardMaterial;
        mat.emissiveIntensity = 0;
      }
      if (glowRef2.current) {
        const mat = glowRef2.current.material as MeshStandardMaterial;
        mat.emissiveIntensity = 0;
      }
      return;
    }
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

        {/* Smoke rising from chimney */}
        {smokeActive && (
          <group position={[0.012, 0.31, 0]}>
            <ChimneySmoke />
          </group>
        )}
      </group>

      {/* ── Air Blower — back left side ── */}
      <group position={[-0.16, BELLY_Y, -0.10]} rotation={[0, Math.PI * 0.7, 0]}>
        {/* Blower housing */}
        <mesh>
          <cylinderGeometry args={[0.05, 0.055, 0.04, 8]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
        {/* Intake pipe */}
        <mesh position={[0, 0.01, -0.04]}>
          <cylinderGeometry args={[0.025, 0.03, 0.04, 6]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.6} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
      </group>

      {/* ── StatusPole — on top of hopper ── */}
      <StatusPole position={[-0.10, BELLY_Y + 0.215, 0.08]} scale={0.2} status={status} />
    </group>
  );
}
