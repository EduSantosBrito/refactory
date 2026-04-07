import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color } from "three";
import type { Mesh, MeshStandardMaterial } from "three";
import { COLORS, MAT, type ModelProps } from "./colors";
import { StatusPole } from "./StatusPole";
import type { StatusPoleStatus } from "./StatusPole";

/**
 * Industrial power pole — Satisfactory-inspired stacked hub
 * with a readable T-shape crossbeam silhouette.
 *
 * Stepped octagonal base, tapered shaft with structural rings,
 * connector hub with accent band, bracket-mounted crossbeam,
 * insulator stacks, and a top cap.
 */

/* ── Local palette ────────────────────────────────────────── */
const HULL_DARK = "#2d3550";
const HULL_MID = "#4a4f5a";
const HULL_LIGHT = "#8a8e95";
const ACCENT = "#d49040";
const INSULATOR_DARK = "#2a2a2e";
const INSULATOR_CERAMIC = "#e8e0d4";

const COLOR_CERAMIC = new Color(INSULATOR_CERAMIC);
const COLOR_GLOW = new Color(COLORS.electricGlow);
const LERP_SPEED = 3;

const SPARKS_PER_INSULATOR = 3;
const SPARK_CHANCE = 0.12; // chance per spark per frame to appear
const SPARK_RANGE = 0.06; // how far sparks scatter from insulator center
const SPARK_LIFE = 80; // ms a spark stays visible

type PowerPoleStatus = Extract<StatusPoleStatus, "green" | "red">;

type PowerPoleProps = ModelProps & {
  status?: PowerPoleStatus;
};

