import type { ActorContext } from "@refactory/contracts/auth";
import type {
  AssetId,
  WorldDetail,
  WorldListQuery,
  WorldMode,
  WorldStatus,
  WorldSummary,
  WorldVisibility,
} from "@refactory/contracts/worlds";
import {
  type CreateWorldRequest,
  IdempotencyConflictError,
  InvalidWorldCursorError,
  InvalidWorldNameError,
  WorldAccessDeniedError,
  WorldNameTakenError,
  WorldNotFoundError,
  WorldSnapshot,
  WorldSpec,
} from "@refactory/contracts/worlds";
import { Effect, Layer, Match, Option, Schema, ServiceMap } from "effect";
import { AppConfig } from "./app-config.ts";
import { PersistenceDecodeError } from "./backend-errors.ts";
import { ProfileRepository } from "./profiles.ts";
import { SqliteDatabase, StorageError } from "./sqlite.ts";

type ListingCursor = {
  readonly updatedAt: string;
  readonly worldId: string;
};

type NormalizedWorldListQuery = {
  readonly cursor: ListingCursor | undefined;
  readonly limit: number;
  readonly normalizedSearch: string | undefined;
};

type WorldRow = {
  readonly created_at: string;
  readonly failure_reason: string | null;
  readonly host_name_snapshot: string;
  readonly host_public_key: string;
  readonly idempotency_key: string;
  readonly map_id: string;
  readonly mode: WorldMode;
  readonly normalized_host_name_snapshot: string;
  readonly normalized_name: string;
  readonly ruleset_version: string;
  readonly snapshot_json: string | null;
  readonly spec_json: string | null;
  readonly status: WorldStatus;
  readonly updated_at: string;
  readonly visibility: WorldVisibility;
  readonly world_id: string;
  readonly world_name: string;
  readonly world_schema_version: number;
};

type StoredWorld = {
  readonly createdAt: string;
  readonly failureReason: string | undefined;
  readonly hostNameSnapshot: string;
  readonly hostPublicKey: string;
  readonly idempotencyKey: string;
  readonly mapId: string;
  readonly mode: WorldMode;
  readonly normalizedHostNameSnapshot: string;
  readonly normalizedName: string;
  readonly rulesetVersion: string;
  readonly snapshot: WorldSnapshot | undefined;
  readonly spec: WorldSpec | undefined;
  readonly status: WorldStatus;
  readonly updatedAt: string;
  readonly visibility: WorldVisibility;
  readonly worldId: string;
  readonly worldName: string;
  readonly worldSchemaVersion: number;
};

type StoredWorldPage = {
  readonly nextCursor: string | undefined;
  readonly worlds: ReadonlyArray<StoredWorld>;
};

type DeleteWorldResult = "deleted" | "denied" | "not-found";

type CreateWorldRecord = {
  readonly actor: ActorContext;
  readonly createdAt: string;
  readonly idempotencyKey: string;
  readonly normalizedHostNameSnapshot: string;
  readonly normalizedName: string;
  readonly snapshot: WorldSnapshot;
  readonly spec: WorldSpec;
  readonly updatedAt: string;
  readonly worldId: string;
  readonly worldName: string;
};

const ListingCursorSchema = Schema.Struct({
  updatedAt: Schema.String,
  worldId: Schema.String,
});

const defaultListLimit = 20;
const maxListLimit = 100;

const assets: ReadonlyArray<{
  readonly assetId: AssetId;
  readonly designation: string;
}> = [
  { assetId: "BAR-001", designation: "Apis Worker Unit" },
  { assetId: "FLA-002", designation: "Phoenicopterus Scout Unit" },
  { assetId: "FRO-003", designation: "Rana Amphibious Unit" },
  { assetId: "RPA-004", designation: "Ailurus Arboreal Unit" },
];

const decodeWorldSpecJson = Schema.decodeUnknownEffect(
  Schema.fromJsonString(WorldSpec),
);
const decodeWorldSnapshotJson = Schema.decodeUnknownEffect(
  Schema.fromJsonString(WorldSnapshot),
);
const encodeWorldSpecJson = Schema.encodeEffect(
  Schema.fromJsonString(WorldSpec),
);
const encodeWorldSnapshotJson = Schema.encodeEffect(
  Schema.fromJsonString(WorldSnapshot),
);

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

