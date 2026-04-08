import { MAT } from "../colors";

/** Structural hull palette — shared across all modular buildings */
export const B = {
  dark: "#2d3550",
  mid: "#4a4f5a",
  light: "#8a8e95",
  bright: "#b0b4ba",
  accent: "#e8945a",
  red: "#c85050",
  redDark: "#a03838",
  warm: "#f0a842",
} as const;

/** Standard matte-plastic material props */
export const M = MAT;

/** Foundation half-height (plate + rims) */
export const FOUNDATION_HALF_H = 0.042;

/** Body height variants */
export type BodyHeight = "short" | "standard" | "tall";

/** Body half-height by variant */
export const BODY_HALF_H_MAP: Record<BodyHeight, number> = {
  short: 0.1,
  standard: 0.134,
  tall: 0.2,
};

/** Body half-height (standard) */
export const BODY_HALF_H = BODY_HALF_H_MAP.standard;

/** Leg-to-ground heights by MechLeg size */
export const LEG_H = { sm: 0.13, md: 0.21 } as const;
