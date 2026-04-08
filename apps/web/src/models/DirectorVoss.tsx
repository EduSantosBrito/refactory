import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";
import { MeshStandardMaterial } from "three";
import type { ModelProps } from "./colors";

/* ═══════════════════════════════════════════════════════════════
   DirectorVoss — Mechanical corporate executive figure

   A compact hard-surface humanoid in a suit. Broad shoulders,
   stable stance, shortened proportions. No face — only a narrow
   warm-emissive visor slit. Professional, controlled, slightly
   uncanny. A corporate human representative that may not be
   fully human.

   FORM:  chunky limbs → wide pelvis → layered suit torso →
          broad pauldron shoulders → mounted neck → visor head
   STYLE: beveled panels, segmented joints, recessed seams,
          restrained mechanical detail
   ═══════════════════════════════════════════════════════════════ */

/* ── Palette ─────────────────────────────────────────────────── */
const V = {
  suit: "#d8d4cf", // warm off-white body
  suitLight: "#e4e0dc", // highlight panels / lapels
  suitDark: "#b5b0aa", // trim / inset / seams
  joint: "#484650", // dark charcoal joints
  jointMid: "#5c5962", // mid-tone joint detail
  accent: "#5a7090", // muted steel blue — tie, shoulder marks
  accentDark: "#486078", // deeper accent
  visor: "#f0a842", // warm amber visor
  sole: "#3a3840", // shoe/foot undersurface
} as const;

/* ── Shared material props ───────────────────────────────────── */
const M = { roughness: 0.55, metalness: 0.05 } as const;
const MJ = { roughness: 0.65, metalness: 0.08 } as const; // joints

/* ── Stance ──────────────────────────────────────────────────── */
const LX = 0.058; // leg offset from center
const AX = 0.13; // arm offset from center

/* ── Segment heights (bottom-up Y centers) ───────────────────── */
const FOOT_CY = 0.012;
const SHIN_CY = 0.068;
const KNEE_CY = 0.115;
const THIGH_CY = 0.158;
const PELVIS_CY = 0.21;
const TORSO_CY = 0.315;
const SHOULDER_CY = 0.385;
const NECK_CY = 0.41;
const HEAD_CY = 0.47;