const toSearchPattern = (search: string | undefined) =>
  Match.value(search).pipe(
    Match.when(Match.undefined, () => null),
    Match.when("", () => null),
    Match.orElse((value) => `%${value}%`),
  );

const clampListLimit = (value: number | undefined) => {
  return Match.value(value).pipe(
    Match.when(Match.undefined, () => defaultListLimit),
    Match.when(
      (limit) => !Number.isFinite(limit),
      () => defaultListLimit,
    ),
    Match.orElse((limit) =>
      Math.max(1, Math.min(maxListLimit, Math.floor(limit))),
    ),
  );
};

const encodeCursor = (cursor: ListingCursor) => btoa(JSON.stringify(cursor));

const decodeCursor = (value: string) =>
  Option.getOrUndefined(
    Schema.decodeUnknownOption(Schema.fromJsonString(ListingCursorSchema))(
      value,
    ),
  );

const requireNormalizedWorldListQuery = (query: WorldListQuery) =>
  Option.match(normalizeWorldListQuery(query), {
    onNone: () =>
      Effect.fail(
        new InvalidWorldCursorError({
          message: "World list cursor is invalid",
        }),
      ),
    onSome: Effect.succeed,
  });

const failIfDefined = (
  error: InvalidWorldNameError | WorldAccessDeniedError | undefined,
) =>
  Match.value(error).pipe(
    Match.when(Match.undefined, () => Effect.void),
    Match.orElse((definedError) => Effect.fail(definedError)),
  );

const normalizeWorldListQuery = (query: WorldListQuery) => {
  const cursorValueOption = Option.fromUndefinedOr(query.cursor);
  const decodedCursorOption = Option.flatMap(cursorValueOption, (cursorValue) =>
    Option.fromUndefinedOr(decodeCursor(cursorValue)),
  );
  const normalizedSearch = Option.getOrUndefined(
    Option.map(Option.fromUndefinedOr(query.search), normalizeSearchText),
  );

  return Match.value(
    Option.isSome(cursorValueOption) && Option.isNone(decodedCursorOption),
  ).pipe(
    Match.when(true, () => Option.none<NormalizedWorldListQuery>()),
    Match.orElse(() =>
      Option.some({
        cursor: Option.getOrUndefined(decodedCursorOption),
        limit: clampListLimit(query.limit),
        normalizedSearch,
      }),
    ),
  );
};

const parseWorldSnapshotColumn = (json: string | null) =>
  Match.value(json).pipe(
    Match.when(
      Match.null,
      () => Effect.succeed<WorldSnapshot | undefined>(undefined),
    ),
    Match.orElse((value) =>
      decodeWorldSnapshotJson(value).pipe(
        Effect.mapError(
          (cause) =>
            new PersistenceDecodeError({ cause, entity: "world_snapshot" }),
        ),
      ),
    ),
  );

const parseWorldSpecColumn = (json: string | null) =>
  Match.value(json).pipe(
    Match.when(
      Match.null,
      () => Effect.succeed<WorldSpec | undefined>(undefined),
    ),
    Match.orElse((value) =>
      decodeWorldSpecJson(value).pipe(
        Effect.mapError(
          (cause) =>
            new PersistenceDecodeError({ cause, entity: "world_spec" }),
        ),
      ),
    ),
  );

const mapWorldRow = (row: WorldRow) =>
  Effect.all({
    snapshot: parseWorldSnapshotColumn(row.snapshot_json),
    spec: parseWorldSpecColumn(row.spec_json),
  }).pipe(
    Effect.map(
      ({ snapshot, spec }): StoredWorld => ({
        createdAt: row.created_at,
        failureReason: row.failure_reason ?? undefined,
        hostNameSnapshot: row.host_name_snapshot,
        hostPublicKey: row.host_public_key,
        idempotencyKey: row.idempotency_key,
        mapId: row.map_id,
        mode: row.mode,
        normalizedHostNameSnapshot: row.normalized_host_name_snapshot,
        normalizedName: row.normalized_name,
        rulesetVersion: row.ruleset_version,
        snapshot,
        spec,
        status: row.status,
        updatedAt: row.updated_at,
        visibility: row.visibility,
        worldId: row.world_id,
        worldName: row.world_name,
        worldSchemaVersion: row.world_schema_version,
      }),
    ),
  );

