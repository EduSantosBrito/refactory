import { Schema } from "effect";

export const WorldMode = Schema.Literals(["solo", "multiplayer"]);
export type WorldMode = Schema.Schema.Type<typeof WorldMode>;

export const WorldVisibility = Schema.Literals(["private", "public"]);
export type WorldVisibility = Schema.Schema.Type<typeof WorldVisibility>;

export const WorldStatus = Schema.Literals([
  "creating",
  "ready",
  "archived",
  "creation_failed",
]);
export type WorldStatus = Schema.Schema.Type<typeof WorldStatus>;

export const AssetId = Schema.Literals([
  "BAR-001",
  "FLA-002",
  "FRO-003",
  "RPA-004",
]);
export type AssetId = Schema.Schema.Type<typeof AssetId>;

const AssetSlotState = Schema.Literals(["reserved", "open", "closed"]);

const AssetSlot = Schema.Struct({
  assetId: AssetId,
  designation: Schema.String,
  reservedByProfileId: Schema.optional(Schema.String),
  state: AssetSlotState,
});

const DeliveryQuota = Schema.Struct({
  delivered: Schema.Number,
  itemId: Schema.String,
  required: Schema.Number,
});

const StarterResource = Schema.Struct({
  itemId: Schema.String,
  quantity: Schema.Number,
});

const StoredItem = Schema.Struct({
  itemId: Schema.String,
  quantity: Schema.Number,
});

const StarterBoxSlot = Schema.Struct({
  itemId: Schema.String,
  quantity: Schema.Number,
  slotIndex: Schema.Number,
});

const StarterBoxState = Schema.Struct({
  anchorId: Schema.String,
  buildableId: Schema.Literal("starter_box"),
  entityId: Schema.String,
  inventory: Schema.Array(StarterBoxSlot),
  slotCount: Schema.Number,
  state: Schema.Literal("placed"),
});

export const WorldSpec = Schema.Struct({
  hostAssetId: AssetId,
  mapId: Schema.Literal("GPY-7"),
  mode: WorldMode,
  rulesetVersion: Schema.String,
  visibility: WorldVisibility,
  worldSchemaVersion: Schema.Number,
});

export type WorldSpec = Schema.Schema.Type<typeof WorldSpec>;

export const WorldSnapshot = Schema.Struct({
  bossChat: Schema.Struct({
    currentPhraseIndex: Schema.Number,
    introMessageId: Schema.Literals(["solo-intro", "multiplayer-intro"]),
    skipVotes: Schema.Array(Schema.String),
  }),
  onboarding: Schema.Struct({
    starterBox: Schema.optional(StarterBoxState),
    starterKit: Schema.Array(StarterResource),
  }),
  progression: Schema.Struct({
    activeTier: Schema.Number,
    deliveryQuota: Schema.Array(DeliveryQuota),
    phase: Schema.Literal("tutorial"),
    rocketStatus: Schema.Literal("docked"),
  }),
  roster: Schema.Array(AssetSlot),
  snapshotVersion: Schema.Number,
  storage: Schema.Struct({
    modularStorage: Schema.Struct({
      acceptedItemIds: Schema.Array(Schema.String),
      inputPortCount: Schema.Number,
      storedItems: Schema.Array(StoredItem),
    }),
  }),
  tutorial: Schema.Struct({
    completedObjectiveIds: Schema.Array(Schema.String),
    currentObjectiveId: Schema.String,
    phase: Schema.Literal("bootstrap"),
    variant: WorldMode,
  }),
});

export type WorldSnapshot = Schema.Schema.Type<typeof WorldSnapshot>;

export const WorldSummary = Schema.Struct({
  createdAt: Schema.String,
  failureReason: Schema.optional(Schema.String),
  hostName: Schema.String,
  mode: WorldMode,
  updatedAt: Schema.String,
  visibility: WorldVisibility,
  worldId: Schema.String,
  worldName: Schema.String,
  worldStatus: WorldStatus,
});

export type WorldSummary = Schema.Schema.Type<typeof WorldSummary>;

export const WorldDetail = Schema.Struct({
  createdAt: Schema.String,
  failureReason: Schema.optional(Schema.String),
  hostName: Schema.String,
  mode: WorldMode,
  snapshot: Schema.optional(WorldSnapshot),
  spec: Schema.optional(WorldSpec),
  updatedAt: Schema.String,
  visibility: WorldVisibility,
  worldId: Schema.String,
  worldName: Schema.String,
  worldStatus: WorldStatus,
});

export type WorldDetail = Schema.Schema.Type<typeof WorldDetail>;

export const CreateWorldRequest = Schema.Struct({
  hostAssetId: AssetId,
  idempotencyKey: Schema.String,
  mode: WorldMode,
  visibility: Schema.optional(WorldVisibility),
  worldName: Schema.String,
});

export type CreateWorldRequest = Schema.Schema.Type<typeof CreateWorldRequest>;

export const WorldListQuery = Schema.Struct({
  cursor: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.FiniteFromString),
  search: Schema.optional(Schema.String),
});

export type WorldListQuery = Schema.Schema.Type<typeof WorldListQuery>;

export const CreateWorldResponse = Schema.Struct({ world: WorldDetail });
export const GetWorldResponse = Schema.Struct({ world: WorldDetail });
export const ListWorldsResponse = Schema.Struct({
  nextCursor: Schema.optional(Schema.String),
  worlds: Schema.Array(WorldSummary),
});

export class InvalidWorldNameError extends Schema.ErrorClass<InvalidWorldNameError>(
  "refactory/InvalidWorldNameError",
)(
  {
    _tag: Schema.tag("InvalidWorldNameError"),
    message: Schema.String,
  },
  {
    description: "InvalidWorldNameError",
    httpApiStatus: 400,
  },
) {}

export class InvalidWorldCursorError extends Schema.ErrorClass<InvalidWorldCursorError>(
  "refactory/InvalidWorldCursorError",
)(
  {
    _tag: Schema.tag("InvalidWorldCursorError"),
    message: Schema.String,
  },
  {
    description: "InvalidWorldCursorError",
    httpApiStatus: 400,
  },
) {}

export class IdempotencyConflictError extends Schema.ErrorClass<IdempotencyConflictError>(
  "refactory/IdempotencyConflictError",
)(
  {
    _tag: Schema.tag("IdempotencyConflictError"),
    idempotencyKey: Schema.String,
  },
  {
    description: "IdempotencyConflictError",
    httpApiStatus: 409,
  },
) {}

export class WorldNameTakenError extends Schema.ErrorClass<WorldNameTakenError>(
  "refactory/WorldNameTakenError",
)(
  {
    _tag: Schema.tag("WorldNameTakenError"),
    worldName: Schema.String,
  },
  {
    description: "WorldNameTakenError",
    httpApiStatus: 409,
  },
) {}

export class WorldNotFoundError extends Schema.ErrorClass<WorldNotFoundError>(
  "refactory/WorldNotFoundError",
)(
  {
    _tag: Schema.tag("WorldNotFoundError"),
    worldId: Schema.String,
  },
  {
    description: "WorldNotFoundError",
    httpApiStatus: 404,
  },
) {}

export class WorldAccessDeniedError extends Schema.ErrorClass<WorldAccessDeniedError>(
  "refactory/WorldAccessDeniedError",
)(
  {
    _tag: Schema.tag("WorldAccessDeniedError"),
    worldId: Schema.String,
  },
  {
    description: "WorldAccessDeniedError",
    httpApiStatus: 403,
  },
) {}
