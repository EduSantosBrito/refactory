import { Schema } from "effect";
import { WorldCommand, WorldCommandReceipt } from "./commands.ts";
import {
  NonNegativeInt,
  WorldId,
  WorldRuntimeDelta,
  WorldRuntimeDeltaMessage,
  WorldRuntimeSnapshot,
  WorldRuntimeSnapshotMessage,
} from "./runtime.ts";

export const WorldCommandQueuedMessage = Schema.Struct({
  _tag: Schema.Literal("WorldCommandQueuedMessage"),
  commandId: Schema.String.check(Schema.isUUID()),
  worldId: WorldId,
});
export type WorldCommandQueuedMessage = Schema.Schema.Type<typeof WorldCommandQueuedMessage>;

export const WorldCommandReceiptMessage = Schema.Struct({
  _tag: Schema.Literal("WorldCommandReceiptMessage"),
  receipt: WorldCommandReceipt,
});
export type WorldCommandReceiptMessage = Schema.Schema.Type<typeof WorldCommandReceiptMessage>;

export const WorldRuntimeResyncRequiredMessage = Schema.Struct({
  _tag: Schema.Literal("WorldRuntimeResyncRequiredMessage"),
  expectedDeltaSequence: NonNegativeInt,
  message: Schema.String,
  worldId: WorldId,
});
export type WorldRuntimeResyncRequiredMessage = Schema.Schema.Type<typeof WorldRuntimeResyncRequiredMessage>;

export const WorldRuntimeServerMessage = Schema.Union([
  WorldRuntimeSnapshotMessage,
  WorldRuntimeDeltaMessage,
  WorldCommandQueuedMessage,
  WorldCommandReceiptMessage,
  WorldRuntimeResyncRequiredMessage,
]);
export type WorldRuntimeServerMessage = Schema.Schema.Type<typeof WorldRuntimeServerMessage>;

export const WorldRuntimeBindMessage = Schema.Struct({
  _tag: Schema.Literal("WorldRuntimeBindMessage"),
  snapshotDeltaSequence: NonNegativeInt,
  worldId: WorldId,
});
export type WorldRuntimeBindMessage = Schema.Schema.Type<typeof WorldRuntimeBindMessage>;

export const WorldRuntimeHeartbeatMessage = Schema.Struct({
  _tag: Schema.Literal("WorldRuntimeHeartbeatMessage"),
});
export type WorldRuntimeHeartbeatMessage = Schema.Schema.Type<typeof WorldRuntimeHeartbeatMessage>;

export const WorldRuntimeCommandMessage = Schema.Struct({
  _tag: Schema.Literal("WorldRuntimeCommandMessage"),
  command: WorldCommand,
});
export type WorldRuntimeCommandMessage = Schema.Schema.Type<typeof WorldRuntimeCommandMessage>;

export const WorldRuntimeClientMessage = Schema.Union([
  WorldRuntimeBindMessage,
  WorldRuntimeHeartbeatMessage,
  WorldRuntimeCommandMessage,
]);
export type WorldRuntimeClientMessage = Schema.Schema.Type<typeof WorldRuntimeClientMessage>;

export type WorldRuntimeHandshake = {
  readonly snapshot: WorldRuntimeSnapshot;
  readonly snapshotDeltaSequence: number;
};

export type WorldRuntimeDeltaPayload = WorldRuntimeDelta;
