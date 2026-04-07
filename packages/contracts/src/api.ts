import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { ActorAuth, ActorAuthError } from "./auth.ts";
import {
  SubmitWorldCommandRequest,
  SubmitWorldCommandResponse,
  WorldCommandQueueFullError,
} from "./commands.ts";
import {
  GetWorldRuntimeCheckpointResponse,
  GetWorldRuntimeResponse,
  WorldRuntimeUnavailableError,
} from "./runtime.ts";
import {
  CreateWorldRequest,
  CreateWorldResponse,
  GetWorldResponse,
  IdempotencyConflictError,
  InvalidWorldCursorError,
  InvalidWorldNameError,
  ListWorldsResponse,
  WorldAccessDeniedError,
  WorldListQuery,
  WorldNameTakenError,
  WorldNotFoundError,
} from "./worlds.ts";

const WorldIdParams = Schema.Struct({ worldId: Schema.String });

export const HealthResponse = Schema.Struct({
  name: Schema.String,
  status: Schema.Literal("ok"),
});

const actorDocsDescription = "Requires signed actor headers: x-refactory-actor-signature, x-refactory-actor-key, x-refactory-actor-name, x-refactory-actor-timestamp.";

const SystemApi = HttpApiGroup.make("system", { topLevel: true }).add(
  HttpApiEndpoint.get("health", "/health", {
    success: HealthResponse,
  }),
);

const WorldsApi = HttpApiGroup.make("worlds")
  .add(
    HttpApiEndpoint.post("createWorld", "/worlds", {
      error: [ActorAuthError, IdempotencyConflictError, InvalidWorldNameError, WorldNameTakenError],
      payload: CreateWorldRequest,
      success: CreateWorldResponse,
    })
      .middleware(ActorAuth)
      .annotate(OpenApi.Description, actorDocsDescription),
  )
  .add(
    HttpApiEndpoint.get("listOwnWorlds", "/worlds", {
      error: [ActorAuthError, InvalidWorldCursorError],
      query: WorldListQuery,
      success: ListWorldsResponse,
    })
      .middleware(ActorAuth)
      .annotate(OpenApi.Description, actorDocsDescription),
  )
  .add(
    HttpApiEndpoint.get("listPublicWorlds", "/worlds/public", {
      error: [InvalidWorldCursorError],
      query: WorldListQuery,
      success: ListWorldsResponse,
    }),
  )
  .add(
    HttpApiEndpoint.get("getWorld", "/worlds/:worldId", {
      error: [ActorAuthError, WorldAccessDeniedError, WorldNotFoundError],
      params: WorldIdParams,
      success: GetWorldResponse,
    })
      .middleware(ActorAuth)
      .annotate(OpenApi.Description, actorDocsDescription),
  )
  .add(
    HttpApiEndpoint.get("getWorldRuntime", "/worlds/:worldId/runtime", {
      error: [ActorAuthError, WorldAccessDeniedError, WorldNotFoundError, WorldRuntimeUnavailableError],
      params: WorldIdParams,
      success: GetWorldRuntimeResponse,
    })
      .middleware(ActorAuth)
      .annotate(OpenApi.Description, actorDocsDescription),
  )
  .add(
    HttpApiEndpoint.get("getWorldRuntimeCheckpoint", "/worlds/:worldId/runtime/checkpoint", {
      error: [ActorAuthError, WorldAccessDeniedError, WorldNotFoundError],
      params: WorldIdParams,
      success: GetWorldRuntimeCheckpointResponse,
    })
      .middleware(ActorAuth)
      .annotate(OpenApi.Description, actorDocsDescription),
  )
  .add(
    HttpApiEndpoint.post("submitWorldCommand", "/worlds/:worldId/commands", {
      error: [
        ActorAuthError,
        WorldAccessDeniedError,
        WorldCommandQueueFullError,
        WorldNotFoundError,
        WorldRuntimeUnavailableError,
      ],
      params: WorldIdParams,
      payload: SubmitWorldCommandRequest,
      success: SubmitWorldCommandResponse,
    })
      .middleware(ActorAuth)
      .annotate(OpenApi.Description, actorDocsDescription),
  );

export class Api extends HttpApi.make("refactory-api")
  .annotate(OpenApi.Title, "Refactory API")
  .annotate(OpenApi.Description, "World creation and registry API for Refactory.")
  .add(SystemApi, WorldsApi)
{}