const toWorldSummary = (world: StoredWorld): WorldSummary => ({
  createdAt: world.createdAt,
  failureReason: world.failureReason,
  hostName: world.hostNameSnapshot,
  mode: world.mode,
  updatedAt: world.updatedAt,
  visibility: world.visibility,
  worldId: world.worldId,
  worldName: world.worldName,
  worldStatus: world.status,
});

const toWorldDetail = (world: StoredWorld): WorldDetail => ({
  createdAt: world.createdAt,
  failureReason: world.failureReason,
  hostName: world.hostNameSnapshot,
  mode: world.mode,
  snapshot: world.snapshot,
  spec: world.spec,
  updatedAt: world.updatedAt,
  visibility: world.visibility,
  worldId: world.worldId,
  worldName: world.worldName,
  worldStatus: world.status,
});

const buildRoster = (
  mode: WorldMode,
  hostAssetId: AssetId,
  hostPublicKey: string,
) => {
  const openState = Match.value(mode).pipe(
    Match.when("multiplayer", () => "open" as const),
    Match.orElse(() => "closed" as const),
  );

  return assets.map((asset) =>
    Match.value(asset.assetId === hostAssetId).pipe(
      Match.when(true, () => ({
        assetId: asset.assetId,
        designation: asset.designation,
        reservedByProfileId: hostPublicKey,
        state: "reserved" as const,
      })),
      Match.orElse(() => ({
        assetId: asset.assetId,
        designation: asset.designation,
        reservedByProfileId: undefined,
        state: openState,
      })),
    ),
  );
};

const soloStarterResources: ReadonlyArray<{
  readonly itemId: string;
  readonly quantity: number;
}> = [
  { itemId: "burner_v1", quantity: 1 },
  { itemId: "belt_v1", quantity: 8 },
  { itemId: "miner_v1", quantity: 1 },
  { itemId: "smelter_v1", quantity: 1 },
];

const multiplayerStarterResources: ReadonlyArray<{
  readonly itemId: string;
  readonly quantity: number;
}> = [
  { itemId: "burner_v1", quantity: 1 },
  { itemId: "belt_v1", quantity: 12 },
  { itemId: "miner_v1", quantity: 1 },
  { itemId: "smelter_v1", quantity: 1 },
];

const buildStarterBox = () => ({
  anchorId: "tutorial-starter-box",
  buildableId: "starter_box" as const,
  entityId: crypto.randomUUID(),
  inventory: multiplayerStarterResources.map((item, index) => ({
    itemId: item.itemId,
    quantity: item.quantity,
    slotIndex: index,
  })),
  slotCount: 8,
  state: "placed" as const,
});

const buildWorldSnapshot = (
  mode: WorldMode,
  hostAssetId: AssetId,
  hostPublicKey: string,
): WorldSnapshot => {
  let introMessageId: "solo-intro" | "multiplayer-intro";
  let starterBox: ReturnType<typeof buildStarterBox> | undefined;
  let starterKit: ReadonlyArray<{
    readonly itemId: string;
    readonly quantity: number;
  }>;
  let currentObjectiveId: "place-miner" | "gather-wood";

  switch (mode) {
    case "solo":
      introMessageId = "solo-intro";
      starterBox = undefined;
      starterKit = [...soloStarterResources];
      currentObjectiveId = "place-miner";
      break;
    default:
      introMessageId = "multiplayer-intro";
      starterBox = buildStarterBox();
      starterKit = [];
      currentObjectiveId = "gather-wood";
      break;
  }

  return {
    bossChat: {
      currentPhraseIndex: 0,
      introMessageId,
      skipVotes: [],
    },
    onboarding: {
      starterBox,
      starterKit,
    },
    progression: {
      activeTier: 0,
      deliveryQuota: [{ delivered: 0, itemId: "iron_ingot", required: 60 }],
      phase: "tutorial",
      rocketStatus: "docked",
    },
    roster: buildRoster(mode, hostAssetId, hostPublicKey),
    snapshotVersion: 1,
    storage: {
      modularStorage: {
        acceptedItemIds: ["iron_ingot"],
        inputPortCount: 4,
        storedItems: [],
      },
    },
    tutorial: {
      completedObjectiveIds: [],
      currentObjectiveId,
      phase: "bootstrap",
      variant: mode,
    },
  };
};

