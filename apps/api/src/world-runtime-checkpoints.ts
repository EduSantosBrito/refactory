import type {
  WorldRuntimeCheckpoint,
  WorldRuntimeSnapshot,
} from "@refactory/contracts/runtime";
import {
  WorldRuntimeCheckpoint as WorldRuntimeCheckpointSchema,
  WorldRuntimeSnapshot as WorldRuntimeSnapshotSchema,
} from "@refactory/contracts/runtime";
import { Effect, Layer, Option, Schema, ServiceMap } from "effect";
import { PersistenceDecodeError } from "./backend-errors.ts";
import { SqliteDatabase, StorageError } from "./sqlite.ts";

type WorldRuntimeCheckpointRow = {
  readonly saved_at: string;
  readonly snapshot_json: string;
  readonly tick: number;
};

const decodeCheckpoint = Schema.decodeUnknownEffect(
  WorldRuntimeCheckpointSchema,
);
const decodeCheckpointSnapshot = Schema.decodeUnknownEffect(
  Schema.fromJsonString(WorldRuntimeSnapshotSchema),
);
const encodeCheckpointSnapshot = Schema.encodeEffect(
  Schema.fromJsonString(WorldRuntimeSnapshotSchema),
);

const parseCheckpointSnapshotColumn = (json: string) =>
  decodeCheckpointSnapshot(json).pipe(
    Effect.mapError(
      (cause) =>
        new PersistenceDecodeError({
          cause,
          entity: "world_runtime_snapshot",
        }),
    ),
  );

const mapCheckpointRow = (row: WorldRuntimeCheckpointRow) =>
  parseCheckpointSnapshotColumn(row.snapshot_json).pipe(
    Effect.map(
      (snapshot): WorldRuntimeCheckpoint => ({
        savedAt: row.saved_at,
        snapshot,
      }),
    ),
  );

const decodeStoredCheckpoint = (row: WorldRuntimeCheckpointRow) =>
  mapCheckpointRow(row).pipe(
    Effect.flatMap(decodeCheckpoint),
    Effect.mapError(
      (cause) =>
        new PersistenceDecodeError({
          cause,
          entity: "world_runtime_checkpoint",
        }),
    ),
    Effect.map((checkpoint) => Option.some(checkpoint)),
  );

export class RuntimeCheckpointStore extends ServiceMap.Service<RuntimeCheckpointStore>()(
  "refactory/RuntimeCheckpointStore",
  {
    make: Effect.gen(function* () {
      const sqlite = yield* SqliteDatabase;
      const { database } = sqlite;

      const loadLatest = Effect.fnUntraced(function* (worldId: string) {
        const row = yield* Effect.try({
          try: () =>
            database
              .query<WorldRuntimeCheckpointRow, [string]>(
                `SELECT tick, saved_at, snapshot_json
                 FROM world_runtime_checkpoints
                 WHERE world_id = ?1`,
              )
              .get(worldId),
          catch: (cause) =>
            new StorageError({
              cause,
              operation: "runtime_checkpoints.loadLatest",
            }),
        });

        return yield* Option.match(Option.fromNullishOr(row), {
          onNone: () => Effect.succeed(Option.none()),
          onSome: decodeStoredCheckpoint,
        });
      });

      const save = Effect.fnUntraced(function* (
        snapshot: WorldRuntimeSnapshot,
        savedAt: string,
      ) {
        const snapshotJson = yield* encodeCheckpointSnapshot(snapshot).pipe(
          Effect.mapError(
            (cause) =>
              new PersistenceDecodeError({
                cause,
                entity: "world_runtime_snapshot",
              }),
          ),
        );

        yield* Effect.try({
          try: () => {
            database
              .query(
                `INSERT INTO world_runtime_checkpoints (world_id, tick, saved_at, snapshot_json)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(world_id)
                 DO UPDATE SET tick = excluded.tick, saved_at = excluded.saved_at, snapshot_json = excluded.snapshot_json`,
              )
              .run(snapshot.worldId, snapshot.tick, savedAt, snapshotJson);
          },
          catch: (cause) =>
            new StorageError({ cause, operation: "runtime_checkpoints.save" }),
        });
      });

      return {
        loadLatest,
        save,
      };
    }),
  },
) {
  static readonly Live = Layer.effect(
    RuntimeCheckpointStore,
    RuntimeCheckpointStore.make,
  );
}
