import { expect, test } from "bun:test";
import type { ActorContext } from "@refactory/contracts/auth";
import { Layer, ManagedRuntime } from "effect";
import { AppConfig } from "./app-config.ts";
import { ProfileRepository } from "./profiles.ts";
import { SqliteDatabase } from "./sqlite.ts";
import { WorldRepository, WorldService } from "./worlds.ts";

const testAppConfig = Layer.succeed(AppConfig, {
  apiName: "refactory-api",
  databasePath: ":memory:",
  port: 3001,
  rulesetVersion: "gpy7-v1",
  telemetryEnabled: false,
  telemetryOtlpBaseUrl: "http://localhost:4318",
  telemetryServiceName: "refactory-api",
  telemetryServiceVersion: "test",
  worldSchemaVersion: 1,
});

const makeRuntime = () =>
  ManagedRuntime.make(
    WorldService.Live.pipe(
      Layer.provide(
        Layer.mergeAll(
          testAppConfig,
          Layer.mergeAll(ProfileRepository.Live, WorldRepository.Live).pipe(
            Layer.provide(
              SqliteDatabase.Live.pipe(Layer.provide(testAppConfig)),
            ),
          ),
        ),
      ),
    ),
  );

const actor: ActorContext = {
  displayName: "Host",
  publicKey: "host-public-key",
};

const otherActor: ActorContext = {
  displayName: "Visitor",
  publicKey: "visitor-public-key",
};

test("WorldService deletes only worlds owned by the actor", async () => {
  const runtime = makeRuntime();

  try {
    const worlds = await runtime.runPromise(WorldService.asEffect());
    const world = await runtime.runPromise(
      worlds.createWorld(actor, {
        hostAssetId: "BAR-001",
        idempotencyKey: "delete-world-test",
        mode: "solo",
        visibility: "private",
        worldName: "Delete Test World",
      }),
    );

    await expect(
      runtime.runPromise(worlds.deleteWorld(otherActor, world.worldId)),
    ).rejects.toMatchObject({
      _tag: "WorldAccessDeniedError",
      worldId: world.worldId,
    });

    await expect(
      runtime.runPromise(worlds.deleteWorld(actor, world.worldId)),
    ).resolves.toEqual({ worldId: world.worldId });

    await expect(
      runtime.runPromise(worlds.getWorld(actor, world.worldId)),
    ).rejects.toMatchObject({
      _tag: "WorldNotFoundError",
      worldId: world.worldId,
    });
  } finally {
    await runtime.dispose();
  }
});

test("WorldService keeps portal query params on portal-created worlds", async () => {
  const runtime = makeRuntime();

  try {
    const worlds = await runtime.runPromise(WorldService.asEffect());
    const world = await runtime.runPromise(
      worlds.createWorld(actor, {
        hostAssetId: "FRO-003",
        idempotencyKey: "portal-world-test",
        mode: "solo",
        portal: {
          queryParams: {
            color: "green",
            ref: "previous-game.example/play",
            username: "Operator",
          },
        },
        visibility: "private",
        worldName: "Portal Test World",
      }),
    );

    expect(world.spec?.portal?.queryParams).toEqual({
      color: "green",
      ref: "previous-game.example/play",
      username: "Operator",
    });

    const loadedWorld = await runtime.runPromise(
      worlds.getWorld(actor, world.worldId),
    );

    expect(loadedWorld.spec?.portal?.queryParams).toEqual({
      color: "green",
      ref: "previous-game.example/play",
      username: "Operator",
    });
  } finally {
    await runtime.dispose();
  }
});
