import { Data, Effect, Schema } from "effect";

const defaultActorStorageKey = "refactory.actor.v1";
const signingAlgorithm = "Ed25519";

const StoredActorMaterial = Schema.Struct({
  displayName: Schema.String,
  privateKeyPkcs8: Schema.String,
  publicKeyRaw: Schema.String,
  version: Schema.Literal(1),
});

type StoredActorMaterial = Schema.Schema.Type<typeof StoredActorMaterial>;

export type ActorCredentials = {
  readonly displayName: string;
  readonly keyPair: CryptoKeyPair;
  readonly publicKey: string;
};

export class ActorStorageError extends Data.TaggedError("ActorStorageError")<{
  readonly cause: unknown;
  readonly operation: string;
}> {}

export class ActorCryptoError extends Data.TaggedError("ActorCryptoError")<{
  readonly cause: unknown;
  readonly operation: string;
}> {}

export class ActorDecodeError extends Data.TaggedError("ActorDecodeError")<{
  readonly cause: unknown;
  readonly operation: string;
}> {}

const decodeStoredActorMaterial = Schema.decodeUnknownSync(StoredActorMaterial);

const isCryptoKeyPair = (value: CryptoKeyPair | CryptoKey): value is CryptoKeyPair =>
  typeof value === "object" && value !== null && "publicKey" in value && "privateKey" in value;

