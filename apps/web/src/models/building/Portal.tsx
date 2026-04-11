import { useFrame } from "@react-three/fiber";
import { memo, useRef } from "react";
import { type Group, Mesh, type MeshStandardMaterial } from "three";
import { Select } from "../../components/OutlineProvider";
import { useOutlineHover } from "../../hooks/useOutlineHover";
import type { ModelProps } from "../colors";
import { B, M } from "./palette";

/**
 * Portal — Vibe Jam 2026 Webring Gateway
 *
 * A vertical portal ring for traversing between games in the jam webring.
 */

/* ── Portal type colors ── */
const PORTAL_COLORS = {
  entry: {
    accent: "#40d8e8",
    glow: "#80f0ff",
    energy: "#20b0c0",
  },
  exit: {
    accent: "#e8945a",
    glow: "#ffd080",
    energy: "#f0a842",
  },
} as const;

/* ── Dimensions ── */
const SIDES = 24;
const RING_RADIUS = 1.2;
const RING_TUBE = 0.15;
const RING_CENTER_Y = 1.3;
const GLOW_RING_TUBE = 0.05;
const CORE_RADIUS = RING_RADIUS - RING_TUBE - 0.08;

type PortalType = "entry" | "exit";

type PortalProps = ModelProps & {
  type: PortalType;
  active?: boolean;
};

export const Portal = memo(function Portal({
  type,
  active = true,
  onClick,
  onPointerOver,
  onPointerOut,
  ...props
}: PortalProps) {
  const colors = PORTAL_COLORS[type];
  const { groupRef, hovered, pointerEvents } = useOutlineHover({
    onPointerOver,
    onPointerOut,
  });
  const energyRef = useRef<Mesh>(null);
  const glowRingRef = useRef<Mesh>(null);
  const accentNodesRef = useRef<Mesh[]>([]);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!active) return;
    timeRef.current += delta;
    const t = timeRef.current;

    if (energyRef.current) {
      energyRef.current.rotation.z = t * 0.5;
      const pulse = 1 + Math.sin(t * 3) * 0.03;
      energyRef.current.scale.setScalar(pulse);
    }

    if (glowRingRef.current?.material) {
      const mat = glowRingRef.current.material as MeshStandardMaterial;
      mat.emissiveIntensity = 0.8 + Math.sin(t * 2) * 0.4;
    }

    for (const mesh of accentNodesRef.current) {
      if (mesh?.material) {
        const mat = mesh.material as MeshStandardMaterial;
        mat.emissiveIntensity = 0.6 + Math.sin(t * 4 + Math.random() * 0.1) * 0.3;
      }
    }
  });

  const addAccentRef = (mesh: Mesh | null) => {
    if (mesh && !accentNodesRef.current.includes(mesh)) {
      accentNodesRef.current.push(mesh);
    }
  };

  return (
    <Select enabled={hovered}>
      <group ref={groupRef} onClick={onClick} {...props} {...pointerEvents}>
        {/* Dedicated interaction mesh to avoid child-mesh hover churn */}
        <mesh visible={false} userData={{ isHitArea: true }}>
          <cylinderGeometry
            args={[RING_RADIUS + 0.5, 0.8, RING_CENTER_Y * 2 + 0.5, 16]}
          />
          <meshBasicMaterial />
        </mesh>
      {/* Base platform */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.5, 0.55, 0.08, SIDES]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.58, 0.62, 0.02, SIDES]} />
        <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
      </mesh>

      {/* VERTICAL PORTAL RING */}
      <group position={[0, RING_CENTER_Y, 0]}>
        {/* Main ring frame */}
        <mesh>
          <torusGeometry args={[RING_RADIUS, RING_TUBE, 16, SIDES]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.5} />
        </mesh>

        {/* Outer accent ring */}
        <mesh>
          <torusGeometry args={[RING_RADIUS + RING_TUBE + 0.02, 0.03, 12, SIDES]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
        </mesh>

        {/* Inner accent ring */}
        <mesh>
          <torusGeometry args={[RING_RADIUS - RING_TUBE - 0.02, 0.025, 12, SIDES]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
        </mesh>

        {/* Glowing inner ring */}
        <mesh ref={glowRingRef}>
          <torusGeometry args={[RING_RADIUS - 0.05, GLOW_RING_TUBE, 12, SIDES]} />
          <meshStandardMaterial
            color={colors.glow}
            emissive={colors.glow}
            emissiveIntensity={0.8}
            {...M}
            roughness={0.3}
            transparent
            opacity={0.9}
          />
        </mesh>

        {/* Decorative nodes at cardinal points */}
        {[0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2;
          const nodeRadius = RING_RADIUS + RING_TUBE + 0.06;
          return (
            <mesh
              key={`node-${i}`}
              ref={addAccentRef}
              position={[
                Math.cos(angle) * nodeRadius,
                Math.sin(angle) * nodeRadius,
                0,
              ]}
            >
              <sphereGeometry args={[0.07, 8, 8]} />
              <meshStandardMaterial
                color={colors.accent}
                emissive={colors.accent}
                emissiveIntensity={0.6}
                {...M}
                roughness={0.4}
              />
            </mesh>
          );
        })}

        {/* Energy core */}
        <group>
          <mesh ref={energyRef}>
            <circleGeometry args={[CORE_RADIUS, SIDES]} />
            <meshStandardMaterial
              color={colors.energy}
              emissive={colors.energy}
              emissiveIntensity={0.5}
              {...M}
              roughness={0.2}
              transparent
              opacity={0.7}
              side={2}
            />
          </mesh>

          {/* Swirl layers */}
          {[0.7, 0.5, 0.3].map((factor, i) => (
            <mesh
              key={`swirl-${i}`}
              position={[0, 0, 0.02 * (i + 1)]}
              rotation={[0, 0, (i * Math.PI) / 3]}
            >
              <ringGeometry args={[CORE_RADIUS * factor - 0.08, CORE_RADIUS * factor, SIDES]} />
              <meshStandardMaterial
                color={colors.glow}
                emissive={colors.glow}
                emissiveIntensity={0.4 + i * 0.2}
                {...M}
                roughness={0.2}
                transparent
                opacity={0.5 - i * 0.1}
                side={2}
              />
            </mesh>
          ))}

          {/* Central glow */}
          <mesh position={[0, 0, 0.03]}>
            <sphereGeometry args={[0.12, 12, 12]} />
            <meshStandardMaterial
              color={colors.glow}
              emissive={colors.glow}
              emissiveIntensity={1.2}
              {...M}
              roughness={0.1}
              transparent
              opacity={0.8}
            />
          </mesh>
        </group>
      </group>

      {/* Top indicator */}
      <mesh position={[0, RING_CENTER_Y + RING_RADIUS + RING_TUBE + 0.1, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial
          color={colors.accent}
          emissive={colors.accent}
          emissiveIntensity={0.5}
          {...M}
          roughness={0.4}
        />
        </mesh>
      </group>
    </Select>
  );
});
