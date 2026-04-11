import { Schema } from "effect";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";
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
  DeleteWorldResponse,
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

export class InternalServerError extends Schema.ErrorClass<InternalServerError>(
  "refactory/InternalServerError",
)(
  {
    _tag: Schema.tag("InternalServerError"),
    message: Schema.String,
  },
  {
    description: "InternalServerError",
    httpApiStatus: 500,
  },
) {}

export class ServiceUnavailableError extends Schema.ErrorClass<ServiceUnavailableError>(
  "refactory/ServiceUnavailableError",
)(
  {
    _tag: Schema.tag("ServiceUnavailableError"),
    message: Schema.String,
  },
  {
    description: "ServiceUnavailableError",
    httpApiStatus: 503,
  },
) {}

const SystemApi = HttpApiGroup.make("system", { topLevel: true }).add(
  HttpApiEndpoint.get("health", "/health", {
    success: HealthResponse,
  }),
);

const WorldsApi = HttpApiGroup.make("worlds")
  .add(
    HttpApiEndpoint.post("createWorld", "/worlds", {
      error: [
        ActorAuthError,
        InternalServerError,
        IdempotencyConflictError,
        InvalidWorldNameError,
        ServiceUnavailableError,
        WorldNameTakenError,
      ],
      payload: CreateWorldRequest,
      success: CreateWorldResponse,
    })
      .middleware(ActorAuth)
      .annotate(
        OpenApi.Description,
        "Requires signed actor headers: x-refactory-actor-signature, x-refactory-actor-key, x-refactory-actor-name, x-refactory-actor-timestamp.",
      ),
  )
  .add(
    HttpApiEndpoint.get("listOwnWorlds", "/worlds", {
      error: [
        ActorAuthError,
        InternalServerError,
        InvalidWorldCursorError,
        ServiceUnavailableError,
      ],
      query: WorldListQuery,
      success: ListWorldsResponse,
    })
      .middleware(ActorAuth)
      .annotate(
        OpenApi.Description,
        "Requires signed actor headers: x-refactory-actor-signature, x-refactory-actor-key, x-refactory-actor-name, x-refactory-actor-timestamp.",
      ),
  )
  .add(
    HttpApiEndpoint.get("listPublicWorlds", "/worlds/public", {
      error: [
        InternalServerError,
        InvalidWorldCursorError,
        ServiceUnavailableError,
      ],
      query: WorldListQuery,
      success: ListWorldsResponse,
    }),
  )
  .add(
    HttpApiEndpoint.get("getWorld", "/worlds/:worldId", {
      error: [
        ActorAuthError,
        InternalServerError,
        ServiceUnavailableError,
        WorldAccessDeniedError,
        WorldNotFoundError,
      ],
      params: WorldIdParams,
      success: GetWorldResponse,
    })
      .middleware(ActorAuth)
      .annotate(
        OpenApi.Description,
        "Requires signed actor headers: x-refactory-actor-signature, x-refactory-actor-key, x-refactory-actor-name, x-refactory-actor-timestamp.",
      ),
  )
  .add(
    HttpApiEndpoint.delete("deleteWorld", "/worlds/:worldId", {
      error: [
        ActorAuthError,
        InternalServerError,
        ServiceUnavailableError,
        WorldAccessDeniedError,
        WorldNotFoundError,
      ],
      params: WorldIdParams,
      success: DeleteWorldResponse,
    })
      .middleware(ActorAuth)
      .annotate(
        OpenApi.Description,
        "Requires signed actor headers: x-refactory-actor-signature, x-refactory-actor-key, x-refactory-actor-name, x-refactory-actor-timestamp.",
      ),
  )
  .add(
    HttpApiEndpoint.get("getWorldRuntime", "/worlds/:worldId/runtime", {
      error: [
        ActorAuthError,
        InternalServerError,
        ServiceUnavailableError,
        WorldAccessDeniedError,
        WorldNotFoundError,
        WorldRuntimeUnavailableError,
      ],
      params: WorldIdParams,
      success: GetWorldRuntimeResponse,
    })
      .middleware(ActorAuth)
      .annotate(
        OpenApi.Description,
        "Requires signed actor headers: x-refactory-actor-signature, x-refactory-actor-key, x-refactory-actor-name, x-refactory-actor-timestamp.",
      ),
  )
  .add(
    HttpApiEndpoint.get(
      "getWorldRuntimeCheckpoint",
      "/worlds/:worldId/runtime/checkpoint",
      {
        error: [
          ActorAuthError,
          InternalServerError,
          ServiceUnavailableError,
          WorldAccessDeniedError,
          WorldNotFoundError,
        ],
        params: WorldIdParams,
        success: GetWorldRuntimeCheckpointResponse,
      },
    )
      .middleware(ActorAuth)
      .annotate(
        OpenApi.Description,
        "Requires signed actor headers: x-refactory-actor-signature, x-refactory-actor-key, x-refactory-actor-name, x-refactory-actor-timestamp.",
      ),
  )
  .add(
    HttpApiEndpoint.post("submitWorldCommand", "/worlds/:worldId/commands", {
      error: [
        ActorAuthError,
        InternalServerError,
        ServiceUnavailableError,
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
      .annotate(
        OpenApi.Description,
        "Requires signed actor headers: x-refactory-actor-signature, x-refactory-actor-key, x-refactory-actor-name, x-refactory-actor-timestamp.",
      ),
  );

export class Api extends HttpApi.make("refactory-api")
  .annotate(OpenApi.Title, "Refactory API")
  .annotate(
    OpenApi.Description,
    "World creation and registry API for Refactory.",
  )
  .add(SystemApi, WorldsApi) {}
