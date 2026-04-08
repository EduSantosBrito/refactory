import { expect, test } from "bun:test";
import { Layer, ManagedRuntime } from "effect";
import { AppConfig } from "./app-config.ts";
import { SqliteDatabase } from "./sqlite.ts";

const testAppConfig = Layer.succeed(AppConfig, {
  apiName: "refactory-api",
  databasePath: ":memory:",
  port: 3001,
  rulesetVersion: "gpy7-v1",
  worldSchemaVersion: 1,
});

test("SqliteDatabase closes database when runtime disposes", async () => {
  const runtime = ManagedRuntime.make(
    SqliteDatabase.Live.pipe(Layer.provide(testAppConfig)),
  );
  const sqlite = await runtime.runPromise(SqliteDatabase.asEffect());

  expect(sqlite.database.query("SELECT 1 AS value").get()).toEqual({
    value: 1,
  });

  await runtime.dispose();

  expect(() => sqlite.database.query("SELECT 1 AS value").get()).toThrow();
});