const isSameCreateIntent = (
  world: {
    readonly hostPublicKey: string;
    readonly mode: WorldMode;
    readonly normalizedName: string;
    readonly visibility: WorldVisibility;
  },
  record: CreateWorldRecord,
) =>
  world.mode === record.spec.mode &&
  world.normalizedName === record.normalizedName &&
  world.visibility === record.spec.visibility &&
  world.hostPublicKey === record.actor.publicKey;

const isRecoverableCreation = (world: {
  readonly snapshotJson: string | null;
  readonly specJson: string | null;
  readonly status: WorldStatus;
}) =>
  world.status !== "ready" ||
  world.snapshotJson === null ||
  world.specJson === null;

const toStoredWorldPage = (
  hasNextPage: boolean,
  worlds: ReadonlyArray<StoredWorld>,
): StoredWorldPage => {
  const lastWorld = worlds.at(-1);
  const nextCursor = Match.value({ hasNextPage, lastWorld }).pipe(
    Match.when(
      { hasNextPage: true, lastWorld: Match.defined },
      ({ lastWorld }) =>
        encodeCursor({
          updatedAt: lastWorld.updatedAt,
          worldId: lastWorld.worldId,
        }),
    ),
    Match.orElse(() => undefined),
  );

  return { nextCursor, worlds };
};

const finalizePage = (rows: ReadonlyArray<WorldRow>, limit: number) => {
  const hasNextPage = rows.length > limit;
  const pageRows = Match.value(hasNextPage).pipe(
    Match.when(true, () => rows.slice(0, limit)),
    Match.orElse(() => rows),
  );

  return Effect.forEach(pageRows, mapWorldRow).pipe(
    Effect.map(
      (worlds): StoredWorldPage => toStoredWorldPage(hasNextPage, worlds),
    ),
  );
};

const storageInvariant = (operation: string, message: string) =>
  new StorageError({ cause: message, operation });

const transaction = <A>(
  database: SqliteDatabase["Service"]["database"],
  run: () => A,
) => database.transaction(run).immediate();

