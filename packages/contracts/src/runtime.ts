import { Schema } from "effect";
import { AssetId, WorldMode } from "./worlds.ts";

export const NonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
export type NonNegativeInt = Schema.Schema.Type<typeof NonNegativeInt>;

export const PositiveInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));
export type PositiveInt = Schema.Schema.Type<typeof PositiveInt>;

export const NonNegativeFinite = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));
export type NonNegativeFinite = Schema.Schema.Type<typeof NonNegativeFinite>;

export const WorldId = Schema.String.check(Schema.isUUID());
export type WorldId = Schema.Schema.Type<typeof WorldId>;

export const WorldCommandRejectionCode = Schema.Literals([
  "access_denied",
  "container_full",
  "container_missing",
  "idempotency_conflict",
  "insufficient_items",
  "invalid_command",
   "invalid_location",
  "invalid_target",
  "item_not_accepted",
  "network_missing",
  "no_actor_inventory",
  "object_missing",
  "object_not_removable",
  "path_blocked",
  "port_occupied",
  "quota_storage_locked",
  "recipe_required",
  "unsupported_command",
]);
export type WorldCommandRejectionCode = Schema.Schema.Type<typeof WorldCommandRejectionCode>;

export const GridCoordinate = Schema.Struct({
  x: Schema.Int,
  y: Schema.Int,
});
export type GridCoordinate = Schema.Schema.Type<typeof GridCoordinate>;

export const Facing = Schema.Literals(["north", "east", "south", "west"]);
export type Facing = Schema.Schema.Type<typeof Facing>;

export const PortRole = Schema.Literals(["input", "output"]);
export type PortRole = Schema.Schema.Type<typeof PortRole>;

export const ContainerId = Schema.String.check(Schema.isMinLength(1));
export type ContainerId = Schema.Schema.Type<typeof ContainerId>;

export const MachineId = Schema.String.check(Schema.isMinLength(1));
export type MachineId = Schema.Schema.Type<typeof MachineId>;

export const LaneId = Schema.String.check(Schema.isMinLength(1));
export type LaneId = Schema.Schema.Type<typeof LaneId>;

export const RuntimeObjectId = Schema.String.check(Schema.isMinLength(1));
export type RuntimeObjectId = Schema.Schema.Type<typeof RuntimeObjectId>;

export const RuntimeItemStack = Schema.Struct({
  itemId: Schema.String.check(Schema.isMinLength(1)),
  quantity: PositiveInt,
});
export type RuntimeItemStack = Schema.Schema.Type<typeof RuntimeItemStack>;

export const RuntimeContainerOwner = Schema.Struct({
  actorPublicKey: Schema.optional(Schema.String),
  kind: Schema.Literals(["asset", "entity", "system"]),
  ownerId: Schema.String.check(Schema.isMinLength(1)),
  role: Schema.String.check(Schema.isMinLength(1)),
});
export type RuntimeContainerOwner = Schema.Schema.Type<typeof RuntimeContainerOwner>;

export const SlotContainerSlot = Schema.Struct({
  slotIndex: NonNegativeInt,
  stack: Schema.optional(RuntimeItemStack),
});
export type SlotContainerSlot = Schema.Schema.Type<typeof SlotContainerSlot>;

export const SlotContainer = Schema.Struct({
  _tag: Schema.Literal("SlotContainer"),
  containerId: ContainerId,
  owner: RuntimeContainerOwner,
  slotCount: PositiveInt,
  slots: Schema.Array(SlotContainerSlot),
});
export type SlotContainer = Schema.Schema.Type<typeof SlotContainer>;

export const TypedContainer = Schema.Struct({
  _tag: Schema.Literal("TypedContainer"),
  acceptedItemIds: Schema.Array(Schema.String.check(Schema.isMinLength(1))),
  capacity: Schema.optional(NonNegativeInt),
  containerId: ContainerId,
  entries: Schema.Array(RuntimeItemStack),
  owner: RuntimeContainerOwner,
});
export type TypedContainer = Schema.Schema.Type<typeof TypedContainer>;

export const RuntimeContainer = Schema.Union([SlotContainer, TypedContainer]);
export type RuntimeContainer = Schema.Schema.Type<typeof RuntimeContainer>;

export const RuntimeMachinePowerState = Schema.Literals(["connected", "disconnected", "unpowered"]);
export type RuntimeMachinePowerState = Schema.Schema.Type<typeof RuntimeMachinePowerState>;

export const RuntimeMachineStatus = Schema.Literals(["idle", "running", "blocked", "unpowered"]);
export type RuntimeMachineStatus = Schema.Schema.Type<typeof RuntimeMachineStatus>;

