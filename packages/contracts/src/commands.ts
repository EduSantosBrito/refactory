import { Schema } from "effect";
import {
  ContainerId,
  Facing,
  GridCoordinate,
  MachineId,
  NonNegativeInt,
  PositiveInt,
  RuntimeObjectId,
  WorldCommandRejectionCode,
  WorldId,
} from "./runtime.ts";

export const WorldCommandId = Schema.String.check(Schema.isUUID());
export type WorldCommandId = Schema.Schema.Type<typeof WorldCommandId>;

export const PlaceBuildingCommand = Schema.TaggedStruct("PlaceBuilding", {
  buildableId: Schema.String.check(Schema.isMinLength(1)),
  commandId: WorldCommandId,
  origin: GridCoordinate,
  rotation: Facing,
});
export type PlaceBuildingCommand = Schema.Schema.Type<
  typeof PlaceBuildingCommand
>;

export const PlaceBeltRunCommand = Schema.TaggedStruct("PlaceBeltRun", {
  commandId: WorldCommandId,
  destinationObjectId: RuntimeObjectId,
  destinationPortId: Schema.String.check(Schema.isMinLength(1)),
  sourceObjectId: RuntimeObjectId,
  sourcePortId: Schema.String.check(Schema.isMinLength(1)),
});
export type PlaceBeltRunCommand = Schema.Schema.Type<
  typeof PlaceBeltRunCommand
>;

export const RemoveBuildingCommand = Schema.TaggedStruct("RemoveBuilding", {
  commandId: WorldCommandId,
  objectId: RuntimeObjectId,
});
export type RemoveBuildingCommand = Schema.Schema.Type<
  typeof RemoveBuildingCommand
>;

export const RemoveBeltRunCommand = Schema.TaggedStruct("RemoveBeltRun", {
  beltRunId: Schema.String.check(Schema.isMinLength(1)),
  commandId: WorldCommandId,
});
export type RemoveBeltRunCommand = Schema.Schema.Type<
  typeof RemoveBeltRunCommand
>;

export const TransferItemsCommand = Schema.TaggedStruct("TransferItems", {
  commandId: WorldCommandId,
  fromContainerId: ContainerId,
  fromSlotIndex: Schema.optional(NonNegativeInt),
  itemId: Schema.String.check(Schema.isMinLength(1)),
  quantity: PositiveInt,
  toContainerId: ContainerId,
  toSlotIndex: Schema.optional(NonNegativeInt),
});
export type TransferItemsCommand = Schema.Schema.Type<
  typeof TransferItemsCommand
>;

export const InsertFuelCommand = Schema.TaggedStruct("InsertFuel", {
  commandId: WorldCommandId,
  fuelItemId: Schema.String.check(Schema.isMinLength(1)),
  fromContainerId: ContainerId,
  fromSlotIndex: Schema.optional(NonNegativeInt),
  machineId: MachineId,
  quantity: PositiveInt,
});
export type InsertFuelCommand = Schema.Schema.Type<typeof InsertFuelCommand>;

export const TakeFromContainerCommand = Schema.TaggedStruct(
  "TakeFromContainer",
  {
    commandId: WorldCommandId,
    fromContainerId: ContainerId,
    fromSlotIndex: Schema.optional(NonNegativeInt),
    itemId: Schema.String.check(Schema.isMinLength(1)),
    quantity: PositiveInt,
    toSlotIndex: Schema.optional(NonNegativeInt),
  },
);
export type TakeFromContainerCommand = Schema.Schema.Type<
  typeof TakeFromContainerCommand
>;

export const SetMachineRecipeCommand = Schema.TaggedStruct("SetMachineRecipe", {
  commandId: WorldCommandId,
  machineId: MachineId,
  recipeId: Schema.String.check(Schema.isMinLength(1)),
});
export type SetMachineRecipeCommand = Schema.Schema.Type<
  typeof SetMachineRecipeCommand
>;

export const RestartPowerNetworkCommand = Schema.TaggedStruct(
  "RestartPowerNetwork",
  {
    commandId: WorldCommandId,
    objectId: RuntimeObjectId,
  },
);
export type RestartPowerNetworkCommand = Schema.Schema.Type<
  typeof RestartPowerNetworkCommand
>;

export const AdvanceBossChatCommand = Schema.TaggedStruct("AdvanceBossChat", {
  commandId: WorldCommandId,
  phraseIndex: NonNegativeInt,
});
export type AdvanceBossChatCommand = Schema.Schema.Type<
  typeof AdvanceBossChatCommand
>;

export const VoteSkipBossChatCommand = Schema.TaggedStruct("VoteSkipBossChat", {
  commandId: WorldCommandId,
});
export type VoteSkipBossChatCommand = Schema.Schema.Type<
  typeof VoteSkipBossChatCommand
>;

export const WorldCommand = Schema.Union([
  PlaceBuildingCommand,
  PlaceBeltRunCommand,
  RemoveBuildingCommand,
  RemoveBeltRunCommand,
  TransferItemsCommand,
  InsertFuelCommand,
  TakeFromContainerCommand,
  SetMachineRecipeCommand,
  RestartPowerNetworkCommand,
  AdvanceBossChatCommand,
  VoteSkipBossChatCommand,
]);
export type WorldCommand = Schema.Schema.Type<typeof WorldCommand>;

export const WorldCommandAccepted = Schema.TaggedStruct(
  "WorldCommandAccepted",
  {
    appliedTick: NonNegativeInt,
    commandId: WorldCommandId,
    deltaSequence: NonNegativeInt,
    status: Schema.Literal("accepted"),
    worldId: WorldId,
  },
);
export type WorldCommandAccepted = Schema.Schema.Type<
  typeof WorldCommandAccepted
>;

export const WorldCommandRejected = Schema.TaggedStruct(
  "WorldCommandRejected",
  {
    commandId: WorldCommandId,
    message: Schema.String,
    reasonCode: WorldCommandRejectionCode,
    rejectedTick: NonNegativeInt,
    status: Schema.Literal("rejected"),
    worldId: WorldId,
  },
);
export type WorldCommandRejected = Schema.Schema.Type<
  typeof WorldCommandRejected
>;

export const WorldCommandReceipt = Schema.Union([
  WorldCommandAccepted,
  WorldCommandRejected,
]);
export type WorldCommandReceipt = Schema.Schema.Type<
  typeof WorldCommandReceipt
>;

export const SubmitWorldCommandRequest = Schema.Struct({
  command: WorldCommand,
});
export type SubmitWorldCommandRequest = Schema.Schema.Type<
  typeof SubmitWorldCommandRequest
>;

export const SubmitWorldCommandResponse = Schema.Struct({
  receipt: WorldCommandReceipt,
});
export type SubmitWorldCommandResponse = Schema.Schema.Type<
  typeof SubmitWorldCommandResponse
>;

export class WorldCommandQueueFullError extends Schema.ErrorClass<WorldCommandQueueFullError>(
  "refactory/WorldCommandQueueFullError",
)(
  {
    _tag: Schema.tag("WorldCommandQueueFullError"),
    message: Schema.String,
    worldId: WorldId,
  },
  {
    description: "WorldCommandQueueFullError",
    httpApiStatus: 503,
  },
) {}