export function PowerPole({
  status = "green",
  ...props
}: PowerPoleProps) {
  const energized = status === "green";
  const ceramicRefs = useRef<Mesh[]>([]);
  const sparkRefs = useRef<Mesh[]>([]);
  const sparkTimers = useMemo(
    () => new Float64Array(2 * SPARKS_PER_INSULATOR),
    [],
  );
  const progress = useRef(0);

  useFrame((_, delta) => {
    const target = energized ? 1 : 0;
    progress.current += (target - progress.current) * Math.min(delta * LERP_SPEED, 1);
    const t = progress.current;
    const now = Date.now();

    /* ── Ceramic glow ───────────────────────── */
    ceramicRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const mat = mesh.material as MeshStandardMaterial;

      mat.color.copy(COLOR_CERAMIC).lerp(COLOR_GLOW, t);
      mat.emissive.copy(COLOR_CERAMIC).lerp(COLOR_GLOW, t);

      const flicker =
        0.6
        + Math.sin(now * 0.006 + i * 3) * 0.25
        + Math.sin(now * 0.017 + i * 5) * 0.15;
      mat.emissiveIntensity = t * flicker * 2.4;
      mat.toneMapped = t < 0.5;
    });

    /* ── Sparks ─────────────────────────────── */
    sparkRefs.current.forEach((spark, i) => {
      if (!spark) return;
      if (t < 0.3) {
        spark.visible = false;
        return;
      }
      const age = now - sparkTimers[i];
      if (age > SPARK_LIFE) {
        if (Math.random() < SPARK_CHANCE) {
          sparkTimers[i] = now;
          spark.visible = true;
          spark.position.x = (Math.random() - 0.5) * SPARK_RANGE;
          spark.position.y = (Math.random() - 0.5) * SPARK_RANGE;
          spark.position.z = (Math.random() - 0.5) * SPARK_RANGE;
          spark.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI,
          );
          const s = 0.4 + Math.random() * 0.6;
          spark.scale.set(s, s * (1.5 + Math.random() * 2), s);
        } else {
          spark.visible = false;
        }
      }
    });
  });

  return (
    <group {...props}>
      {/* ── Stepped base platform ─────────────────────────── */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.20, 0.24, 0.04, 8]} />
        <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.15, 0.20, 0.02, 8]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.11, 0.15, 0.02, 8]} />
        <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.6} />
      </mesh>
      {/* Accent ring */}
      <mesh position={[0, 0.035, 0]}>
        <cylinderGeometry args={[0.205, 0.225, 0.012, 8]} />
        <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
      </mesh>

      {/* ── Main shaft — tapered octagonal cylinder ───────── */}
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.035, 0.06, 0.74, 8]} />
        <meshStandardMaterial color={COLORS.pole} {...MAT} roughness={0.7} />
      </mesh>
      {/* Structural ring — lower */}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.055, 0.058, 0.025, 8]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
      </mesh>
      {/* Structural ring — mid */}
      <mesh position={[0, 0.50, 0]}>
        <cylinderGeometry args={[0.042, 0.046, 0.025, 8]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
      </mesh>

      {/* ── Connector hub — wider collar at crossbeam junction */}
      <mesh position={[0, 0.82, 0]}>
        <cylinderGeometry args={[0.06, 0.065, 0.10, 8]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
      </mesh>
      {/* Orange accent band */}
      <mesh position={[0, 0.83, 0]}>
        <cylinderGeometry args={[0.066, 0.068, 0.03, 8]} />
        <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
      </mesh>

      {/* ── Crossbeam — chunky horizontal bar ─────────────── */}
      <mesh position={[0, 0.86, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.03, 0.56, 8]} />
        <meshStandardMaterial color={COLORS.pole} {...MAT} roughness={0.65} />
      </mesh>
      {/* Mounting bracket — left */}
      <mesh position={[-0.04, 0.86, 0]}>
        <boxGeometry args={[0.03, 0.055, 0.04]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
      </mesh>
      {/* Mounting bracket — right */}
      <mesh position={[0.04, 0.86, 0]}>
        <boxGeometry args={[0.03, 0.055, 0.04]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
      </mesh>

      {/* ── Insulator stacks ──────────────────────────────── */}
      {([-0.18, 0.18] as const).map((x, idx) => (
        <group key={x} position={[x, 0.89, 0]}>
          {/* Dark rubber base */}
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.024, 0.028, 0.022, 8]} />
            <meshStandardMaterial
              color={INSULATOR_DARK}
              {...MAT}
              roughness={0.8}
            />
          </mesh>
          {/* Ceramic middle — glows when energized */}
          <mesh
            position={[0, 0.02, 0]}
            ref={(el) => {
              if (el) ceramicRefs.current[idx] = el;
            }}
          >
            <cylinderGeometry args={[0.026, 0.030, 0.024, 8]} />
            <meshStandardMaterial
              color={INSULATOR_CERAMIC}
              emissive={INSULATOR_CERAMIC}
              emissiveIntensity={0}
              roughness={0.35}
            />
          </mesh>
          {/* Dark rubber top */}
          <mesh position={[0, 0.038, 0]}>
            <cylinderGeometry args={[0.016, 0.020, 0.018, 8]} />
            <meshStandardMaterial
              color={INSULATOR_DARK}
              {...MAT}
              roughness={0.8}
            />
          </mesh>
          {/* Sparks */}
          {Array.from({ length: SPARKS_PER_INSULATOR }, (_, si) => (
            <mesh
              key={si}
              visible={false}
              position={[0, 0.02, 0]}
              ref={(el) => {
                if (el) sparkRefs.current[idx * SPARKS_PER_INSULATOR + si] = el;
              }}
            >
              <boxGeometry args={[0.008, 0.022, 0.004]} />
              <meshStandardMaterial
                color={COLORS.electricGlow}
                emissive={COLORS.electricGlow}
                emissiveIntensity={4}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* ── Top cap — mushroom finial ─────────────────────── */}
      <mesh position={[0, 0.91, 0]}>
        <cylinderGeometry args={[0.05, 0.042, 0.03, 8]} />
        <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.93, 0]}>
        <sphereGeometry args={[0.022, 8, 6]} />
        <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.35} />
      </mesh>

      {/* ── Status pole ───────────────────────────────────── */}
      <StatusPole position={[0, 0.95, 0]} scale={0.3} status={status} />
    </group>
  );
}