const encodeBase64Url = (bytes: Uint8Array) => {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
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

const storageGet = Effect.fnUntraced(function*(storageKey: string) {
  return yield* Effect.try({
    try: () => window.localStorage.getItem(storageKey),
    catch: (cause) => new ActorStorageError({ cause, operation: "actor.storage.get" }),
  });
});

const storageSet = Effect.fnUntraced(function*(storageKey: string, value: string) {
  yield* Effect.try({
    try: () => {
      window.localStorage.setItem(storageKey, value);
    },
    catch: (cause) => new ActorStorageError({ cause, operation: "actor.storage.set" }),
  });
});

const parseStoredActorMaterial = Effect.fnUntraced(function*(raw: string) {
  const parsed = yield* Effect.try({
    try: () => {
      const value: unknown = JSON.parse(raw);
      return value;
    },
    catch: (cause) => new ActorDecodeError({ cause, operation: "actor.storage.parse" }),
  });

  return yield* Effect.try({
    try: () => decodeStoredActorMaterial(parsed),
    catch: (cause) => new ActorDecodeError({ cause, operation: "actor.storage.decode" }),
  });
});

const importActorKeyPair = Effect.fnUntraced(function*(stored: StoredActorMaterial) {
  const publicKeyBytes = decodeBase64Url(stored.publicKeyRaw);
  const privateKeyBytes = decodeBase64Url(stored.privateKeyPkcs8);

  if (publicKeyBytes === undefined || privateKeyBytes === undefined) {
    return yield* Effect.fail(
      new ActorDecodeError({ cause: stored, operation: "actor.storage.base64url" }),
    );
  }

  const publicKey = yield* Effect.tryPromise({
    try: () => crypto.subtle.importKey("raw", publicKeyBytes, signingAlgorithm, true, ["verify"]),
    catch: (cause) => new ActorCryptoError({ cause, operation: "actor.crypto.importPublicKey" }),
  });
  const privateKey = yield* Effect.tryPromise({
    try: () => crypto.subtle.importKey("pkcs8", privateKeyBytes, signingAlgorithm, true, ["sign"]),
    catch: (cause) => new ActorCryptoError({ cause, operation: "actor.crypto.importPrivateKey" }),
  });

  return {
    displayName: stored.displayName,
    keyPair: { privateKey, publicKey },
    publicKey: stored.publicKeyRaw,
  } satisfies ActorCredentials;
});

const generateActorCredentials = Effect.fnUntraced(function*(displayName: string) {
  const generated = yield* Effect.tryPromise({
    try: () => crypto.subtle.generateKey(signingAlgorithm, true, ["sign", "verify"]),
    catch: (cause) => new ActorCryptoError({ cause, operation: "actor.crypto.generateKeyPair" }),
  });

  if (!isCryptoKeyPair(generated)) {
    return yield* Effect.fail(
      new ActorCryptoError({ cause: generated, operation: "actor.crypto.invalidKeyPair" }),
    );
  }

  const exportedPublicKey = yield* Effect.tryPromise({
    try: () => crypto.subtle.exportKey("raw", generated.publicKey),
    catch: (cause) => new ActorCryptoError({ cause, operation: "actor.crypto.exportPublicKey" }),
  });
  const exportedPrivateKey = yield* Effect.tryPromise({
    try: () => crypto.subtle.exportKey("pkcs8", generated.privateKey),
    catch: (cause) => new ActorCryptoError({ cause, operation: "actor.crypto.exportPrivateKey" }),
  });

  const stored: StoredActorMaterial = {
    displayName,
    privateKeyPkcs8: encodeBase64Url(new Uint8Array(exportedPrivateKey)),
    publicKeyRaw: encodeBase64Url(new Uint8Array(exportedPublicKey)),
    version: 1,
  };

  return {
    credentials: {
      displayName,
      keyPair: generated,
      publicKey: stored.publicKeyRaw,
    } satisfies ActorCredentials,
    stored,
  };
});

const updateStoredDisplayName = (stored: StoredActorMaterial, displayName: string): StoredActorMaterial => ({
  ...stored,
  displayName,
});

/**
 * Load the browser actor identity or create one if none exists yet.
 *
 * @remarks
 * Signed world endpoints require a durable actor keypair, but callers should not need to care whether they are resuming an existing identity or bootstrapping a new one.
 *
 * This reads actor material from `localStorage`, decodes and imports it when present, or generates a fresh Ed25519 keypair and persists it when absent.
 *
 * @param options - The display name to associate with the local actor and an optional storage key override.
 * @returns An `Effect` that yields the usable actor credentials.
 */
export const getOrCreateActorCredentials = Effect.fnUntraced(function*(options: {
  readonly displayName: string;
  readonly storageKey?: string;
}) {
  const storageKey = options.storageKey ?? defaultActorStorageKey;
  const existing = yield* storageGet(storageKey);

  if (existing === null) {
    const generated = yield* generateActorCredentials(options.displayName);
    yield* storageSet(storageKey, JSON.stringify(generated.stored));
    return generated.credentials;
  }

  const stored = yield* parseStoredActorMaterial(existing);
  const normalized = stored.displayName === options.displayName ? stored : updateStoredDisplayName(stored, options.displayName);

  if (normalized !== stored) {
    yield* storageSet(storageKey, JSON.stringify(normalized));
  }

  return yield* importActorKeyPair(normalized);
});

/**
 * Produce the signed actor headers expected by the backend auth middleware.
 *
 * @remarks
 * Request signing is part of the wire contract for protected endpoints, so the canonical payload and header set should live in one place.
 *
 * This builds the signing payload from method, path/query, timestamp, and display name, signs it with the actor's Ed25519 private key, and returns the `x-refactory-*` headers.
 *
 * @param options - The actor credentials plus the request method and canonical path/query string to sign.
 * @returns An `Effect` that yields the signed actor headers.
 */
export const makeSignedActorHeaders = Effect.fnUntraced(function*(options: {
  readonly actor: ActorCredentials;
  readonly method: string;
  readonly pathAndQuery: string;
}) {
  const timestamp = String(Date.now());
  const payload = [options.method.toUpperCase(), options.pathAndQuery, timestamp, options.actor.displayName].join("\n");
  const signature = yield* Effect.tryPromise({
    try: () => crypto.subtle.sign(signingAlgorithm, options.actor.keyPair.privateKey, new TextEncoder().encode(payload)),
    catch: (cause) => new ActorCryptoError({ cause, operation: "actor.crypto.sign" }),
  });

  return {
    "x-refactory-actor-key": options.actor.publicKey,
    "x-refactory-actor-name": options.actor.displayName,
    "x-refactory-actor-signature": encodeBase64Url(new Uint8Array(signature)),
    "x-refactory-actor-timestamp": timestamp,
  };
});
