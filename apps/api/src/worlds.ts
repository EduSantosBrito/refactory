import type { ActorContext } from "@refactory/contracts/auth";
import {
  CreateWorldRequest,
  InvalidWorldCursorError,
  InvalidWorldNameError,
  IdempotencyConflictError,
  ListWorldsResponse,
  WorldNotFoundError,
  WorldAccessDeniedError,
  WorldNameTakenError,
  WorldSnapshot,
  WorldSpec,
} from "@refactory/contracts/worlds";
import type {
  AssetId,
  WorldDetail,
  WorldListQuery,
  WorldMode,
  WorldStatus,
  WorldSummary,
  WorldVisibility,
} from "@refactory/contracts/worlds";
import { Effect, Layer, Option, Schema, ServiceMap } from "effect";
import { AppConfig } from "./app-config.ts";
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

const defaultListLimit = 20;
const maxListLimit = 100;

const assets: ReadonlyArray<{ readonly assetId: AssetId; readonly designation: string }> = [
  { assetId: "BAR-001", designation: "Apis Worker Unit" },
  { assetId: "FLA-002", designation: "Phoenicopterus Scout Unit" },
  { assetId: "FRO-003", designation: "Rana Amphibious Unit" },
  { assetId: "RPA-004", designation: "Ailurus Arboreal Unit" },
];

const decodeWorldSpec = Schema.decodeUnknownSync(WorldSpec);
const decodeWorldSnapshot = Schema.decodeUnknownSync(WorldSnapshot);

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

const clampListLimit = (value: number | undefined) => {
  if (value === undefined || !Number.isFinite(value)) {
    return defaultListLimit;
  }

  const bounded = Math.floor(value);

  if (bounded < 1) {
    return 1;
  }

  return bounded > maxListLimit ? maxListLimit : bounded;
};

const encodeCursor = (cursor: ListingCursor) => btoa(JSON.stringify(cursor));

const decodeCursor = (value: string) => {
  try {
    const parsed: unknown = JSON.parse(atob(value));

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "updatedAt" in parsed &&
      typeof parsed.updatedAt === "string" &&
      "worldId" in parsed &&
      typeof parsed.worldId === "string"
    ) {
      return {
        updatedAt: parsed.updatedAt,
        worldId: parsed.worldId,
      };
    }

    return undefined;
  } catch {
    return undefined;
  }
};

const normalizeWorldListQuery = (query: WorldListQuery) => {
  const cursor = query.cursor === undefined ? undefined : decodeCursor(query.cursor);

  if (query.cursor !== undefined && cursor === undefined) {
    return Option.none<NormalizedWorldListQuery>();
  }

  return Option.some({
    cursor,
    limit: clampListLimit(query.limit),
    normalizedSearch: query.search === undefined ? undefined : normalizeSearchText(query.search),
  });
};

const parseJsonColumn = <A>(json: string | null, decode: (value: unknown) => A) => {
  if (json === null) {
    return undefined;
  }

  return decode(JSON.parse(json));
};

const mapWorldRow = (row: WorldRow): StoredWorld => ({
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
  snapshot: parseJsonColumn(row.snapshot_json, decodeWorldSnapshot),
  spec: parseJsonColumn(row.spec_json, decodeWorldSpec),
  status: row.status,
  updatedAt: row.updated_at,
  visibility: row.visibility,
  worldId: row.world_id,
  worldName: row.world_name,
  worldSchemaVersion: row.world_schema_version,
});

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

const buildRoster = (mode: WorldMode, hostAssetId: AssetId, hostPublicKey: string) =>
  assets.map((asset) =>
    asset.assetId === hostAssetId
      ? {
          assetId: asset.assetId,
          designation: asset.designation,
          reservedByProfileId: hostPublicKey,
          state: "reserved" as const,
        }
      : {
          assetId: asset.assetId,
          designation: asset.designation,
          reservedByProfileId: undefined,
          state: mode === "multiplayer" ? ("open" as const) : ("closed" as const),
        },
  );

const soloStarterResources: ReadonlyArray<{ readonly itemId: string; readonly quantity: number }> = [
  { itemId: "burner_v1", quantity: 1 },
  { itemId: "belt_v1", quantity: 8 },
  { itemId: "miner_v1", quantity: 1 },
  { itemId: "smelter_v1", quantity: 1 },
];

