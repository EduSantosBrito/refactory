export { PlayerAvatar } from "./PlayerAvatar";
export { ResourceNode } from "./ResourceNode";
export type { ResourceType, PurityTier, ResourceNodeProps } from "./ResourceNode";
export { NODE_MINER_OFFSET } from "./ResourceNode";
export { Smelter } from "./Smelter";
export { Processor } from "./Processor";

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
export { ModularBuilding } from "./building";
export type { TopModuleType, SideAttachmentDef, ModularBuildingProps, BodyHeight } from "./building";
export { BiomassBurner, OreSmelter, ProcessorUnit, ContainerStorage, PersonalBox } from "./building";
export {
  OakTree,
  DetailedTree,
  PineTree,
  FlatTopTree,
  DeadTree,
  Flower,
  Bush,
  GrassClump,
  Rock,
  RockFormation,
  Stump,
  Log,
  Mushroom,
} from "./nature";
