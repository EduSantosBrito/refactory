/** Belt tile dimensions — 1×1 footprint on XZ, 0.4 tall */
export const BELT_TILE = { width: 1, depth: 1, height: 0.4 } as const;

/** Belt speed in world-units per second */
export const BELT_SPEED = 0.8;

/* ── Width dimensions (Z axis, belt travels along X) ─────── */

/** Belt surface width where items travel */
export const SURFACE_W = 0.65;
export const SURFACE_HALF_W = SURFACE_W / 2;

/** Frame padding on each side of surface */
export const FRAME_PAD = 0.06;

/** Total frame width */
export const FRAME_W = SURFACE_W + FRAME_PAD * 2; // 0.77

/** Side rail dimensions */
export const RAIL_W = FRAME_PAD;
export const RAIL_H = 0.035;

/** Base plate overhang beyond frame */
export const BASE_EXTEND = 0.04;
export const BASE_W = FRAME_W + BASE_EXTEND * 2; // 0.85
export const BASE_H = 0.05;

/** Accent stripe height from ground */
export const ACCENT_Y = BASE_H + 0.008;

/* ── Belt surface groove ────────────────────────────────── */

/** Groove density: visible groove lines per world-unit of travel */
export const GROOVE_DENSITY = 8;

/* ── Curve constants ─────────────────────────────────────── */

export const CURVE_SEGMENTS = 24;
export const CURVE_CENTER_R = 0.5;
export const CURVE_HALF_W = SURFACE_HALF_W;

/** Curve pivot at tile corner — belt arcs from -X face to -Z face */
export const CURVE_PIVOT_X = -0.5;
export const CURVE_PIVOT_Z = -0.5;

/** Arc: entry at π/2 (-X face), exit at 0 (-Z face) */
export const ARC_START = Math.PI / 2;
export const ARC_END = 0;

/** Derived radii */
export const CURVE_BELT_INNER = CURVE_CENTER_R - CURVE_HALF_W;
export const CURVE_BELT_OUTER = CURVE_CENTER_R + CURVE_HALF_W;
export const CURVE_FRAME_INNER = CURVE_BELT_INNER - FRAME_PAD;
export const CURVE_FRAME_OUTER = CURVE_BELT_OUTER + FRAME_PAD;

/** Arc length along center radius */
export const CURVE_ARC_LENGTH = CURVE_CENTER_R * (Math.PI / 2);

/* ── Color palette ───────────────────────────────────────── */

export const BELT_COLORS = {
  /** Belt surface (dark panel under scrolling grooves) */
  surface: "#2e2c38",
  /** Frame body */
  frame: "#4a4658",
  /** Side rails (orange accent) */
  rail: "#e8945a",
  /** Base plate */
  base: "#7a7690",
  /** End caps / brackets */
  cap: "#222028",
  /** Orange accent stripe */
  accent: "#e8945a",
} as const;

/* ── Material presets (PBR) ──────────────────────────────── */

export const BELT_MAT = {
  surface: { roughness: 0.7, metalness: 0 },
  frame: { roughness: 0.6, metalness: 0.05 },
  rail: { roughness: 0.4, metalness: 0.15 },
  base: { roughness: 0.5, metalness: 0.1 },
  cap: { roughness: 0.7, metalness: 0 },
  accent: { roughness: 0.5, metalness: 0 },
} as const;
