import type { WorldRuntimeCheckpoint, WorldRuntimeSnapshot } from "@refactory/contracts/runtime";
import { WorldRuntimeCheckpoint as WorldRuntimeCheckpointSchema, WorldRuntimeSnapshot as WorldRuntimeSnapshotSchema } from "@refactory/contracts/runtime";
import { Effect, Layer, Option, Schema, ServiceMap } from "effect";
import { SqliteDatabase, StorageError } from "./sqlite.ts";

type WorldRuntimeCheckpointRow = {
  readonly saved_at: string;
  readonly snapshot_json: string;
  readonly tick: number;
};

const decodeCheckpoint = Schema.decodeUnknownSync(WorldRuntimeCheckpointSchema);
const decodeSnapshot = Schema.decodeUnknownSync(WorldRuntimeSnapshotSchema);

const parseJsonColumn = <A>(json: string, decode: (value: unknown) => A) => decode(JSON.parse(json));

const mapCheckpointRow = (row: WorldRuntimeCheckpointRow): WorldRuntimeCheckpoint => ({
  savedAt: row.saved_at,
  snapshot: parseJsonColumn(row.snapshot_json, decodeSnapshot),
});

export class RuntimeCheckpointStore extends ServiceMap.Service<
  RuntimeCheckpointStore,
  {
    readonly loadLatest: (worldId: string) => Effect.Effect<Option.Option<WorldRuntimeCheckpoint>, StorageError, never>;
    readonly save: (snapshot: WorldRuntimeSnapshot, savedAt: string) => Effect.Effect<void, StorageError, never>;
  }
>()("refactory/RuntimeCheckpointStore") {
  static readonly Live = Layer.effect(
    RuntimeCheckpointStore,
    Effect.gen(function* () {
      const sqlite = yield* SqliteDatabase;
      const { database } = sqlite;

      const loadLatest = Effect.fnUntraced(function*(worldId: string) {
        const row = yield* Effect.try({
          try: () =>
            database
              .query<WorldRuntimeCheckpointRow, [string]>(
                `SELECT tick, saved_at, snapshot_json
                 FROM world_runtime_checkpoints
                 WHERE world_id = ?1`,
              )
              .get(worldId),
          catch: (cause) => new StorageError({ cause, operation: "runtime_checkpoints.loadLatest" }),
        });

        if (row === null) {
          return Option.none();
        }

        return Option.some(
          yield* Effect.try({
            try: () => decodeCheckpoint(mapCheckpointRow(row)),
            catch: (cause) => new StorageError({ cause, operation: "runtime_checkpoints.decodeLatest" }),
          }),
        );
      });

      const save = Effect.fnUntraced(function*(snapshot: WorldRuntimeSnapshot, savedAt: string) {
        yield* Effect.try({
          try: () => {
            database
              .query(
                `INSERT INTO world_runtime_checkpoints (world_id, tick, saved_at, snapshot_json)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(world_id)
                 DO UPDATE SET tick = excluded.tick, saved_at = excluded.saved_at, snapshot_json = excluded.snapshot_json`,
              )
              .run(snapshot.worldId, snapshot.tick, savedAt, JSON.stringify(snapshot));
          },
          catch: (cause) => new StorageError({ cause, operation: "runtime_checkpoints.save" }),
        });
      });

      return {
        loadLatest,
        save,
      };
    }),
  );
}
