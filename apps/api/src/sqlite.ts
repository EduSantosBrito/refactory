import { Database } from "bun:sqlite";
import { Data, Effect, Layer, ServiceMap } from "effect";
import { AppConfig } from "./app-config.ts";

const schemaSql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  public_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worlds (
  world_id TEXT PRIMARY KEY,
  host_public_key TEXT NOT NULL REFERENCES profiles(public_key),
  host_name_snapshot TEXT NOT NULL,
  normalized_host_name_snapshot TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  world_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('solo', 'multiplayer')),
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public')),
  status TEXT NOT NULL CHECK (status IN ('creating', 'ready', 'archived', 'creation_failed')),
  world_schema_version INTEGER NOT NULL,
  ruleset_version TEXT NOT NULL,
  map_id TEXT NOT NULL,
  spec_json TEXT,
  snapshot_json TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(host_public_key, idempotency_key),
  UNIQUE(host_public_key, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_worlds_host_public_key ON worlds(host_public_key);
CREATE INDEX IF NOT EXISTS idx_worlds_visibility_status ON worlds(visibility, status);
CREATE INDEX IF NOT EXISTS idx_worlds_updated_at ON worlds(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_worlds_host_listing ON worlds(host_public_key, updated_at DESC, world_id DESC);
CREATE INDEX IF NOT EXISTS idx_worlds_public_listing ON worlds(visibility, status, updated_at DESC, world_id DESC);
`;

type TableInfoRow = {
  readonly name: string;
};

const ensureWorldColumn = (database: Database, columnName: string, definition: string) => {
  const columns = database.query<TableInfoRow, []>("PRAGMA table_info(worlds)").all();

  if (!columns.some((column) => column.name === columnName)) {
    database.exec(`ALTER TABLE worlds ADD COLUMN ${definition}`);
  }
};

const migrateWorldsTable = (database: Database) => {
  ensureWorldColumn(database, "host_name_snapshot", "host_name_snapshot TEXT NOT NULL DEFAULT 'Unknown Host'");
  ensureWorldColumn(database, "normalized_host_name_snapshot", "normalized_host_name_snapshot TEXT NOT NULL DEFAULT 'unknown host'");

  database.exec(`
    UPDATE worlds
    SET host_name_snapshot = COALESCE(
          NULLIF(host_name_snapshot, ''),
          (SELECT display_name FROM profiles WHERE profiles.public_key = worlds.host_public_key),
          'Unknown Host'
        ),
        normalized_host_name_snapshot = lower(COALESCE(
          NULLIF(host_name_snapshot, ''),
          (SELECT display_name FROM profiles WHERE profiles.public_key = worlds.host_public_key),
          'Unknown Host'
        ))
    WHERE host_name_snapshot IS NULL
       OR host_name_snapshot = ''
       OR normalized_host_name_snapshot IS NULL
       OR normalized_host_name_snapshot = '';
  `);
};

export class StorageError extends Data.TaggedError("StorageError")<{
  readonly cause: unknown;
  readonly operation: string;
}> {}

export class SqliteDatabase extends ServiceMap.Service<
  SqliteDatabase,
  {
    readonly database: Database;
  }
>()("refactory/SqliteDatabase") {
  static readonly Live = Layer.effect(
    SqliteDatabase,
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const database = new Database(config.databasePath);

      database.exec(schemaSql);
      migrateWorldsTable(database);

      return { database };
    }),
  );
}