export function DirectorVoss(props: ModelProps) {
  const visorRef = useRef<Mesh>(null);

  useFrame(() => {
    if (!visorRef.current) return;
    const t = Date.now() * 0.002;
    const mat = visorRef.current.material as MeshStandardMaterial;
    mat.emissiveIntensity = 0.7 + Math.sin(t) * 0.25;
  });

  return (
    <group {...props}>
      {/* ═══════════════════════════════════════
          1. FEET — chunky shoe blocks
          ═══════════════════════════════════════ */}
      {[-1, 1].map((side) => (
        <group key={`foot-${side}`} position={[side * LX, FOOT_CY, 0]}>
          <mesh>
            <boxGeometry args={[0.058, 0.024, 0.078]} />
            <meshStandardMaterial color={V.sole} {...M} roughness={0.7} />
          </mesh>
          {/* Shoe cap — raised toe block */}
          <mesh position={[0, 0.004, 0.02]}>
            <boxGeometry args={[0.052, 0.018, 0.035]} />
            <meshStandardMaterial color={V.joint} {...MJ} />
          </mesh>
        </group>
      ))}

      {/* ═══════════════════════════════════════
          2. LOWER LEGS — segmented shins
          ═══════════════════════════════════════ */}
      {[-1, 1].map((side) => (
        <group key={`shin-${side}`} position={[side * LX, 0, 0]}>
          {/* Main shaft */}
          <mesh position={[0, SHIN_CY, 0]}>
            <boxGeometry args={[0.046, 0.088, 0.046]} />
            <meshStandardMaterial color={V.suit} {...M} />
          </mesh>
          {/* Ankle ring */}
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[0.053, 0.012, 0.053]} />
            <meshStandardMaterial color={V.joint} {...MJ} />
          </mesh>
          {/* Front shin panel (recessed inset) */}
          <mesh position={[0, SHIN_CY + 0.005, 0.024]}>
            <boxGeometry args={[0.032, 0.05, 0.005]} />
            <meshStandardMaterial color={V.suitDark} {...M} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* ═══════════════════════════════════════
          3. KNEE JOINTS — dark connector bands
          ═══════════════════════════════════════ */}
      {[-1, 1].map((side) => (
        <group key={`knee-${side}`} position={[side * LX, KNEE_CY, 0]}>
          <mesh>
            <boxGeometry args={[0.054, 0.016, 0.054]} />
            <meshStandardMaterial color={V.joint} {...MJ} />
          </mesh>
          {/* Inner pivot disc */}
          <mesh>
            <cylinderGeometry args={[0.016, 0.016, 0.018, 6]} />
            <meshStandardMaterial color={V.jointMid} {...MJ} />
          </mesh>
        </group>
      ))}

      {/* ═══════════════════════════════════════
          4. UPPER LEGS — thighs
          ═══════════════════════════════════════ */}
      {[-1, 1].map((side) => (
        <group key={`thigh-${side}`} position={[side * LX, THIGH_CY, 0]}>
          <mesh>
            <boxGeometry args={[0.052, 0.07, 0.052]} />
            <meshStandardMaterial color={V.suit} {...M} />
          </mesh>
          {/* Outer seam groove */}
          <mesh position={[side * 0.027, 0, 0]}>
            <boxGeometry args={[0.005, 0.045, 0.038]} />
            <meshStandardMaterial color={V.suitDark} {...M} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* ═══════════════════════════════════════
          5. PELVIS — wide transitional block
          ═══════════════════════════════════════ */}
      <group position={[0, PELVIS_CY, 0]}>
        <mesh>
          <boxGeometry args={[0.17, 0.042, 0.12]} />
          <meshStandardMaterial color={V.suitDark} {...M} roughness={0.6} />
        </mesh>
        {/* Belt line */}
        <mesh position={[0, 0.017, 0]}>
          <boxGeometry args={[0.175, 0.01, 0.125]} />
          <meshStandardMaterial color={V.joint} {...MJ} />
        </mesh>
        {/* Belt buckle */}
        <mesh position={[0, 0.017, 0.063]}>
          <boxGeometry args={[0.02, 0.012, 0.005]} />
          <meshStandardMaterial color={V.jointMid} {...MJ} />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════
          6. TORSO — layered suit jacket (main mass)
          ═══════════════════════════════════════ */}
      <group position={[0, TORSO_CY, 0]}>
        {/* Core torso block */}
        <mesh>
          <boxGeometry args={[0.20, 0.155, 0.13]} />
          <meshStandardMaterial color={V.suit} {...M} />
        </mesh>
        {/* Shoulder transition plate (wider) */}
        <mesh position={[0, 0.065, 0]}>
          <boxGeometry args={[0.215, 0.025, 0.135]} />
          <meshStandardMaterial color={V.suitLight} {...M} />
        </mesh>
        {/* Jacket hem — bottom trim */}
        <mesh position={[0, -0.078, 0]}>
          <boxGeometry args={[0.205, 0.012, 0.135]} />
          <meshStandardMaterial color={V.suitDark} {...M} roughness={0.6} />
        </mesh>

        {/* ── Front: lapels + tie ── */}
        {/* Lapel panels */}
        {[-1, 1].map((side) => (
          <mesh key={`lapel-${side}`} position={[side * 0.058, 0.02, 0.066]}>
            <boxGeometry args={[0.052, 0.10, 0.008]} />
            <meshStandardMaterial color={V.suitLight} {...M} />
          </mesh>
        ))}
        {/* Recessed tie channel */}
        <mesh position={[0, 0.005, 0.064]}>
          <boxGeometry args={[0.032, 0.10, 0.012]} />
          <meshStandardMaterial color={V.accent} {...M} roughness={0.5} />
        </mesh>
        {/* Tie knot */}
        <mesh position={[0, 0.055, 0.07]}>
          <boxGeometry args={[0.02, 0.02, 0.008]} />
          <meshStandardMaterial color={V.accentDark} {...M} roughness={0.5} />
        </mesh>

        {/* ── Back: center seam ── */}
        <mesh position={[0, 0, -0.066]}>
          <boxGeometry args={[0.004, 0.12, 0.008]} />
          <meshStandardMaterial color={V.suitDark} {...M} roughness={0.6} />
        </mesh>

        {/* ── Sides: jacket vent slits ── */}
        {[-1, 1].map((side) => (
          <mesh
            key={`jacket-vent-${side}`}
            position={[side * 0.101, -0.025, -0.02]}
          >
            <boxGeometry args={[0.008, 0.055, 0.058]} />
            <meshStandardMaterial color={V.suitDark} {...M} roughness={0.6} />
          </mesh>
        ))}

        {/* ── Breast pocket accent (left chest) ── */}
        <mesh position={[-0.058, 0.04, 0.067]}>
          <boxGeometry args={[0.03, 0.018, 0.005]} />
          <meshStandardMaterial color={V.suitDark} {...M} roughness={0.6} />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════
          7. SHOULDERS — broad pauldron blocks
          ═══════════════════════════════════════ */}
      {[-1, 1].map((side) => (
        <group key={`shoulder-${side}`} position={[side * AX, SHOULDER_CY, 0]}>
          {/* Main pauldron */}
          <mesh>
            <boxGeometry args={[0.065, 0.035, 0.065]} />
            <meshStandardMaterial color={V.suit} {...M} />
          </mesh>
          {/* Top cap */}
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.07, 0.01, 0.07]} />
            <meshStandardMaterial color={V.suitLight} {...M} />
          </mesh>
          {/* Outer accent strip */}
          <mesh position={[side * 0.034, 0, 0]}>
            <boxGeometry args={[0.006, 0.026, 0.055]} />
            <meshStandardMaterial color={V.accent} {...M} roughness={0.5} />
          </mesh>
          {/* Joint mount disc (underneath) */}
          <mesh position={[0, -0.022, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.012, 6]} />
            <meshStandardMaterial color={V.joint} {...MJ} />
          </mesh>
        </group>
      ))}

      {/* ═══════════════════════════════════════
          8. UPPER ARMS
          ═══════════════════════════════════════ */}
      {[-1, 1].map((side) => (
        <group key={`upper-arm-${side}`} position={[side * AX, 0.34, 0]}>
          <mesh>
            <boxGeometry args={[0.044, 0.06, 0.044]} />
            <meshStandardMaterial color={V.suit} {...M} />
          </mesh>
          {/* Outer panel line */}
          <mesh position={[side * 0.023, 0, 0]}>
            <boxGeometry args={[0.005, 0.04, 0.034]} />
            <meshStandardMaterial color={V.suitDark} {...M} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* ═══════════════════════════════════════
          9. ELBOW JOINTS
          ═══════════════════════════════════════ */}
      {[-1, 1].map((side) => (
        <mesh key={`elbow-${side}`} position={[side * AX, 0.305, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.014, 6]} />
          <meshStandardMaterial color={V.joint} {...MJ} />
        </mesh>
      ))}

      {/* ═══════════════════════════════════════
          10. FOREARMS
          ═══════════════════════════════════════ */}
      {[-1, 1].map((side) => (
        <group key={`forearm-${side}`} position={[side * AX, 0.26, 0]}>
          <mesh>
            <boxGeometry args={[0.04, 0.075, 0.04]} />
            <meshStandardMaterial color={V.suit} {...M} />
          </mesh>
          {/* Cuff band */}
          <mesh position={[0, -0.032, 0]}>
            <boxGeometry args={[0.046, 0.014, 0.046]} />
            <meshStandardMaterial color={V.suitDark} {...M} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* ═══════════════════════════════════════
          11. HANDS — simple blocky forms
          ═══════════════════════════════════════ */}
      {[-1, 1].map((side) => (
        <mesh key={`hand-${side}`} position={[side * AX, 0.198, 0.005]}>
          <boxGeometry args={[0.032, 0.038, 0.025]} />
          <meshStandardMaterial color={V.jointMid} {...MJ} />
        </mesh>
      ))}

      {/* ═══════════════════════════════════════
          12. NECK — mounted cylinder connection
          ═══════════════════════════════════════ */}
      <group position={[0, NECK_CY, 0]}>
        {/* Neck shaft */}
        <mesh>
          <cylinderGeometry args={[0.028, 0.034, 0.028, 8]} />
          <meshStandardMaterial color={V.joint} {...MJ} />
        </mesh>
        {/* Collar ring (mounting flange) */}
        <mesh position={[0, -0.012, 0]}>
          <cylinderGeometry args={[0.042, 0.042, 0.008, 8]} />
          <meshStandardMaterial color={V.jointMid} {...MJ} />
        </mesh>
        {/* Upper collar ring */}
        <mesh position={[0, 0.012, 0]}>
          <cylinderGeometry args={[0.032, 0.03, 0.006, 8]} />
          <meshStandardMaterial color={V.jointMid} {...MJ} />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════
          13. HEAD — beveled box with visor slit
          ═══════════════════════════════════════ */}
      <group position={[0, HEAD_CY, 0]}>
        {/* Main cranium block */}
        <mesh>
          <boxGeometry args={[0.105, 0.095, 0.10]} />
          <meshStandardMaterial color={V.suit} {...M} />
        </mesh>
        {/* Top ridge cap */}
        <mesh position={[0, 0.044, 0]}>
          <boxGeometry args={[0.112, 0.014, 0.107]} />
          <meshStandardMaterial color={V.suitDark} {...M} roughness={0.6} />
        </mesh>
        {/* Brow overhang */}
        <mesh position={[0, 0.025, 0.04]}>
          <boxGeometry args={[0.098, 0.015, 0.03]} />
          <meshStandardMaterial color={V.suitDark} {...M} roughness={0.6} />
        </mesh>
        {/* Chin plate */}
        <mesh position={[0, -0.038, 0.012]}>
          <boxGeometry args={[0.078, 0.02, 0.08]} />
          <meshStandardMaterial color={V.suitDark} {...M} roughness={0.6} />
        </mesh>
        {/* Temporal side plates */}
        {[-1, 1].map((side) => (
          <mesh key={`temple-${side}`} position={[side * 0.054, 0.002, 0]}>
            <boxGeometry args={[0.008, 0.06, 0.082]} />
            <meshStandardMaterial color={V.suitDark} {...M} roughness={0.6} />
          </mesh>
        ))}

        {/* ── Face assembly ── */}
        {/* Smooth front face plate (inset) */}
        <mesh position={[0, 0.003, 0.048]}>
          <boxGeometry args={[0.085, 0.065, 0.012]} />
          <meshStandardMaterial color={V.suitLight} {...M} roughness={0.45} />
        </mesh>
        {/* Visor frame (dark recessed surround) */}
        <mesh position={[0, 0.008, 0.053]}>
          <boxGeometry args={[0.078, 0.024, 0.005]} />
          <meshStandardMaterial color={V.joint} {...MJ} />
        </mesh>
        {/* Visor slit — warm emissive (the only "face") */}
        <mesh ref={visorRef} position={[0, 0.008, 0.057]}>
          <boxGeometry args={[0.068, 0.014, 0.004]} />
          <meshStandardMaterial
            color={V.visor}
            emissive={V.visor}
            emissiveIntensity={0.7}
            {...M}
            roughness={0.25}
            metalness={0.1}
          />
        </mesh>

        {/* ── Back of head: recessed data port ── */}
        <mesh position={[0, 0.002, -0.051]}>
          <boxGeometry args={[0.04, 0.03, 0.006]} />
          <meshStandardMaterial color={V.joint} {...MJ} />
        </mesh>
        <mesh position={[0, 0.002, -0.049]}>
          <boxGeometry args={[0.03, 0.02, 0.004]} />
          <meshStandardMaterial color={V.jointMid} {...MJ} />
        </mesh>
      </group>
    </group>
  );
}