export const RuntimeMachine = Schema.Struct({
  inputContainerIds: Schema.Array(ContainerId),
  kind: Schema.String.check(Schema.isMinLength(1)),
  machineId: MachineId,
  networkId: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
  objectId: Schema.optional(RuntimeObjectId),
  outputContainerIds: Schema.Array(ContainerId),
  powerState: RuntimeMachinePowerState,
  progress: NonNegativeFinite,
  recipeId: Schema.optional(Schema.String),
  status: RuntimeMachineStatus,
});
export type RuntimeMachine = Schema.Schema.Type<typeof RuntimeMachine>;

export const RuntimeGeneratorStatus = Schema.Literals(["idle", "out_of_fuel", "running", "tripped"]);
export type RuntimeGeneratorStatus = Schema.Schema.Type<typeof RuntimeGeneratorStatus>;

export const RuntimeGenerator = Schema.Struct({
  currentOutputMw: NonNegativeFinite,
  fuelBurnProgress: NonNegativeFinite,
  fuelContainerId: ContainerId,
  generatorId: Schema.String.check(Schema.isMinLength(1)),
  kind: Schema.String.check(Schema.isMinLength(1)),
  maxCapacityMw: NonNegativeFinite,
  networkId: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
  objectId: RuntimeObjectId,
  powerRadius: NonNegativeInt,
  status: RuntimeGeneratorStatus,
});
export type RuntimeGenerator = Schema.Schema.Type<typeof RuntimeGenerator>;

export const RuntimePowerNetworkStatus = Schema.Literals(["energized", "tripped"]);
export type RuntimePowerNetworkStatus = Schema.Schema.Type<typeof RuntimePowerNetworkStatus>;

export const RuntimePowerNetwork = Schema.Struct({
  currentConsumption: NonNegativeFinite,
  currentProduction: NonNegativeFinite,
  energizedTiles: Schema.Array(GridCoordinate),
  maxPotentialCapacity: NonNegativeFinite,
  maxPotentialConsumption: NonNegativeFinite,
  memberObjectIds: Schema.Array(RuntimeObjectId),
  networkId: Schema.String.check(Schema.isMinLength(1)),
  restartRequested: Schema.Boolean,
  status: RuntimePowerNetworkStatus,
});
export type RuntimePowerNetwork = Schema.Schema.Type<typeof RuntimePowerNetwork>;

export const RuntimeLaneItem = Schema.Struct({
  itemId: Schema.String.check(Schema.isMinLength(1)),
  progress: NonNegativeFinite,
});
export type RuntimeLaneItem = Schema.Schema.Type<typeof RuntimeLaneItem>;

export const RuntimePathTile = Schema.Struct({
  altitude: Schema.Int,
  x: Schema.Int,
  y: Schema.Int,
});
export type RuntimePathTile = Schema.Schema.Type<typeof RuntimePathTile>;

export const RuntimeTransportLane = Schema.Struct({
  destinationObjectId: Schema.optional(RuntimeObjectId),
  destinationPortId: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
  destinationId: Schema.optional(ContainerId),
  itemSpacing: NonNegativeFinite,
  items: Schema.Array(RuntimeLaneItem),
  laneId: LaneId,
  length: NonNegativeFinite,
  pathTiles: Schema.optional(Schema.Array(RuntimePathTile)),
  sourceObjectId: Schema.optional(RuntimeObjectId),
  sourcePortId: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
  sourceId: Schema.optional(ContainerId),
  speed: NonNegativeFinite,
});
export type RuntimeTransportLane = Schema.Schema.Type<typeof RuntimeTransportLane>;

export const RuntimeMapTile = Schema.Struct({
  altitude: Schema.Int,
  buildable: Schema.Boolean,
  coordinate: GridCoordinate,
});
export type RuntimeMapTile = Schema.Schema.Type<typeof RuntimeMapTile>;

export const RuntimePlacedObject = Schema.Struct({
  buildableId: Schema.String.check(Schema.isMinLength(1)),
  containerIds: Schema.Array(ContainerId),
  fixed: Schema.Boolean,
  machineId: Schema.optional(MachineId),
  objectId: RuntimeObjectId,
  origin: GridCoordinate,
  removable: Schema.Boolean,
  resourceNodeId: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
  rotation: Schema.optional(Facing),
});
export type RuntimePlacedObject = Schema.Schema.Type<typeof RuntimePlacedObject>;

export const RuntimeBossChat = Schema.Struct({
  currentPhraseIndex: NonNegativeInt,
  introMessageId: Schema.Literals(["solo-intro", "multiplayer-intro"]),
  skipVotes: Schema.Array(Schema.String),
});
export type RuntimeBossChat = Schema.Schema.Type<typeof RuntimeBossChat>;

