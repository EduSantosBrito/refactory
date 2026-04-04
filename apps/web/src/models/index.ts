export { PlayerAvatar } from "./PlayerAvatar";
export { IronNode } from "./IronNode";
export { CopperNode } from "./CopperNode";
export { Smelter } from "./Smelter";
export { Processor } from "./Processor";
export { ConveyorBelt, ConveyorBeltLane } from "./ConveyorBelt";
export type {
  BeltContent,
  BeltState,
  BeltVariant,
  ConveyorBeltLaneProps,
  ConveyorBeltProps,
  ConveyorLaneItem,
  ConveyorLaneSegment,
} from "./ConveyorBelt";
export { BELT_TILE } from "./ConveyorBelt";
export { ConveyorBeltCurved } from "./ConveyorBeltCurved";
export type { ConveyorBeltCurvedProps } from "./ConveyorBeltCurved";

/* ── New modular belt system ─────────────────────────────── */
export {
  BeltSegment,
  BeltCurve,
  BeltChain,
  STRAIGHT_PORTS,
  CURVE_PORTS,
  MINER_PORTS,
  SMELTER_PORTS,
  PROCESSOR_PORTS,
  SPLITTER_PORTS,
  MERGER_PORTS,
  MODULAR_STORAGE_PORTS,
  canConnect,
} from "./belt";
export type {
  BeltPort,
  BeltPowerState,
  BeltContentState,
  BeltSegmentType,
  BeltSegmentProps,
  ChainSegment,
  ChainItem,
  BuildingPorts,
  BeltChainProps,
} from "./belt";

export { ModularStorage } from "./ModularStorage";
export { Burner } from "./Burner";
export { PowerPole } from "./PowerPole";
export { StatusPole } from "./StatusPole";
export type { StatusPoleStatus } from "./StatusPole";
export { WindTurbine } from "./WindTurbine";
export { MechLeg } from "./MechLeg";
export { MinerLeg } from "./MinerLeg";
export { MinerFoundation } from "./MinerFoundation";
export { Miner } from "./Miner";
export { Rocket } from "./Rocket";
export { Antenna } from "./Antenna";
export {
  OakTree,
  DetailedTree,
  PineTree,
  FlatTopTree,
  Flower,
  Bush,
  GrassClump,
  Rock,
  Campfire,
  TreeStump,
} from "./nature";