const multiplayerStarterResources: ReadonlyArray<{ readonly itemId: string; readonly quantity: number }> = [
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

const buildWorldSnapshot = (mode: WorldMode, hostAssetId: AssetId, hostPublicKey: string): WorldSnapshot => ({
  bossChat: {
    currentPhraseIndex: 0,
    introMessageId: mode === "solo" ? "solo-intro" : "multiplayer-intro",
    skipVotes: [],
  },
  onboarding: {
    starterBox: mode === "multiplayer" ? buildStarterBox() : undefined,
    starterKit: mode === "solo" ? [...soloStarterResources] : [],
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
      inputPortCount: 6,
      storedItems: [],
    },
  },
  tutorial: {
    completedObjectiveIds: [],
    currentObjectiveId: mode === "solo" ? "place-miner" : "gather-wood",
    phase: "bootstrap",
    variant: mode,
  },
});

const isSameCreateIntent = (world: StoredWorld, record: CreateWorldRecord) =>
  world.mode === record.spec.mode &&
  world.normalizedName === record.normalizedName &&
  world.visibility === record.spec.visibility &&
  world.hostPublicKey === record.actor.publicKey;

const isRecoverableCreation = (world: StoredWorld) =>
  world.status !== "ready" || world.snapshot === undefined || world.spec === undefined;

const finalizePage = (rows: ReadonlyArray<WorldRow>, limit: number): StoredWorldPage => {
  const hasNextPage = rows.length > limit;
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
  const worlds = pageRows.map(mapWorldRow);
  const lastWorld = worlds.at(-1);

  return {
    nextCursor:
      hasNextPage && lastWorld !== undefined
        ? encodeCursor({ updatedAt: lastWorld.updatedAt, worldId: lastWorld.worldId })
        : undefined,
    worlds,
  };
};

const transaction = <A>(database: SqliteDatabase["Service"]["database"], run: () => A) => {
  database.exec("BEGIN IMMEDIATE");

  try {
    const value = run();
    database.exec("COMMIT");
    return value;
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // ignore rollback errors
    }

    throw error;
  }
};

export class WorldRepository extends ServiceMap.Service<
  WorldRepository,
  {
    readonly createOrGetWorld: (
      record: CreateWorldRecord,
    ) => Effect.Effect<StoredWorld, StorageError | IdempotencyConflictError | WorldNameTakenError, never>;
    readonly findById: (
      worldId: string,
    ) => Effect.Effect<Option.Option<StoredWorld>, StorageError, never>;
    readonly listOwnWorlds: (
      hostPublicKey: string,
      query: NormalizedWorldListQuery,
    ) => Effect.Effect<StoredWorldPage, StorageError, never>;
    readonly listPublicWorlds: (
      query: NormalizedWorldListQuery,
    ) => Effect.Effect<StoredWorldPage, StorageError, never>;
  }
