import type { ReactNode } from "react";
import type { ModelProps } from "../colors";

/* ── Port system ─────────────────────────────────────────── */

/** Cardinal direction a port faces (outward from the building/belt) */
export type PortFacing = "north" | "south" | "east" | "west";

/** Port role: items enter through input, exit through output */
export type PortRole = "input" | "output";

/** A connection point on a building or belt segment */
export interface BeltPort {
  /** Unique identifier within the parent entity */
  id: string;
  /** Whether items enter or exit through this port */
  role: PortRole;
  /** Which face of the grid cell this port is on */
  facing: PortFacing;
  /** Local position relative to parent origin [x, y, z] */
  position: [number, number, number];
}

/** Outward normal for each port facing */
export const PORT_NORMALS: Record<PortFacing, [number, number, number]> = {
  north: [0, 0, -1],
  south: [0, 0, 1],
  east: [1, 0, 0],
  west: [-1, 0, 0],
};

/** Opposite facing for snap checking */
export const OPPOSITE_FACING: Record<PortFacing, PortFacing> = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
};

/**
 * Two ports can connect when:
 * 1. One is input, the other is output
 * 2. They face each other (opposite facings)
 */
export function canConnect(a: BeltPort, b: BeltPort): boolean {
  return a.role !== b.role && OPPOSITE_FACING[a.facing] === b.facing;
}

/* ── Belt states ─────────────────────────────────────────── */

/** Power state: running = animated, stopped = static */
export type BeltPowerState = "running" | "stopped";

/** Content state: empty = no items visible, filled = items shown */
export type BeltContentState = "empty" | "filled";

/* ── Segment types ───────────────────────────────────────── */

export type BeltSegmentType = "straight" | "curve";

/** Which end(s) get a termination bracket */
export type BeltEndCap = "start" | "end" | "both";

/** Props shared by BeltSegment and BeltCurve */
export interface BeltSegmentProps extends ModelProps {
  power?: BeltPowerState;
  content?: BeltContentState;
  ratePerMinute?: number;
  speed?: number;
  /** Render terminus bracket at start, end, or both ends */
  endCap?: BeltEndCap;
}

/* ── Chain types ──────────────────────────────────────────── */

/** A segment descriptor within a chain */
export interface ChainSegment {
  /** React key */
  key: string;
  /** Geometry type */
  type: BeltSegmentType;
  /** World position [x, y, z] */
  position: [number, number, number];
  /** Y-axis rotation in radians */
  rotationY: number;
  /** Travel distance along this segment's path */
  pathLength: number;
}

/** An item traveling on a belt chain */
export interface ChainItem {
  /** Unique identifier */
  id: string;
  /** Progress along chain: 0 = start, 1 = end */
  progress: number;
  /** Visual node to render */
  node: ReactNode;
  /** Vertical offset above belt surface (default 0.12) */
  heightOffset?: number;
}

/** Computed chain path data */
export interface ChainPath {
  /** Total travel distance across all segments */
  totalLength: number;
  /** Cumulative distance at the start of each segment */
  cumulativeLengths: number[];
}

/** World-space position and facing for an item on the chain */
export interface ChainPosition {
  x: number;
  y: number;
  z: number;
  /** Y rotation matching travel direction */
  facingY: number;
}

/* ── Building port definitions ───────────────────────────── */

/** Port layout for a building type */
export interface BuildingPorts {
  inputs: BeltPort[];
  outputs: BeltPort[];
}
