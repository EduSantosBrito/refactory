import { B, M } from "./palette";
import type { ModelProps } from "../colors";

/**
 * Personal Box — "The Crate"
 *
 * Inspired by Minecraft/Valheim's charming small chests.
 * Compact box with a hinged lid (slightly ajar),
 * metal carry handle, and front clasp. Portable, personal.
 *
 * FLOW: items → small storage (no belt ports — manual access)
 *
 * Silhouette: tiny cube with protruding handle — distinctly small.
 */

/* ── Dimensions ── */
const PAD_H = 0.01;
const PAD_Y = PAD_H / 2;
const BOX_W = 0.20;
const BOX_H = 0.12;
const BOX_D = 0.16;
const BOX_Y = PAD_H + BOX_H / 2;
const LID_H = 0.025;
const LID_Y = PAD_H + BOX_H;

export function PersonalBox(props: ModelProps) {
  return (
    <group {...props}>
      {/* ── Ground pad ── */}
      <mesh position={[0, PAD_Y, 0]}>
        <boxGeometry args={[BOX_W + 0.03, PAD_H, BOX_D + 0.02]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
      </mesh>

      {/* ── Box body — warm wooden feel ── */}
      <group position={[0, BOX_Y, 0]}>
        {/* Main body */}
        <mesh>
          <boxGeometry args={[BOX_W, BOX_H, BOX_D]} />
          <meshStandardMaterial color={B.bright} roughness={0.85} metalness={0} flatShading />
        </mesh>

        {/* Bottom frame */}
        <mesh position={[0, -BOX_H / 2 + 0.008, 0]}>
          <boxGeometry args={[BOX_W + 0.01, 0.015, BOX_D + 0.01]} />
          <meshStandardMaterial color={B.mid} roughness={0.9} metalness={0} flatShading />
        </mesh>

        {/* Top frame (under lid) */}
        <mesh position={[0, BOX_H / 2 - 0.005, 0]}>
          <boxGeometry args={[BOX_W + 0.005, 0.008, BOX_D + 0.005]} />
          <meshStandardMaterial color={B.mid} roughness={0.9} metalness={0} flatShading />
        </mesh>

        {/* Metal corner straps — front & back vertical bands */}
        {[-1, 1].map((side) => (
          <mesh key={`strap-${side}`} position={[side * (BOX_W / 2 - 0.005), 0, 0]}>
            <boxGeometry args={[0.008, BOX_H + 0.01, BOX_D + 0.005]} />
            <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
          </mesh>
        ))}

        {/* Center metal band (horizontal) */}
        <mesh position={[0, -0.01, 0]}>
          <boxGeometry args={[BOX_W + 0.008, 0.012, BOX_D + 0.008]} />
          <meshStandardMaterial color={B.light} {...M} roughness={0.55} />
        </mesh>
      </group>

      {/* ── Lid — slightly ajar (hinged at back) ── */}
      <group position={[0, LID_Y, -BOX_D / 2 + 0.01]} rotation={[-0.08, 0, 0]}>
        {/* Lid panel */}
        <mesh position={[0, LID_H / 2, BOX_D / 2 - 0.01]}>
          <boxGeometry args={[BOX_W - 0.005, LID_H, BOX_D - 0.005]} />
          <meshStandardMaterial color={B.bright} roughness={0.85} metalness={0} flatShading />
        </mesh>

        {/* Lid top detail — slightly raised center plank */}
        <mesh position={[0, LID_H + 0.004, BOX_D / 2 - 0.01]}>
          <boxGeometry args={[BOX_W * 0.6, 0.006, BOX_D * 0.5]} />
          <meshStandardMaterial color={B.mid} roughness={0.9} metalness={0} flatShading />
        </mesh>

        {/* Hinge hardware (2 small cylinders at back edge) */}
        {[-0.05, 0.05].map((x, i) => (
          <mesh key={`hinge-${i}`} position={[x, 0.008, 0.005]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.006, 0.006, 0.025, 6]} />
            <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
          </mesh>
        ))}
      </group>

      {/* ── Front Clasp — metal latch ── */}
      <group position={[0, BOX_Y + 0.02, BOX_D / 2 + 0.005]}>
        {/* Clasp plate */}
        <mesh>
          <boxGeometry args={[0.035, 0.03, 0.01]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
        </mesh>
        {/* Clasp toggle */}
        <mesh position={[0, -0.008, 0.008]}>
          <boxGeometry args={[0.018, 0.015, 0.012]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.5} />
        </mesh>
      </group>

      {/* ── Carry Handle — arched metal bar on top ── */}
      <group position={[0, LID_Y + LID_H + 0.01, 0]}>
        {/* Handle posts */}
        {[-1, 1].map((side) => (
          <mesh key={`hpost-${side}`} position={[side * 0.04, 0, 0]}>
            <boxGeometry args={[0.008, 0.02, 0.012]} />
            <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
          </mesh>
        ))}
        {/* Handle bar */}
        <mesh position={[0, 0.015, 0]}>
          <boxGeometry args={[0.09, 0.008, 0.012]} />
          <meshStandardMaterial color={B.light} {...M} roughness={0.55} />
        </mesh>
        {/* Handle grip wrap */}
        <mesh position={[0, 0.015, 0]}>
          <boxGeometry args={[0.05, 0.012, 0.016]} />
          <meshStandardMaterial color={B.mid} roughness={0.85} metalness={0} />
        </mesh>
      </group>
    </group>
  );
}
