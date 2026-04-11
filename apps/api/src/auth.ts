import {
  ActorAuth,
  ActorAuthError,
  type ActorContext,
  CurrentActor,
} from "@refactory/contracts/auth";
import { Effect, Layer, Match, Redacted, Schema } from "effect";
import { HttpServerRequest } from "effect/unstable/http";

const maxActorClockSkewMs = 5 * 60 * 1000;
const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
const succeedVoid = () => Effect.void;

const SignedActorHeaders = Schema.Struct({
  "x-refactory-actor-key": Schema.String,
  "x-refactory-actor-name": Schema.String,
  "x-refactory-actor-timestamp": Schema.NumberFromString,
});

type SignedActorHeaders = Schema.Schema.Type<typeof SignedActorHeaders>;

export type SignedActorEnvelope = SignedActorHeaders & {
  readonly signature: string;
};

const canonicalRequestTarget = (url: string) => {
  const parsed = new URL(url, "http://refactory.local");
  return `${parsed.pathname}${parsed.search}`;
};

const normalizeBase64Url = (value: string) => {
  return Match.value(value.length % 4).pipe(
    Match.when(1, () => undefined),
    Match.orElse(
      (remainder) =>
        value.replaceAll("-", "+").replaceAll("_", "/") +
        "=".repeat((4 - remainder) % 4),
    ),
  );
};

const decodeBase64Url = (value: string) =>
  Match.value(normalizeBase64Url(value)).pipe(
    Match.when(Match.undefined, () => undefined),
    Match.when(
      (normalized) => !base64Pattern.test(normalized),
      () => undefined,
    ),
    Match.orElse((normalized) =>
      Uint8Array.from(Buffer.from(normalized, "base64")),
    ),
  );

const failIfDefined = (error: ActorAuthError | undefined) =>
  Match.value(error).pipe(
    Match.when(Match.undefined, succeedVoid),
    Match.orElse((definedError) => Effect.fail(definedError)),
  );

const buildSigningPayload = (
  request: {
    readonly method: string;
    readonly url: string;
  },
  headers: SignedActorHeaders,
) =>
  [
    request.method.toUpperCase(),
    canonicalRequestTarget(request.url),
    String(headers["x-refactory-actor-timestamp"]),
    headers["x-refactory-actor-name"],
  ].join("\n");

export const stripActorAuthSearchParams = Effect.fn(
  "api.auth.stripActorAuthSearchParams",
)(function* (
  url: string,
) {
  const parsed = yield* Effect.try({
    try: () => new URL(url, "http://refactory.local"),
    catch: () =>
      new ActorAuthError({
        message: "Actor request URL is invalid",
      }),
  });

  parsed.searchParams.delete("x-refactory-actor-key");
  parsed.searchParams.delete("x-refactory-actor-name");
  parsed.searchParams.delete("x-refactory-actor-signature");
  parsed.searchParams.delete("x-refactory-actor-timestamp");

  return `${parsed.pathname}${parsed.search}`;
});

export const verifySignedActorRequest = Effect.fn("api.auth.verifySignedActorRequest")(function* (
  request: {
    readonly method: string;
    readonly url: string;
  },
  envelope: SignedActorEnvelope,
) {
  const now = Date.now();
  const ageMs = Math.abs(now - envelope["x-refactory-actor-timestamp"]);

  yield* failIfDefined(
    Match.value(ageMs > maxActorClockSkewMs).pipe(
      Match.when(
        true,
        () =>
          new ActorAuthError({
            message:
              "Actor signature timestamp is outside the allowed clock skew",
          }),
      ),
      Match.orElse(() => undefined),
    ),
  );

  const publicKeyBytes = decodeBase64Url(envelope["x-refactory-actor-key"]);
  const signatureBytes = decodeBase64Url(envelope.signature);

  const [validPublicKeyBytes, validSignatureBytes] = yield* Match.value({
    publicKeyBytes,
    signatureBytes,
  }).pipe(
    Match.when(
      {
        publicKeyBytes: Match.defined,
        signatureBytes: Match.defined,
      },
      ({ publicKeyBytes, signatureBytes }) =>
        Effect.succeed([publicKeyBytes, signatureBytes] as const),
    ),
    Match.orElse(() =>
      Effect.fail(
        new ActorAuthError({
          message: "Actor signature or public key is not valid base64url",
        }),
      ),
    ),
  );

  const publicKey = yield* Effect.tryPromise({
    try: () =>
      crypto.subtle.importKey("raw", validPublicKeyBytes, "Ed25519", false, [
        "verify",
      ]),
    catch: () =>
      new ActorAuthError({ message: "Actor public key could not be imported" }),
  });

  const verified = yield* Effect.tryPromise({
    try: () =>
      crypto.subtle.verify(
        "Ed25519",
        publicKey,
        validSignatureBytes,
        new TextEncoder().encode(buildSigningPayload(request, envelope)),
      ),
    catch: () =>
      new ActorAuthError({ message: "Actor signature verification failed" }),
  });

  yield* failIfDefined(
    Match.value(verified).pipe(
      Match.when(
        false,
        () =>
          new ActorAuthError({
            message: "Actor signature is invalid",
          }),
      ),
      Match.orElse(() => undefined),
    ),
  );

  const actor: ActorContext = {
    displayName: envelope["x-refactory-actor-name"],
    publicKey: envelope["x-refactory-actor-key"],
  };

  return actor;
});

export const ActorAuthLive = Layer.succeed(ActorAuth)({
  signature: Effect.fn("api.auth.signature")(function* (httpEffect, options) {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const headers = yield* HttpServerRequest.schemaHeaders(
      SignedActorHeaders,
    ).pipe(
      Effect.mapError(
        () =>
          new ActorAuthError({ message: "Missing or invalid actor headers" }),
      ),
    );
    const actor = yield* verifySignedActorRequest(request, {
      ...headers,
      signature: Redacted.value(options.credential),
    });

    return yield* Effect.provideService(httpEffect, CurrentActor, actor);
  }),
});
