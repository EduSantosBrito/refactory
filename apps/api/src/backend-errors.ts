import {
  InternalServerError,
  ServiceUnavailableError,
} from "@refactory/contracts/api";
import { ActorAuthError } from "@refactory/contracts/auth";
import { WorldCommandQueueFullError } from "@refactory/contracts/commands";
import { WorldRuntimeUnavailableError } from "@refactory/contracts/runtime";
import {
  IdempotencyConflictError,
  InvalidWorldCursorError,
  InvalidWorldNameError,
  WorldAccessDeniedError,
  WorldNameTakenError,
  WorldNotFoundError,
} from "@refactory/contracts/worlds";
import { Data, Effect, Match } from "effect";
import { StorageError } from "./sqlite.ts";

export class RequestDecodeError extends Data.TaggedError("RequestDecodeError")<{
  readonly boundary: string;
  readonly cause: unknown;
  readonly message: string;
}> {}

export class PersistenceDecodeError extends Data.TaggedError(
  "PersistenceDecodeError",
)<{
  readonly cause: unknown;
  readonly entity: string;
}> {}

export class RuntimeEngineError extends Data.TaggedError("RuntimeEngineError")<{
  readonly cause: unknown;
  readonly message: string;
  readonly worldId: string;
}> {}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    status,
  });

const toApiError = <E>(
  error: E | StorageError | PersistenceDecodeError | RuntimeEngineError,
) =>
  Match.value(error).pipe(
    Match.when(
      Match.instanceOf(StorageError),
      () =>
        new ServiceUnavailableError({
          message: "Storage temporarily unavailable",
        }),
    ),
    Match.when(
      Match.instanceOf(PersistenceDecodeError),
      () =>
        new InternalServerError({
          message: "Persisted data is invalid",
        }),
    ),
    Match.when(
      Match.instanceOf(RuntimeEngineError),
      () =>
        new InternalServerError({
          message: "Runtime engine failed",
        }),
    ),
    Match.orElse((unmappedError) => unmappedError),
  );

const errorResponse = (error: unknown) =>
  Match.value(toApiError(error)).pipe(
    Match.when(Match.instanceOf(ActorAuthError), (actorAuthError) =>
      json({ _tag: "ActorAuthError", message: actorAuthError.message }, 401),
    ),
    Match.when(Match.instanceOf(RequestDecodeError), ({ _tag, message }) =>
      json({ _tag, message }, 400),
    ),
    Match.when(Match.instanceOf(InvalidWorldCursorError), ({ _tag, message }) =>
      json({ _tag, message }, 400),
    ),
    Match.when(Match.instanceOf(InvalidWorldNameError), ({ _tag, message }) =>
      json({ _tag, message }, 400),
    ),
    Match.when(Match.instanceOf(IdempotencyConflictError), (conflictError) =>
      json(conflictError, 409),
    ),
    Match.when(Match.instanceOf(WorldNameTakenError), (nameTakenError) =>
      json(nameTakenError, 409),
    ),
    Match.when(
      Match.instanceOf(WorldRuntimeUnavailableError),
      (runtimeUnavailableError) => json(runtimeUnavailableError, 409),
    ),
    Match.when(Match.instanceOf(WorldAccessDeniedError), (accessDeniedError) =>
      json(accessDeniedError, 403),
    ),
    Match.when(Match.instanceOf(WorldNotFoundError), (notFoundError) =>
      json(notFoundError, 404),
    ),
    Match.when(Match.instanceOf(WorldCommandQueueFullError), (queueFullError) =>
      json(queueFullError, 503),
    ),
    Match.when(
      Match.instanceOf(ServiceUnavailableError),
      (serviceUnavailableError) => json(serviceUnavailableError, 503),
    ),
    Match.when(Match.instanceOf(InternalServerError), (internalServerError) =>
      json(internalServerError, 500),
    ),
    Match.orElse(() =>
      json(
        { _tag: "InternalServerError", message: "Internal server error" },
        500,
      ),
    ),
  );

export const toErrorResponse = Effect.fnUntraced(function* (error: unknown) {
  return yield* Effect.succeed(errorResponse(error));
});
