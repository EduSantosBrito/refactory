import {
  Api,
  InternalServerError,
  ServiceUnavailableError,
} from "@refactory/contracts/api";
import { CurrentActor } from "@refactory/contracts/auth";
import { Effect, Layer } from "effect";
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi";
import { AppConfig } from "./app-config.ts";
import { WorldRuntimeService } from "./world-runtime.ts";
import { WorldService } from "./worlds.ts";

const SystemApiHandlers = HttpApiBuilder.group(Api, "system", (handlers) =>
  handlers.handle(
    "health",
    Effect.fnUntraced(function* () {
      const config = yield* AppConfig;

      return {
        name: config.apiName,
        status: "ok",
      };
    }),
  ),
);

const WorldsApiHandlers = HttpApiBuilder.group(Api, "worlds", (handlers) =>
  handlers
    .handle(
      "createWorld",
      Effect.fnUntraced(function* ({ payload }) {
        const actor = yield* CurrentActor;
        const worlds = yield* WorldService;
        const world = yield* worlds
          .createWorld(actor, payload)
          .pipe(
            Effect.catchTag("PersistenceDecodeError", () =>
              Effect.fail(
                new InternalServerError({
                  message: "Persisted data is invalid",
                }),
              ),
            ),
          )
          .pipe(
            Effect.catchTag("StorageError", () =>
              Effect.fail(
                new ServiceUnavailableError({
                  message: "Storage temporarily unavailable",
                }),
              ),
            ),
          )
          .pipe(
            Effect.catchTag("WorldAccessDeniedError", () =>
              Effect.fail(
                new InternalServerError({
                  message: "World creation authorization failed unexpectedly",
                }),
              ),
            ),
          );

        return { world };
      }),
    )
    .handle(
      "listOwnWorlds",
      Effect.fnUntraced(function* ({ query }) {
        const actor = yield* CurrentActor;
        const worlds = yield* WorldService;

        return yield* worlds
          .listOwnWorlds(actor, query)
          .pipe(
            Effect.catchTag("PersistenceDecodeError", () =>
              Effect.fail(
                new InternalServerError({
                  message: "Persisted data is invalid",
                }),
              ),
            ),
          )
          .pipe(
            Effect.catchTag("StorageError", () =>
              Effect.fail(
                new ServiceUnavailableError({
                  message: "Storage temporarily unavailable",
                }),
              ),
            ),
          );
      }),
    )
    .handle(
      "listPublicWorlds",
      Effect.fnUntraced(function* ({ query }) {
        const worlds = yield* WorldService;

        return yield* worlds
          .listPublicWorlds(query)
          .pipe(
            Effect.catchTag("PersistenceDecodeError", () =>
              Effect.fail(
                new InternalServerError({
                  message: "Persisted data is invalid",
                }),
              ),
            ),
          )
          .pipe(
            Effect.catchTag("StorageError", () =>
              Effect.fail(
                new ServiceUnavailableError({
                  message: "Storage temporarily unavailable",
                }),
              ),
            ),
          );
      }),
    )
    .handle(
      "getWorld",
      Effect.fnUntraced(function* ({ params }) {
        const actor = yield* CurrentActor;
        const worlds = yield* WorldService;
        const world = yield* worlds
          .getWorld(actor, params.worldId)
          .pipe(
            Effect.catchTag("InvalidWorldNameError", () =>
              Effect.fail(
                new InternalServerError({
                  message: "World lookup validation failed unexpectedly",
                }),
              ),
            ),
          )
          .pipe(
            Effect.catchTag("PersistenceDecodeError", () =>
              Effect.fail(
                new InternalServerError({
                  message: "Persisted data is invalid",
                }),
              ),
            ),
          )
          .pipe(
            Effect.catchTag("StorageError", () =>
              Effect.fail(
                new ServiceUnavailableError({
                  message: "Storage temporarily unavailable",
                }),
              ),
            ),
          );

        return { world };
      }),
    )
    .handle(
      "getWorldRuntime",
      Effect.fnUntraced(function* ({ params }) {
        const actor = yield* CurrentActor;
        const runtime = yield* WorldRuntimeService;
        const snapshot = yield* runtime
          .getWorldRuntime(actor, params.worldId)
          .pipe(
            Effect.catchTag("RuntimeEngineError", () =>
              Effect.fail(
                new InternalServerError({
                  message: "Runtime engine failed",
                }),
              ),
            ),
          );

        return { snapshot };
      }),
    )
    .handle(
      "getWorldRuntimeCheckpoint",
      Effect.fnUntraced(function* ({ params }) {
        const actor = yield* CurrentActor;
        const runtime = yield* WorldRuntimeService;
        const checkpoint = yield* runtime
          .getWorldRuntimeCheckpoint(actor, params.worldId)
          .pipe(
            Effect.catchTag("RuntimeEngineError", () =>
              Effect.fail(
                new InternalServerError({
                  message: "Runtime engine failed",
                }),
              ),
            ),
          )
          .pipe(
            Effect.catchTag("WorldRuntimeUnavailableError", () =>
              Effect.fail(
                new InternalServerError({
                  message: "World checkpoint was unavailable unexpectedly",
                }),
              ),
            ),
          );

        return { checkpoint };
      }),
    )
    .handle(
      "submitWorldCommand",
      Effect.fnUntraced(function* ({ params, payload }) {
        const actor = yield* CurrentActor;
        const runtime = yield* WorldRuntimeService;
        const receipt = yield* runtime
          .submitWorldCommand(actor, params.worldId, payload.command)
          .pipe(
            Effect.catchTag("RuntimeEngineError", () =>
              Effect.fail(
                new InternalServerError({
                  message: "Runtime engine failed",
                }),
              ),
            ),
          );

        return { receipt };
      }),
    ),
);

export const ApiRoutes = HttpApiBuilder.layer(Api, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide([SystemApiHandlers, WorldsApiHandlers]));

export const ApiDocs = HttpApiScalar.layer(Api, {
  path: "/docs",
  scalar: {
    defaultOpenAllTags: true,
    layout: "modern",
    showOperationId: true,
    theme: "deepSpace",
  },
});