export const RuntimeDeliveryQuota = Schema.Struct({
  delivered: NonNegativeInt,
  itemId: Schema.String.check(Schema.isMinLength(1)),
  required: PositiveInt,
  reserved: NonNegativeInt,
});
export type RuntimeDeliveryQuota = Schema.Schema.Type<typeof RuntimeDeliveryQuota>;

export const RuntimeTutorialState = Schema.Struct({
  completedObjectiveIds: Schema.Array(Schema.String),
  currentObjectiveId: Schema.String,
  phase: Schema.Literal("bootstrap"),
  variant: WorldMode,
});
export type RuntimeTutorialState = Schema.Schema.Type<typeof RuntimeTutorialState>;

export const RuntimeObservers = Schema.Struct({
  bossChat: RuntimeBossChat,
  quota: Schema.Array(RuntimeDeliveryQuota),
  tutorial: RuntimeTutorialState,
});
export type RuntimeObservers = Schema.Schema.Type<typeof RuntimeObservers>;

export const RuntimeInventoryBinding = Schema.Struct({
  actorPublicKey: Schema.optional(Schema.String),
  assetId: AssetId,
  containerId: ContainerId,
});
export type RuntimeInventoryBinding = Schema.Schema.Type<typeof RuntimeInventoryBinding>;

export const WorldRuntimeSnapshot = Schema.Struct({
  containers: Schema.Array(RuntimeContainer),
  deltaSequence: NonNegativeInt,
  generators: Schema.Array(RuntimeGenerator),
  inventories: Schema.Array(RuntimeInventoryBinding),
  lastTickAt: Schema.String,
  machines: Schema.Array(RuntimeMachine),
  mode: WorldMode,
  observers: RuntimeObservers,
  objects: Schema.optional(Schema.Array(RuntimePlacedObject)),
  powerNetworks: Schema.Array(RuntimePowerNetwork),
  runtimeVersion: PositiveInt,
  tick: NonNegativeInt,
  tiles: Schema.optional(Schema.Array(RuntimeMapTile)),
  transportLanes: Schema.Array(RuntimeTransportLane),
  worldId: WorldId,
});
export type WorldRuntimeSnapshot = Schema.Schema.Type<typeof WorldRuntimeSnapshot>;

export const TickAdvancedChange = Schema.Struct({
  _tag: Schema.Literal("TickAdvanced"),
  processedCommandCount: NonNegativeInt,
  tick: NonNegativeInt,
});
export type TickAdvancedChange = Schema.Schema.Type<typeof TickAdvancedChange>;

export const ContainerChangedChange = Schema.Struct({
  _tag: Schema.Literal("ContainerChanged"),
  container: RuntimeContainer,
});
export type ContainerChangedChange = Schema.Schema.Type<typeof ContainerChangedChange>;

export const MachineChangedChange = Schema.Struct({
  _tag: Schema.Literal("MachineChanged"),
  machine: RuntimeMachine,
});
export type MachineChangedChange = Schema.Schema.Type<typeof MachineChangedChange>;

export const MachineRemovedChange = Schema.Struct({
  _tag: Schema.Literal("MachineRemoved"),
  machineId: MachineId,
});
export type MachineRemovedChange = Schema.Schema.Type<typeof MachineRemovedChange>;

export const GeneratorChangedChange = Schema.Struct({
  _tag: Schema.Literal("GeneratorChanged"),
  generator: RuntimeGenerator,
});
export type GeneratorChangedChange = Schema.Schema.Type<typeof GeneratorChangedChange>;

export const GeneratorRemovedChange = Schema.Struct({
  _tag: Schema.Literal("GeneratorRemoved"),
  generatorId: Schema.String.check(Schema.isMinLength(1)),
});
export type GeneratorRemovedChange = Schema.Schema.Type<typeof GeneratorRemovedChange>;

export const PowerNetworkChangedChange = Schema.Struct({
  _tag: Schema.Literal("PowerNetworkChanged"),
  network: RuntimePowerNetwork,
});
export type PowerNetworkChangedChange = Schema.Schema.Type<typeof PowerNetworkChangedChange>;

export const PowerNetworkRemovedChange = Schema.Struct({
  _tag: Schema.Literal("PowerNetworkRemoved"),
  networkId: Schema.String.check(Schema.isMinLength(1)),
});
export type PowerNetworkRemovedChange = Schema.Schema.Type<typeof PowerNetworkRemovedChange>;

export const TransportLaneChangedChange = Schema.Struct({
  _tag: Schema.Literal("TransportLaneChanged"),
  lane: RuntimeTransportLane,
});
export type TransportLaneChangedChange = Schema.Schema.Type<typeof TransportLaneChangedChange>;

export const TransportLaneRemovedChange = Schema.Struct({
  _tag: Schema.Literal("TransportLaneRemoved"),
  laneId: LaneId,
});
export type TransportLaneRemovedChange = Schema.Schema.Type<typeof TransportLaneRemovedChange>;