export class WorldRepository extends ServiceMap.Service<WorldRepository>()(
  "refactory/WorldRepository",
  {
    make: Effect.gen(function* () {
      const sqlite = yield* SqliteDatabase;
      const { database } = sqlite;

      const selectColumns = `world_id, host_public_key, host_name_snapshot, normalized_host_name_snapshot, idempotency_key,
        world_name, normalized_name, mode, visibility, status, world_schema_version, ruleset_version,
        map_id, spec_json, snapshot_json, failure_reason, created_at, updated_at`;

      const findById = Effect.fn("api.worlds.repo.findById")(function* (
        worldId: string,
      ) {
        const row = yield* Effect.try({
          try: () =>
            database
              .query<WorldRow, [string]>(
                `SELECT ${selectColumns} FROM worlds WHERE world_id = ?1`,
              )
              .get(worldId),
          catch: (cause) =>
            new StorageError({ cause, operation: "worlds.findById" }),
        });

        switch (row) {
          case null:
            return Option.none();
        }

        return Option.some(yield* mapWorldRow(row));
      });

      const deleteOwnedWorld = Effect.fn("api.worlds.repo.deleteOwnedWorld")(function* (
        hostPublicKey: string,
        worldId: string,
      ) {
        const result = yield* Effect.try({
          try: () =>
            transaction(database, (): DeleteWorldResult => {
              const row = database
                .query<{ readonly host_public_key: string }, [string]>(
                  "SELECT host_public_key FROM worlds WHERE world_id = ?1",
                )
                .get(worldId);

              switch (row) {
                case null:
                  return "not-found";
              }

              if (row.host_public_key !== hostPublicKey) {
                return "denied";
              }

              database
                .query("DELETE FROM worlds WHERE world_id = ?1")
                .run(worldId);

              return "deleted";
            }),
          catch: (cause) =>
            new StorageError({ cause, operation: "worlds.deleteOwnedWorld" }),
        });

        return result;
      });

      const createOrGetWorld = Effect.fn("api.worlds.repo.createOrGetWorld")(function* (
        record: CreateWorldRecord,
      ) {
        const specJson = yield* encodeWorldSpecJson(record.spec).pipe(
          Effect.mapError(
            (cause) =>
              new PersistenceDecodeError({ cause, entity: "world_spec" }),
          ),
        );
        const snapshotJson = yield* encodeWorldSnapshotJson(
          record.snapshot,
        ).pipe(
          Effect.mapError(
            (cause) =>
              new PersistenceDecodeError({
                cause,
                entity: "world_snapshot",
              }),
          ),
        );

        const row = yield* Effect.try({
          try: () =>
            transaction(database, () => {
              const existingByIdempotency = database
                .query<WorldRow, [string, string]>(
                  `SELECT ${selectColumns}
                   FROM worlds
                   WHERE host_public_key = ?1 AND idempotency_key = ?2`,
                )
                .get(record.actor.publicKey, record.idempotencyKey);

              switch (existingByIdempotency) {
                case null:
                  break;
                default: {
                  const world = {
                    hostPublicKey: existingByIdempotency.host_public_key,
                    mode: existingByIdempotency.mode,
                    normalizedName: existingByIdempotency.normalized_name,
                    snapshotJson: existingByIdempotency.snapshot_json,
                    specJson: existingByIdempotency.spec_json,
                    status: existingByIdempotency.status,
                    visibility: existingByIdempotency.visibility,
                    worldId: existingByIdempotency.world_id,
                  };

                  switch (isSameCreateIntent(world, record)) {
                    case false:
                      throw new IdempotencyConflictError({
                        idempotencyKey: record.idempotencyKey,
                      });
                  }

                  switch (isRecoverableCreation(world)) {
                    case true: {
                      database
                        .query(
                          `UPDATE worlds
                           SET host_name_snapshot = ?2,
                               normalized_host_name_snapshot = ?3,
                               world_name = ?4,
                               normalized_name = ?5,
                               mode = ?6,
                               visibility = ?7,
                               status = 'ready',
                               world_schema_version = ?8,
                               ruleset_version = ?9,
                               map_id = ?10,
                               spec_json = ?11,
                               snapshot_json = ?12,
                               failure_reason = NULL,
                               updated_at = ?13
                           WHERE world_id = ?1`,
                        )
                        .run(
                          world.worldId,
                          record.actor.displayName,
                          record.normalizedHostNameSnapshot,
                          record.worldName,
                          record.normalizedName,
                          record.spec.mode,
                          record.spec.visibility,
                          record.spec.worldSchemaVersion,
                          record.spec.rulesetVersion,
                          record.spec.mapId,
                          specJson,
                          snapshotJson,
                          record.updatedAt,
                        );

                      const repaired = database
                        .query<WorldRow, [string]>(
                          `SELECT ${selectColumns} FROM worlds WHERE world_id = ?1`,
                        )
                        .get(world.worldId);

                      switch (repaired) {
                        case null:
                          throw storageInvariant(
                            "worlds.createOrGetWorld",
                            "world disappeared during recovery",
                          );
                        default:
                          return repaired;
                      }
                    }
                    default:
                      return existingByIdempotency;
                  }
                }
              }

              const existingByName = database
                .query<WorldRow, [string, string]>(
                  `SELECT ${selectColumns}
                   FROM worlds
                   WHERE host_public_key = ?1 AND normalized_name = ?2`,
                )
                .get(record.actor.publicKey, record.normalizedName);

              switch (existingByName) {
                case null:
                  break;
                default:
                  throw new WorldNameTakenError({
                    worldName: record.worldName,
                  });
              }

              database
                .query(
                  `INSERT INTO worlds (
                     world_id, host_public_key, host_name_snapshot, normalized_host_name_snapshot,
                     idempotency_key, world_name, normalized_name, mode, visibility, status,
                     world_schema_version, ruleset_version, map_id, spec_json, snapshot_json,
                     failure_reason, created_at, updated_at
                   ) VALUES (
                     ?1, ?2, ?3, ?4,
                     ?5, ?6, ?7, ?8, ?9, 'ready',
                     ?10, ?11, ?12, ?13, ?14,
                     NULL, ?15, ?16
                   )`,
                )
                .run(
                  record.worldId,
                  record.actor.publicKey,
                  record.actor.displayName,
                  record.normalizedHostNameSnapshot,
                  record.idempotencyKey,
                  record.worldName,
                  record.normalizedName,
                  record.spec.mode,
                  record.spec.visibility,
                  record.spec.worldSchemaVersion,
                  record.spec.rulesetVersion,
                  record.spec.mapId,
                  specJson,
                  snapshotJson,
                  record.createdAt,
                  record.updatedAt,
                );

              const inserted = database
                .query<WorldRow, [string]>(
                  `SELECT ${selectColumns} FROM worlds WHERE world_id = ?1`,
                )
                .get(record.worldId);

              switch (inserted) {
                case null:
                  throw storageInvariant(
                    "worlds.createOrGetWorld",
                    "world insert did not return a row",
                  );
              }

              return inserted;
            }),
          catch: (cause) =>
            Match.value(cause).pipe(
              Match.when(
                Match.instanceOf(IdempotencyConflictError),
                (conflictError) => conflictError,
              ),
              Match.when(
                Match.instanceOf(WorldNameTakenError),
                (nameTaken) => nameTaken,
              ),
              Match.when(
                Match.instanceOf(StorageError),
                (storageError) => storageError,
              ),
              Match.orElse(
                (storageCause) =>
                  new StorageError({
                    cause: storageCause,
                    operation: "worlds.createOrGetWorld",
                  }),
              ),
            ),
        });

        return yield* mapWorldRow(row);
      });

      const listOwnWorlds = Effect.fn("api.worlds.repo.listOwnWorlds")(function* (
        hostPublicKey: string,
        query: NormalizedWorldListQuery,
      ) {
        const limit = query.limit + 1;
        const searchPattern = toSearchPattern(query.normalizedSearch);
        const cursorUpdatedAt = query.cursor?.updatedAt ?? null;
        const cursorWorldId = query.cursor?.worldId ?? null;

        const rows = yield* Effect.try({
          try: () =>
            database
              .query<
                WorldRow,
                [string, string | null, string | null, string | null, number]
              >(
                `SELECT ${selectColumns}
                 FROM worlds
                 WHERE host_public_key = ?1
                   AND (?2 IS NULL OR normalized_name LIKE ?2 OR normalized_host_name_snapshot LIKE ?2 OR world_id LIKE ?2)
                   AND (?3 IS NULL OR updated_at < ?3 OR (updated_at = ?3 AND world_id < ?4))
                 ORDER BY updated_at DESC, world_id DESC
                 LIMIT ?5`,
              )
              .all(
                hostPublicKey,
                searchPattern,
                cursorUpdatedAt,
                cursorWorldId,
                limit,
              ),
          catch: (cause) =>
            new StorageError({ cause, operation: "worlds.listOwnWorlds" }),
        });

        return yield* finalizePage(rows, query.limit);
      });

      const listPublicWorlds = Effect.fn("api.worlds.repo.listPublicWorlds")(function* (
        query: NormalizedWorldListQuery,
      ) {
        const limit = query.limit + 1;
        const searchPattern = toSearchPattern(query.normalizedSearch);
        const cursorUpdatedAt = query.cursor?.updatedAt ?? null;
        const cursorWorldId = query.cursor?.worldId ?? null;

        const rows = yield* Effect.try({
          try: () =>
            database
              .query<
                WorldRow,
                [string | null, string | null, string | null, number]
              >(
                `SELECT ${selectColumns}
                 FROM worlds
                 WHERE visibility = 'public'
                   AND status = 'ready'
                   AND (?1 IS NULL OR normalized_name LIKE ?1 OR normalized_host_name_snapshot LIKE ?1 OR world_id LIKE ?1)
                   AND (?2 IS NULL OR updated_at < ?2 OR (updated_at = ?2 AND world_id < ?3))
                 ORDER BY updated_at DESC, world_id DESC
                 LIMIT ?4`,
              )
              .all(searchPattern, cursorUpdatedAt, cursorWorldId, limit),
          catch: (cause) =>
            new StorageError({ cause, operation: "worlds.listPublicWorlds" }),
        });

        return yield* finalizePage(rows, query.limit);
      });

      return {
        createOrGetWorld,
        deleteOwnedWorld,
        findById,
        listOwnWorlds,
        listPublicWorlds,
      };
    }),
  },
) {
  static readonly Live = Layer.effect(WorldRepository, WorldRepository.make);
}