>()("refactory/WorldRepository") {
  static readonly Live = Layer.effect(
    WorldRepository,
    Effect.gen(function* () {
      const sqlite = yield* SqliteDatabase;
      const { database } = sqlite;

      const selectColumns = `world_id, host_public_key, host_name_snapshot, normalized_host_name_snapshot, idempotency_key,
        world_name, normalized_name, mode, visibility, status, world_schema_version, ruleset_version,
        map_id, spec_json, snapshot_json, failure_reason, created_at, updated_at`;

      const findById = Effect.fnUntraced(function*(worldId: string) {
        const row = yield* Effect.try({
          try: () =>
            database
              .query<WorldRow, [string]>(`SELECT ${selectColumns} FROM worlds WHERE world_id = ?1`)
              .get(worldId),
          catch: (cause) => new StorageError({ cause, operation: "worlds.findById" }),
        });

        return row === null ? Option.none() : Option.some(mapWorldRow(row));
      });

      const createOrGetWorld = Effect.fnUntraced(function*(record: CreateWorldRecord) {
        return yield* Effect.try({
          try: () =>
            transaction(database, () => {
              const existingByIdempotency = database
                .query<WorldRow, [string, string]>(
                  `SELECT ${selectColumns}
                   FROM worlds
                   WHERE host_public_key = ?1 AND idempotency_key = ?2`,
                )
                .get(record.actor.publicKey, record.idempotencyKey);

              if (existingByIdempotency !== null) {
                const world = mapWorldRow(existingByIdempotency);

                if (!isSameCreateIntent(world, record)) {
                  throw new IdempotencyConflictError({ idempotencyKey: record.idempotencyKey });
                }

                if (isRecoverableCreation(world)) {
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
                      JSON.stringify(record.spec),
                      JSON.stringify(record.snapshot),
                      record.updatedAt,
                    );

                  const repaired = database
                    .query<WorldRow, [string]>(`SELECT ${selectColumns} FROM worlds WHERE world_id = ?1`)
                    .get(world.worldId);

                  if (repaired === null) {
                    throw new Error("world disappeared during recovery");
                  }

                  return mapWorldRow(repaired);
                }

                return world;
              }

              const existingByName = database
                .query<WorldRow, [string, string]>(
                  `SELECT ${selectColumns}
                   FROM worlds
                   WHERE host_public_key = ?1 AND normalized_name = ?2`,
                )
                .get(record.actor.publicKey, record.normalizedName);

              if (existingByName !== null) {
                throw new WorldNameTakenError({ worldName: record.worldName });
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
                  JSON.stringify(record.spec),
                  JSON.stringify(record.snapshot),
                  record.createdAt,
                  record.updatedAt,
                );

              const inserted = database
                .query<WorldRow, [string]>(`SELECT ${selectColumns} FROM worlds WHERE world_id = ?1`)
                .get(record.worldId);

              if (inserted === null) {
                throw new Error("world insert did not return a row");
              }

              return mapWorldRow(inserted);
            }),
          catch: (cause) =>
            cause instanceof IdempotencyConflictError || cause instanceof WorldNameTakenError
              ? cause
              : new StorageError({ cause, operation: "worlds.createOrGetWorld" }),
        });
      });

      const listOwnWorlds = Effect.fnUntraced(function*(hostPublicKey: string, query: NormalizedWorldListQuery) {
        const limit = query.limit + 1;
        const searchPattern = query.normalizedSearch === undefined || query.normalizedSearch.length === 0
          ? null
          : `%${query.normalizedSearch}%`;
        const cursorUpdatedAt = query.cursor?.updatedAt ?? null;
        const cursorWorldId = query.cursor?.worldId ?? null;

        const rows = yield* Effect.try({
          try: () =>
            database
              .query<WorldRow, [string, string | null, string | null, string | null, number]>(
                `SELECT ${selectColumns}
                 FROM worlds
                 WHERE host_public_key = ?1
                   AND (?2 IS NULL OR normalized_name LIKE ?2 OR normalized_host_name_snapshot LIKE ?2 OR world_id LIKE ?2)
                   AND (?3 IS NULL OR updated_at < ?3 OR (updated_at = ?3 AND world_id < ?4))
                 ORDER BY updated_at DESC, world_id DESC
                 LIMIT ?5`,
              )
              .all(hostPublicKey, searchPattern, cursorUpdatedAt, cursorWorldId, limit),
          catch: (cause) => new StorageError({ cause, operation: "worlds.listOwnWorlds" }),
        });

        return finalizePage(rows, query.limit);
      });

      const listPublicWorlds = Effect.fnUntraced(function*(query: NormalizedWorldListQuery) {
        const limit = query.limit + 1;
        const searchPattern = query.normalizedSearch === undefined || query.normalizedSearch.length === 0
          ? null
          : `%${query.normalizedSearch}%`;
        const cursorUpdatedAt = query.cursor?.updatedAt ?? null;
        const cursorWorldId = query.cursor?.worldId ?? null;

        const rows = yield* Effect.try({
          try: () =>
            database
              .query<WorldRow, [string | null, string | null, string | null, number]>(
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
          catch: (cause) => new StorageError({ cause, operation: "worlds.listPublicWorlds" }),
        });

        return finalizePage(rows, query.limit);
      });

      return {
        createOrGetWorld,
        findById,
        listOwnWorlds,
        listPublicWorlds,
      };
    }),
  );
}

