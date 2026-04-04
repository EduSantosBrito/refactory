/* ── Belt segment components ─────────────────────────────── */

export { BeltSegment } from "./BeltSegment";
export { STRAIGHT_PORTS } from "./BeltSegment";

export { BeltCurve } from "./BeltCurve";
export { CURVE_PORTS } from "./BeltCurve";

export { BeltChain, getChainPosition, computeChainPath, getSegmentLocalPosition } from "./BeltChain";
export type { BeltChainProps } from "./BeltChain";

/* ── Constants ───────────────────────────────────────────── */

export {
  BELT_TILE,
  BELT_SPEED,
  SURFACE_W,
  FRAME_W,
  BELT_COLORS,
  BELT_MAT,
  CURVE_ARC_LENGTH,
} from "./constants";

/* ── Types ───────────────────────────────────────────────── */

export type {
  PortFacing,
  PortRole,
  BeltPort,
  BeltPowerState,
  BeltContentState,
  BeltSegmentType,
  BeltSegmentProps,
  ChainSegment,
  ChainItem,
  ChainPath,
  ChainPosition,
  BuildingPorts,
} from "./types";

export { PORT_NORMALS, OPPOSITE_FACING, canConnect } from "./types";

/* ── Building port definitions ───────────────────────────── */

export {
  MINER_PORTS,
  SMELTER_PORTS,
  PROCESSOR_PORTS,
  SPLITTER_PORTS,
  MERGER_PORTS,
  MODULAR_STORAGE_PORTS,
} from "./ports";
