import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshStandardMaterial } from "three";
import { B, M } from "./palette";
import { MechLeg } from "../MechLeg";
import type { ModelProps } from "../colors";
import { COLORS } from "../colors";

/**
 * Ore Smelter — Satisfactory-inspired Industrial Smelter
 *
 * Based on Satisfactory's Smelter: a rectangular furnace body
 * with a TALL offset smokestack as THE signature silhouette.
 * Glowing furnace mouth on front face shows internal heat.
 * Conveyor I/O on opposite sides. Heavy industrial bands.
 *
 * FLOW: ore input (+X) -> furnace chamber -> ingot output (-X)
 * SILHOUETTE: boxy furnace + tall chimney = unmistakable smelter
 */

/* ── Dimensions ── */
const LEG_H = 0.15;
const FOUND_H = 0.04;
const FOUND_Y = LEG_H + FOUND_H / 2;

/* Furnace body — rectangular, longer on Z (throughput axis is X) */
const BODY_W = 0.38;
const BODY_D = 0.46;
const BODY_H = 0.28;
const BODY_Y = LEG_H + FOUND_H + BODY_H / 2;
const BODY_TOP = LEG_H + FOUND_H + BODY_H;

/* Chimney — THE signature element, tall and prominent */
const CHIMNEY_R = 0.05;
const CHIMNEY_H = 0.30;
const CHIMNEY_X = 0.07;
const CHIMNEY_Z = -0.10;