export const RuntimeObjectChangedChange = Schema.Struct({
  _tag: Schema.Literal("RuntimeObjectChanged"),
  object: RuntimePlacedObject,
});
export type RuntimeObjectChangedChange = Schema.Schema.Type<typeof RuntimeObjectChangedChange>;

export const RuntimeObjectRemovedChange = Schema.Struct({
  _tag: Schema.Literal("RuntimeObjectRemoved"),
  objectId: RuntimeObjectId,
});
export type RuntimeObjectRemovedChange = Schema.Schema.Type<typeof RuntimeObjectRemovedChange>;

export const ContainerRemovedChange = Schema.Struct({
  _tag: Schema.Literal("ContainerRemoved"),
  containerId: ContainerId,
});
export type ContainerRemovedChange = Schema.Schema.Type<typeof ContainerRemovedChange>;

export const ObserversChangedChange = Schema.Struct({
  _tag: Schema.Literal("ObserversChanged"),
  observers: RuntimeObservers,
});
export type ObserversChangedChange = Schema.Schema.Type<typeof ObserversChangedChange>;

export const CommandProcessedChange = Schema.Struct({
  _tag: Schema.Literal("CommandProcessed"),
  commandId: Schema.String.check(Schema.isUUID()),
  message: Schema.optional(Schema.String),
  reasonCode: Schema.optional(WorldCommandRejectionCode),
  status: Schema.Literals(["accepted", "rejected"]),
});
export type CommandProcessedChange = Schema.Schema.Type<typeof CommandProcessedChange>;

export const WorldRuntimeChange = Schema.Union([
  TickAdvancedChange,
  ContainerChangedChange,
  ContainerRemovedChange,
  GeneratorChangedChange,
  GeneratorRemovedChange,
  MachineChangedChange,
  MachineRemovedChange,
  ObserversChangedChange,
  PowerNetworkChangedChange,
  PowerNetworkRemovedChange,
  CommandProcessedChange,
  RuntimeObjectChangedChange,
  RuntimeObjectRemovedChange,
  TransportLaneChangedChange,
  TransportLaneRemovedChange,
]);
export type WorldRuntimeChange = Schema.Schema.Type<typeof WorldRuntimeChange>;

export const WorldRuntimeDelta = Schema.Struct({
  changes: Schema.Array(WorldRuntimeChange),
  deltaSequence: NonNegativeInt,
  tick: NonNegativeInt,
  worldId: WorldId,
});
export type WorldRuntimeDelta = Schema.Schema.Type<typeof WorldRuntimeDelta>;

export const WorldRuntimeSnapshotMessage = Schema.Struct({
  _tag: Schema.Literal("WorldRuntimeSnapshotMessage"),
  snapshot: WorldRuntimeSnapshot,
});
export type WorldRuntimeSnapshotMessage = Schema.Schema.Type<typeof WorldRuntimeSnapshotMessage>;

export const WorldRuntimeDeltaMessage = Schema.Struct({
  _tag: Schema.Literal("WorldRuntimeDeltaMessage"),
  delta: WorldRuntimeDelta,
});
export type WorldRuntimeDeltaMessage = Schema.Schema.Type<typeof WorldRuntimeDeltaMessage>;

export const WorldRuntimeMessage = Schema.Union([WorldRuntimeSnapshotMessage, WorldRuntimeDeltaMessage]);
export type WorldRuntimeMessage = Schema.Schema.Type<typeof WorldRuntimeMessage>;

export const GetWorldRuntimeResponse = Schema.Struct({
  snapshot: WorldRuntimeSnapshot,
});
export type GetWorldRuntimeResponse = Schema.Schema.Type<typeof GetWorldRuntimeResponse>;

export const WorldRuntimeCheckpoint = Schema.Struct({
  savedAt: Schema.String,
  snapshot: WorldRuntimeSnapshot,
});
export type WorldRuntimeCheckpoint = Schema.Schema.Type<typeof WorldRuntimeCheckpoint>;

export const GetWorldRuntimeCheckpointResponse = Schema.Struct({
  checkpoint: Schema.optional(WorldRuntimeCheckpoint),
});
export type GetWorldRuntimeCheckpointResponse = Schema.Schema.Type<typeof GetWorldRuntimeCheckpointResponse>;

export class WorldRuntimeUnavailableError extends Schema.ErrorClass<WorldRuntimeUnavailableError>(
  "refactory/WorldRuntimeUnavailableError",
)(
  {
    _tag: Schema.tag("WorldRuntimeUnavailableError"),
    message: Schema.String,
    worldId: WorldId,
  },
  {
    description: "WorldRuntimeUnavailableError",
    httpApiStatus: 409,
  },
) {}
