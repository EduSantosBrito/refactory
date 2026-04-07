import { Api } from "@refactory/contracts/api";
import { CurrentActor } from "@refactory/contracts/auth";
import { Effect, Layer } from "effect";
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi";
import { AppConfig } from "./app-config.ts";
import { WorldRuntimeService } from "./world-runtime.ts";
import { WorldService } from "./worlds.ts";

const SystemApiHandlers = HttpApiBuilder.group(
  Api,
  "system",
  Effect.fnUntraced(function* (handlers) {
    const config = yield* AppConfig;

    return handlers.handle("health", () =>
      Effect.succeed({
        name: config.apiName,
        status: "ok",
      }),
    );
  }),
);

const WorldsApiHandlers = HttpApiBuilder.group(
  Api,
  "worlds",
  Effect.fnUntraced(function* (handlers) {
    const worlds = yield* WorldService;
    const runtime = yield* WorldRuntimeService;

    return handlers
      .handle("createWorld", ({ payload }) =>
        Effect.flatMap(CurrentActor.asEffect(), (actor) =>
          Effect.map(worlds.createWorld(actor, payload), (world) => ({ world })),
        ),
      )
      .handle("listOwnWorlds", ({ query }) =>
        Effect.flatMap(CurrentActor.asEffect(), (actor) =>
          worlds.listOwnWorlds(actor, query),
        ),
      )
      .handle("listPublicWorlds", ({ query }) =>
        worlds.listPublicWorlds(query),
      )
      .handle("getWorld", ({ params }) =>
        Effect.flatMap(CurrentActor.asEffect(), (actor) =>
          Effect.map(worlds.getWorld(actor, params.worldId), (world) => ({ world })),
        ),
      )
      .handle("getWorldRuntime", ({ params }) =>
        Effect.flatMap(CurrentActor.asEffect(), (actor) =>
          Effect.map(runtime.getWorldRuntime(actor, params.worldId), (snapshot) => ({ snapshot })),
        ),
      )
      .handle("getWorldRuntimeCheckpoint", ({ params }) =>
        Effect.flatMap(CurrentActor.asEffect(), (actor) =>
          Effect.map(runtime.getWorldRuntimeCheckpoint(actor, params.worldId), (checkpoint) => ({ checkpoint })),
        ),
      )
      .handle("submitWorldCommand", ({ params, payload }) =>
        Effect.flatMap(CurrentActor.asEffect(), (actor) =>
          Effect.map(runtime.submitWorldCommand(actor, params.worldId, payload.command), (receipt) => ({ receipt })),
        ),
      );
  }),
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