export function OreSmelter(props: ModelProps) {
  const glowRef = useRef<Mesh>(null);

  useFrame(() => {
    if (!glowRef.current) return;
    const mat = glowRef.current.material as MeshStandardMaterial;
    mat.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.003) * 0.35;
  });

  return (
    <group {...props}>
      {/* ═══════════════════════════════════════════
          1. FOUNDATION — wide grounded platform
          ═══════════════════════════════════════════ */}
      <group position={[0, FOUND_Y, 0]}>
        <mesh>
          <boxGeometry args={[BODY_W + 0.08, FOUND_H, BODY_D + 0.06]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
        <mesh position={[0, -FOUND_H / 2 + 0.005, 0]}>
          <boxGeometry args={[BODY_W + 0.10, 0.01, BODY_D + 0.08]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>

        {([[-1, -1], [-1, 1], [1, -1], [1, 1]] as const).map(([sx, sz], i) => (
          <group key={i} position={[sx * 0.20, 0, sz * 0.22]}>
            <MechLeg direction={Math.atan2(sx, sz)} size="md" />
          </group>
        ))}
      </group>

      {/* ═══════════════════════════════════════════
          2. FURNACE BODY — the dominant rectangular mass
          ═══════════════════════════════════════════ */}
      <group position={[0, BODY_Y, 0]}>
        {/* Main furnace volume — smelter orange */}
        <mesh>
          <boxGeometry args={[BODY_W, BODY_H, BODY_D]} />
          <meshStandardMaterial color={COLORS.smelterDark} {...M} roughness={0.5} />
        </mesh>

        {/* Bottom structural band — heavy grey frame */}
        <mesh position={[0, -BODY_H / 2 + 0.015, 0]}>
          <boxGeometry args={[BODY_W + 0.018, 0.03, BODY_D + 0.018]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>

        {/* Top structural band */}
        <mesh position={[0, BODY_H / 2 - 0.015, 0]}>
          <boxGeometry args={[BODY_W + 0.018, 0.03, BODY_D + 0.018]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>

        {/* Mid horizontal seam — breaks body into upper/lower panels */}
        <mesh position={[0, -0.02, 0]}>
          <boxGeometry args={[BODY_W + 0.006, 0.008, BODY_D + 0.006]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>

        {/* 3x Reinforcing ribs per long side (+-Z) */}
        {[-1, 1].map((side) =>
          [-1, 0, 1].map((pos) => (
            <mesh
              key={`rib-${side}-${pos}`}
              position={[pos * 0.10, 0, side * (BODY_D / 2 + 0.005)]}
            >
              <boxGeometry args={[0.02, BODY_H * 0.7, 0.01]} />
              <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
            </mesh>
          )),
        )}

        {/* Panel detail — recessed panels on sides (+-X) */}
        {[-1, 1].map((side) => (
          <mesh key={`panel-${side}`} position={[side * (BODY_W / 2 + 0.004), 0.02, 0]}>
            <boxGeometry args={[0.008, BODY_H * 0.45, BODY_D * 0.55]} />
            <meshStandardMaterial color={B.light} {...M} roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* ═══════════════════════════════════════════
          3. FURNACE MOUTH — glowing front face (+Z)
          ═══════════════════════════════════════════ */}
      <group position={[0, BODY_Y - 0.01, BODY_D / 2 + 0.005]}>
        {/* Mouth frame — thick dark arch surround */}
        <mesh>
          <boxGeometry args={[0.18, 0.16, 0.014]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.7} />
        </mesh>
        {/* Inner glow — the fire */}
        <mesh ref={glowRef} position={[0, 0, 0.006]}>
          <boxGeometry args={[0.13, 0.11, 0.008]} />
          <meshStandardMaterial
            color={COLORS.smelter}
            emissive={COLORS.smelter}
            emissiveIntensity={0.5}
            {...M}
            roughness={0.3}
          />
        </mesh>
        {/* 3x Grate bars */}
        {[-1, 0, 1].map((row) => (
          <mesh key={`gbar-${row}`} position={[0, row * 0.032, 0.012]}>
            <boxGeometry args={[0.14, 0.008, 0.006]} />
            <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
          </mesh>
        ))}
      </group>

      {/* ═══════════════════════════════════════════
          4. INPUT PORT — ore intake (+X side)
          ═══════════════════════════════════════════ */}
      <group position={[BODY_W / 2 + 0.008, BODY_Y - 0.03, 0]}>
        <mesh>
          <boxGeometry args={[0.02, 0.12, 0.14]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>
        <mesh position={[0.007, 0, 0]}>
          <boxGeometry args={[0.012, 0.08, 0.10]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
        {/* Input indicator stripe — accent orange */}
        <mesh position={[0.014, 0.065, 0]}>
          <boxGeometry args={[0.008, 0.012, 0.14]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.5} />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════════
          5. OUTPUT PORT — ingot output (-X side)
          ═══════════════════════════════════════════ */}
      <group position={[-BODY_W / 2 - 0.008, BODY_Y - 0.03, 0]}>
        <mesh>
          <boxGeometry args={[0.02, 0.12, 0.14]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>
        <mesh position={[-0.007, 0, 0]}>
          <boxGeometry args={[0.012, 0.08, 0.10]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
        {/* Output indicator — warm emissive for hot ingots */}
        <mesh position={[-0.014, 0.065, 0]}>
          <boxGeometry args={[0.008, 0.012, 0.14]} />
          <meshStandardMaterial
            color={COLORS.smelterLight}
            emissive={COLORS.smelter}
            emissiveIntensity={0.15}
            {...M}
            roughness={0.45}
          />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════════
          6. SMOKESTACK — THE signature silhouette element
          Tall, offset to back-right. This is what makes
          it read as "smelter" from any angle.
          ═══════════════════════════════════════════ */}
      <group position={[CHIMNEY_X, BODY_TOP, CHIMNEY_Z]}>
        {/* Base collar — transition from body to chimney */}
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[CHIMNEY_R + 0.018, CHIMNEY_R + 0.028, 0.04, 8]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>

        {/* Main chimney pipe — tall! */}
        <mesh position={[0, CHIMNEY_H / 2 + 0.04, 0]}>
          <cylinderGeometry args={[CHIMNEY_R, CHIMNEY_R + 0.006, CHIMNEY_H, 8]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
        </mesh>

        {/* Heat band — lower third, accent color */}
        <mesh position={[0, CHIMNEY_H * 0.3 + 0.04, 0]}>
          <cylinderGeometry args={[CHIMNEY_R + 0.008, CHIMNEY_R + 0.008, 0.02, 8]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.5} />
        </mesh>

        {/* Heat band — upper */}
        <mesh position={[0, CHIMNEY_H * 0.7 + 0.04, 0]}>
          <cylinderGeometry args={[CHIMNEY_R + 0.006, CHIMNEY_R + 0.006, 0.015, 8]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.5} />
        </mesh>

        {/* Flared lip at top */}
        <mesh position={[0, CHIMNEY_H + 0.04, 0]}>
          <cylinderGeometry args={[CHIMNEY_R + 0.018, CHIMNEY_R, 0.025, 8]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
        </mesh>

        {/* Rain cap */}
        <mesh position={[0, CHIMNEY_H + 0.06, 0]}>
          <cylinderGeometry args={[CHIMNEY_R + 0.025, CHIMNEY_R + 0.025, 0.008, 8]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════════
          7. TOP CAP — flat roof with vent slats
          ═══════════════════════════════════════════ */}
      <group position={[0, BODY_TOP, 0]}>
        {/* Roof plate */}
        <mesh position={[0, 0.005, 0]}>
          <boxGeometry args={[BODY_W + 0.01, 0.01, BODY_D + 0.01]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>

        {/* 3x Vent slats near front-left */}
        {[0, 1, 2].map((i) => (
          <mesh key={`tvent-${i}`} position={[-0.10 + i * 0.04, 0.015, 0.12]}>
            <boxGeometry args={[0.025, 0.006, 0.06]} />
            <meshStandardMaterial color={B.light} {...M} roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* ═══════════════════════════════════════════
          8. BACK PANEL — status indicator + piping
          ═══════════════════════════════════════════ */}
      {/* Status panel */}
      <group position={[-0.10, BODY_Y + BODY_H * 0.25, -BODY_D / 2 - 0.006]}>
        <mesh>
          <boxGeometry args={[0.06, 0.04, 0.008]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, -0.005]}>
          <boxGeometry args={[0.04, 0.025, 0.004]} />
          <meshStandardMaterial color={COLORS.smelterLight} {...M} roughness={0.45} />
        </mesh>
      </group>

      {/* Back pipe run — horizontal */}
      <mesh position={[0, BODY_Y + BODY_H * 0.1, -BODY_D / 2 - 0.012]}>
        <boxGeometry args={[BODY_W * 0.7, 0.016, 0.016]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
      </mesh>
    </group>
  );
}