export class WorldService extends ServiceMap.Service<
  WorldService,
  {
    readonly createWorld: (
      actor: ActorContext,
      request: CreateWorldRequest,
    ) => Effect.Effect<WorldDetail, IdempotencyConflictError | InvalidWorldNameError | WorldNameTakenError, never>;
    readonly getWorld: (
      actor: ActorContext,
      worldId: string,
    ) => Effect.Effect<WorldDetail, WorldNotFoundError | WorldAccessDeniedError, never>;
    readonly listOwnWorlds: (
      actor: ActorContext,
      query: WorldListQuery,
    ) => Effect.Effect<Schema.Schema.Type<typeof ListWorldsResponse>, InvalidWorldCursorError, never>;
    readonly listPublicWorlds: (
      query: WorldListQuery,
    ) => Effect.Effect<Schema.Schema.Type<typeof ListWorldsResponse>, InvalidWorldCursorError, never>;
  }
>()("refactory/WorldService") {
  static readonly Live = Layer.effect(
    WorldService,
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const profiles = yield* ProfileRepository;
      const worlds = yield* WorldRepository;

      const createWorld = Effect.fnUntraced(function*(actor: ActorContext, request: CreateWorldRequest) {
        const normalizedName = normalizeSearchText(request.worldName);

        if (normalizedName.length === 0) {
          return yield* Effect.fail(new InvalidWorldNameError({ message: "World name cannot be empty" }));
        }

        const now = new Date().toISOString();
        const visibility = request.visibility ?? "private";

        yield* profiles.upsertProfile(actor, now).pipe(
          Effect.catchTag("StorageError", Effect.die),
        );

        const spec: WorldSpec = {
          hostAssetId: request.hostAssetId,
          mapId: "GPY-7",
          mode: request.mode,
          rulesetVersion: config.rulesetVersion,
          visibility,
          worldSchemaVersion: config.worldSchemaVersion,
        };
        const snapshot = buildWorldSnapshot(request.mode, request.hostAssetId, actor.publicKey);

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
        }).pipe(
          Effect.catchTag("StorageError", Effect.die),
        );

        return toWorldDetail(world);
      });

      const getWorld = Effect.fnUntraced(function*(actor: ActorContext, worldId: string) {
        yield* profiles.upsertProfile(actor, new Date().toISOString()).pipe(
          Effect.catchTag("StorageError", Effect.die),
        );

        const worldOption = yield* worlds.findById(worldId).pipe(
          Effect.catchTag("StorageError", Effect.die),
        );

        if (Option.isNone(worldOption)) {
          return yield* Effect.fail(new WorldNotFoundError({ worldId }));
        }

        const world = worldOption.value;
        const isOwner = world.hostPublicKey === actor.publicKey;
        const isPublicReadable = world.visibility === "public" && world.status === "ready";

        if (!isOwner && !isPublicReadable) {
          return yield* Effect.fail(new WorldAccessDeniedError({ worldId }));
        }

        return toWorldDetail(world);
      });

      const listOwnWorlds = Effect.fnUntraced(function*(actor: ActorContext, query: WorldListQuery) {
        yield* profiles.upsertProfile(actor, new Date().toISOString()).pipe(
          Effect.catchTag("StorageError", Effect.die),
        );

        const normalizedQuery = normalizeWorldListQuery(query);

        if (Option.isNone(normalizedQuery)) {
          return yield* Effect.fail(new InvalidWorldCursorError({ message: "World list cursor is invalid" }));
        }

        const page = yield* worlds.listOwnWorlds(actor.publicKey, normalizedQuery.value).pipe(
          Effect.catchTag("StorageError", Effect.die),
        );

        return {
          nextCursor: page.nextCursor,
          worlds: page.worlds.map(toWorldSummary),
        };
      });

      const listPublicWorlds = Effect.fnUntraced(function*(query: WorldListQuery) {
        const normalizedQuery = normalizeWorldListQuery(query);

        if (Option.isNone(normalizedQuery)) {
          return yield* Effect.fail(new InvalidWorldCursorError({ message: "World list cursor is invalid" }));
        }

        const page = yield* worlds.listPublicWorlds(normalizedQuery.value).pipe(
          Effect.catchTag("StorageError", Effect.die),
        );

        return {
          nextCursor: page.nextCursor,
          worlds: page.worlds.map(toWorldSummary),
        };
      });

      return {
        createWorld,
        getWorld,
        listOwnWorlds,
        listPublicWorlds,
      };
    }),
  );
}
