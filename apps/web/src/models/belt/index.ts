/* ── Belt segment components ─────────────────────────────── */

export type { BeltChainProps } from "./BeltChain";
export {
  BeltChain,
  computeChainPath,
  getChainPosition,
  getSegmentLocalPosition,
} from "./BeltChain";
export { BeltCurve, CURVE_PORTS } from "./BeltCurve";
export { BeltSegment, STRAIGHT_PORTS } from "./BeltSegment";
export type { MinerPortDockProps } from "./MinerPortDock";
export { MinerPortDock } from "./MinerPortDock";
export type { PortHighlight } from "./PortDock";
export { PortDock } from "./PortDock";

/* ── Constants ───────────────────────────────────────────── */

export {
  BELT_COLORS,
  BELT_MAT,
  BELT_SPEED,
  BELT_TARGET_ITEM_SPACING,
  BELT_TILE,
  CURVE_ARC_LENGTH,
  DEFAULT_BELT_RATE_PER_MINUTE,
  FRAME_W,
  getBeltLoopItemCount,
  resolveBeltSpeed,
  SURFACE_W,
} from "./constants";

/* ── Types ───────────────────────────────────────────────── */

export type {
  BeltContentState,
  BeltEndCap,
  BeltPort,
  BeltPowerState,
  BeltSegmentProps,
  BeltSegmentType,
  BuildingPorts,
  ChainItem,
  ChainPath,
  ChainPosition,
  ChainSegment,
  CurveTurn,
  PortFacing,
  PortRole,
} from "./types";

export { canConnect, OPPOSITE_FACING, PORT_NORMALS } from "./types";

/* ── Building port definitions ───────────────────────────── */

export {
  MERGER_PORTS,
  MINER_PORTS,
  MODULAR_STORAGE_PORTS,
  PROCESSOR_PORTS,
  SMELTER_PORTS,
  SPLITTER_PORTS,
} from "./ports";
