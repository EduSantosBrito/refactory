import { Schema, ServiceMap } from "effect";
import {
  HttpApiMiddleware,
  HttpApiSecurity,
  OpenApi,
} from "effect/unstable/httpapi";

export const ActorContext = Schema.Struct({
  displayName: Schema.String,
  publicKey: Schema.String,
});

export type ActorContext = Schema.Schema.Type<typeof ActorContext>;

export class CurrentActor extends ServiceMap.Service<
  CurrentActor,
  ActorContext
>()("refactory/CurrentActor") {}

export class ActorAuthError extends Schema.ErrorClass<ActorAuthError>(
  "refactory/ActorAuthError",
)(
  {
    _tag: Schema.tag("ActorAuthError"),
    message: Schema.String,
  },
  {
    description: "ActorAuthError",
    httpApiStatus: 401,
  },
) {}

const ActorSignatureSecurity = HttpApiSecurity.apiKey({
  in: "header",
  key: "x-refactory-actor-signature",
}).pipe(
  HttpApiSecurity.annotate(
    OpenApi.Description,
    "Requires a signed actor request. Send x-refactory-actor-signature plus x-refactory-actor-key, x-refactory-actor-name, and x-refactory-actor-timestamp.",
  ),
);

export class ActorAuth extends HttpApiMiddleware.Service<
  ActorAuth,
  {
    readonly provides: CurrentActor;
  }
>()("refactory/ActorAuth", {
  error: ActorAuthError,
  requiredForClient: true,
  security: {
    signature: ActorSignatureSecurity,
  },
}) {}
