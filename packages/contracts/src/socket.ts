import { Schema } from "effect";
import { WorldCommand, WorldCommandReceipt } from "./commands.ts";
import type { WorldRuntimeDelta, WorldRuntimeSnapshot } from "./runtime.ts";
import {
  NonNegativeInt,
  WorldId,
  WorldRuntimeDeltaMessage,
  WorldRuntimeSnapshotMessage,
} from "./runtime.ts";

export const WorldCommandQueuedMessage = Schema.TaggedStruct(
  "WorldCommandQueuedMessage",
  {
    commandId: Schema.String.check(Schema.isUUID()),
    worldId: WorldId,
  },
);
export type WorldCommandQueuedMessage = Schema.Schema.Type<
  typeof WorldCommandQueuedMessage
>;

export const WorldCommandReceiptMessage = Schema.TaggedStruct(
  "WorldCommandReceiptMessage",
  {
    receipt: WorldCommandReceipt,
  },
);
export type WorldCommandReceiptMessage = Schema.Schema.Type<
  typeof WorldCommandReceiptMessage
>;

export const WorldRuntimeResyncRequiredMessage = Schema.TaggedStruct(
  "WorldRuntimeResyncRequiredMessage",
  {
    expectedDeltaSequence: NonNegativeInt,
    message: Schema.String,
    worldId: WorldId,
  },
);
export type WorldRuntimeResyncRequiredMessage = Schema.Schema.Type<
  typeof WorldRuntimeResyncRequiredMessage
>;

export const WorldRuntimeServerMessage = Schema.Union([
  WorldRuntimeSnapshotMessage,
  WorldRuntimeDeltaMessage,
  WorldCommandQueuedMessage,
  WorldCommandReceiptMessage,
  WorldRuntimeResyncRequiredMessage,
]);
export type WorldRuntimeServerMessage = Schema.Schema.Type<
  typeof WorldRuntimeServerMessage
>;

export const WorldRuntimeBindMessage = Schema.TaggedStruct(
  "WorldRuntimeBindMessage",
  {
    snapshotDeltaSequence: NonNegativeInt,
    worldId: WorldId,
  },
);
export type WorldRuntimeBindMessage = Schema.Schema.Type<
  typeof WorldRuntimeBindMessage
>;

export const WorldRuntimeHeartbeatMessage = Schema.TaggedStruct(
  "WorldRuntimeHeartbeatMessage",
  {},
);
export type WorldRuntimeHeartbeatMessage = Schema.Schema.Type<
  typeof WorldRuntimeHeartbeatMessage
>;

export const TraceContext = Schema.Struct({
  traceparent: Schema.String,
  tracestate: Schema.optional(Schema.String),
});
export type TraceContext = Schema.Schema.Type<typeof TraceContext>;

export const WorldRuntimeCommandMessage = Schema.TaggedStruct(
  "WorldRuntimeCommandMessage",
  {
    command: WorldCommand,
    traceContext: Schema.optional(TraceContext),
  },
);
export type WorldRuntimeCommandMessage = Schema.Schema.Type<
  typeof WorldRuntimeCommandMessage
>;

export const WorldRuntimeClientMessage = Schema.Union([
  WorldRuntimeBindMessage,
  WorldRuntimeHeartbeatMessage,
  WorldRuntimeCommandMessage,
]);
export type WorldRuntimeClientMessage = Schema.Schema.Type<
  typeof WorldRuntimeClientMessage
>;

export type WorldRuntimeHandshake = {
  readonly snapshot: WorldRuntimeSnapshot;
  readonly snapshotDeltaSequence: number;
};

export type WorldRuntimeDeltaPayload = WorldRuntimeDelta;
