import { COLORS } from "../colors";
import { B, M } from "../building/palette";
import type { BeltPort, PortFacing } from "./types";

/* ── Port dock colors ──────────────────────────────────────── */

/** Input port — orange, matches belt rail accent */
const INPUT_COLOR = B.accent; // #e8945a

/** Output port — mint/teal, warm/cool contrast */
const OUTPUT_COLOR = COLORS.processor; // #5ec4b6

/** Dark recess */
const VOID_COLOR = "#1a1e2a";

/* ── Dock dimensions ───────────────────────────────────────── */

/**
 * Compact indicator on the building face.
 * NOT belt-width — just a small color-coded marker showing
 * where belts connect. The belt geometry itself provides
 * the visual bridge through proximity and end-caps.
 */
const FRAME_W = 0.16;
const FRAME_H = 0.12;
const FRAME_D = 0.025;

const VOID_W = 0.10;
const VOID_H = 0.07;

/* ── Facing → Y-axis rotation ──────────────────────────────── */

const FACING_ROTATION: Record<PortFacing, number> = {
  east: 0,
  north: Math.PI / 2,
  west: Math.PI,
  south: -Math.PI / 2,
};

/* ── Highlight state ───────────────────────────────────────── */

export type PortHighlight =
  | "normal"
  | "available"
  | "selected"
  | "hovering"
  | "incompatible";

interface HighlightStyle {
  opacity: number;
  emissive: number;
}

const HIGHLIGHT_STYLES: Record<PortHighlight, HighlightStyle> = {
  normal: { opacity: 1.0, emissive: 0.12 },
  available: { opacity: 1.0, emissive: 0.4 },
  selected: { opacity: 1.0, emissive: 0.6 },
  hovering: { opacity: 1.0, emissive: 0.9 },
  incompatible: { opacity: 0.15, emissive: 0 },
};

/* ── Component ─────────────────────────────────────────────── */

export interface PortDockProps {
  /** Port definition (position, facing, role) */
  port: BeltPort;
  /** Whether a belt is currently connected to this port */
  connected?: boolean;
  /** Highlight state for placement feedback */
  highlight?: PortHighlight;
}

/**
 * Compact port indicator on a building face.
 *
 * A small color-coded marker (orange = input, teal = output)
 * showing where belts connect. Deliberately small — the belt
 * geometry itself provides the visual connection through
 * proximity and end-caps. This just marks the spot.
 */
export function PortDock({
  port,
  connected = false,
  highlight = "normal",
}: PortDockProps) {
  const color = port.role === "input" ? INPUT_COLOR : OUTPUT_COLOR;
  const rotY = FACING_ROTATION[port.facing];
  const style = HIGHLIGHT_STYLES[highlight];

  const opacity = connected && highlight === "normal" ? 0.3 : style.opacity;
  const emissive = style.emissive;
  const isTransparent = opacity < 1;

  return (
    <group position={port.position} rotation={[0, rotY, 0]}>
      {/* Color-coded frame — the primary visual indicator */}
      <mesh position={[FRAME_D / 2, 0, 0]}>
        <boxGeometry args={[FRAME_D, FRAME_H, FRAME_W]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissive}
          transparent={isTransparent}
          opacity={opacity}
          {...M}
          roughness={0.45}
        />
      </mesh>

      {/* Dark recessed opening */}
      <mesh position={[-0.002, 0, 0]}>
        <boxGeometry args={[0.01, VOID_H, VOID_W]} />
        <meshStandardMaterial color={VOID_COLOR} {...M} roughness={0.8} />
      </mesh>

      {/* Outer bracket */}
      <mesh position={[FRAME_D + 0.004, 0, 0]}>
        <boxGeometry args={[0.008, FRAME_H + 0.02, FRAME_W + 0.02]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
      </mesh>
    </group>
  );
}
