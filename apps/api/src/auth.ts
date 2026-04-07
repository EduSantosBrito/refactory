import {
  ActorAuth,
  ActorAuthError,
  CurrentActor,
  type ActorContext,
} from "@refactory/contracts/auth";
import { Effect, Layer, Redacted, Schema } from "effect";
import { HttpServerRequest } from "effect/unstable/http";

const maxActorClockSkewMs = 5 * 60 * 1000;

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
  const remainder = value.length % 4;

  if (remainder === 1) {
    return undefined;
  }

  const padding = remainder === 0 ? "" : remainder === 2 ? "==" : "=";

  return value.replaceAll("-", "+").replaceAll("_", "/") + padding;
};

const decodeBase64Url = (value: string) => {
  const normalized = normalizeBase64Url(value);

  if (normalized === undefined) {
    return undefined;
  }

  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  } catch {
    return undefined;
  }
};

const buildSigningPayload = (request: {
  readonly method: string;
  readonly url: string;
}, headers: SignedActorHeaders) =>
  [request.method.toUpperCase(), canonicalRequestTarget(request.url), String(headers["x-refactory-actor-timestamp"]), headers["x-refactory-actor-name"]].join("\n");

export const stripActorAuthSearchParams = (url: string) => {
  const parsed = new URL(url, "http://refactory.local");

  parsed.searchParams.delete("x-refactory-actor-key");
  parsed.searchParams.delete("x-refactory-actor-name");
  parsed.searchParams.delete("x-refactory-actor-signature");
  parsed.searchParams.delete("x-refactory-actor-timestamp");

  return `${parsed.pathname}${parsed.search}`;
};

export const verifySignedActorRequest = Effect.fnUntraced(function*(request: {
  readonly method: string;
  readonly url: string;
}, envelope: SignedActorEnvelope) {
  const now = Date.now();
  const ageMs = Math.abs(now - envelope["x-refactory-actor-timestamp"]);

  if (ageMs > maxActorClockSkewMs) {
    return yield* Effect.fail(new ActorAuthError({ message: "Actor signature timestamp is outside the allowed clock skew" }));
  }

  const publicKeyBytes = decodeBase64Url(envelope["x-refactory-actor-key"]);
  const signatureBytes = decodeBase64Url(envelope.signature);

  if (publicKeyBytes === undefined || signatureBytes === undefined) {
    return yield* Effect.fail(new ActorAuthError({ message: "Actor signature or public key is not valid base64url" }));
  }

  const publicKey = yield* Effect.tryPromise({
    try: () => crypto.subtle.importKey("raw", publicKeyBytes, "Ed25519", false, ["verify"]),
    catch: () => new ActorAuthError({ message: "Actor public key could not be imported" }),
  });

  const verified = yield* Effect.tryPromise({
    try: () =>
      crypto.subtle.verify(
        "Ed25519",
        publicKey,
        signatureBytes,
        new TextEncoder().encode(buildSigningPayload(request, envelope)),
      ),
    catch: () => new ActorAuthError({ message: "Actor signature verification failed" }),
  });

  if (!verified) {
    return yield* Effect.fail(new ActorAuthError({ message: "Actor signature is invalid" }));
  }

  const actor: ActorContext = {
    displayName: envelope["x-refactory-actor-name"],
    publicKey: envelope["x-refactory-actor-key"],
  };

  return actor;
});

export const ActorAuthLive = Layer.succeed(ActorAuth)({
  signature: Effect.fnUntraced(function*(httpEffect, options) {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const headers = yield* HttpServerRequest.schemaHeaders(SignedActorHeaders).pipe(
      Effect.mapError(() => new ActorAuthError({ message: "Missing or invalid actor headers" })),
    );
    const actor = yield* verifySignedActorRequest(request, {
      ...headers,
      signature: Redacted.value(options.credential),
    });

    return yield* Effect.provideService(httpEffect, CurrentActor, actor);
  }),
});