export class WorldService extends ServiceMap.Service<WorldService>()(
  "refactory/WorldService",
  {
    make: Effect.gen(function* () {
      const config = yield* AppConfig;
      const profiles = yield* ProfileRepository;
      const worlds = yield* WorldRepository;

      const createWorld = Effect.fn("api.worlds.service.createWorld")(function* (
        actor: ActorContext,
        request: CreateWorldRequest,
      ) {
        const normalizedName = normalizeSearchText(request.worldName);

        yield* failIfDefined(
          Match.value(normalizedName.length).pipe(
            Match.when(
              0,
              () =>
                new InvalidWorldNameError({
                  message: "World name cannot be empty",
                }),
            ),
            Match.orElse(() => undefined),
          ),
        );

        const now = new Date().toISOString();
        const visibility = request.visibility ?? "private";

        yield* profiles.upsertProfile(actor, now);

        const spec: WorldSpec = {
          hostAssetId: request.hostAssetId,
          mapId: "GPY-7",
          mode: request.mode,
          portal: request.portal,
          rulesetVersion: config.rulesetVersion,
          visibility,
          worldSchemaVersion: config.worldSchemaVersion,
        };
        const snapshot = buildWorldSnapshot(
          request.mode,
          request.hostAssetId,
          actor.publicKey,
        );

        const world = yield* worlds.createOrGetWorld({
          actor,
          createdAt: now,
          idempotencyKey: request.idempotencyKey,
          normalizedHostNameSnapshot: normalizeSearchText(actor.displayName),
          normalizedName,
          snapshot,
          spec,
          updatedAt: now,
          worldId: crypto.randomUUID(),
          worldName: request.worldName,
        });

        return toWorldDetail(world);
      });

      const deleteWorld = Effect.fn("api.worlds.service.deleteWorld")(function* (
        actor: ActorContext,
        worldId: string,
      ) {
        yield* profiles.upsertProfile(actor, new Date().toISOString());

        const result = yield* worlds.deleteOwnedWorld(actor.publicKey, worldId);

        return yield* Match.value(result).pipe(
          Match.when("deleted", () => Effect.succeed({ worldId })),
          Match.when("denied", () =>
            Effect.fail(new WorldAccessDeniedError({ worldId })),
          ),
          Match.when("not-found", () =>
            Effect.fail(new WorldNotFoundError({ worldId })),
          ),
          Match.exhaustive,
        );
      });

      const getWorld = Effect.fn("api.worlds.service.getWorld")(function* (
        actor: ActorContext,
        worldId: string,
      ) {
        yield* profiles.upsertProfile(actor, new Date().toISOString());

        const worldOption = yield* worlds.findById(worldId);
        const world = yield* Option.match(worldOption, {
          onNone: () => Effect.fail(new WorldNotFoundError({ worldId })),
          onSome: Effect.succeed,
        });
        const isOwner = world.hostPublicKey === actor.publicKey;
        const isPublicReadable =
          world.visibility === "public" && world.status === "ready";

        yield* failIfDefined(
          Match.value({ isOwner, isPublicReadable }).pipe(
            Match.when(
              { isOwner: false, isPublicReadable: false },
              () => new WorldAccessDeniedError({ worldId }),
            ),
            Match.orElse(() => undefined),
          ),
        );

        return toWorldDetail(world);
      });

      const listOwnWorlds = Effect.fn("api.worlds.service.listOwnWorlds")(function* (
        actor: ActorContext,
        query: WorldListQuery,
      ) {
        yield* profiles.upsertProfile(actor, new Date().toISOString());
        const normalizedQuery = yield* requireNormalizedWorldListQuery(query);

        const page = yield* worlds.listOwnWorlds(
          actor.publicKey,
          normalizedQuery,
        );

        return {
          nextCursor: page.nextCursor,
          worlds: page.worlds.map(toWorldSummary),
        };
      });

      const listPublicWorlds = Effect.fn("api.worlds.service.listPublicWorlds")(function* (
        query: WorldListQuery,
      ) {
        const normalizedQuery = yield* requireNormalizedWorldListQuery(query);

        const page = yield* worlds.listPublicWorlds(normalizedQuery);

        return {
          nextCursor: page.nextCursor,
          worlds: page.worlds.map(toWorldSummary),
        };
      });

      return {
        createWorld,
        deleteWorld,
        getWorld,
        listOwnWorlds,
        listPublicWorlds,
      };
    }),
  },
) {
  static readonly Live = Layer.effect(WorldService, WorldService.make);
}
