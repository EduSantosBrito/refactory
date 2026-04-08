import type {
  WorldRuntimeDeltaMessage,
  WorldRuntimeSnapshotMessage,
} from "@refactory/contracts/runtime";
import {
  type WorldCommandQueuedMessage,
  type WorldCommandReceiptMessage,
  type WorldRuntimeResyncRequiredMessage,
  WorldRuntimeServerMessage,
} from "@refactory/contracts/socket";

export {
  SubmitWorldCommandRequest,
  SubmitWorldCommandResponse,
  WorldCommand,
  WorldCommandReceipt,
} from "@refactory/contracts/commands";
export {
  GetWorldRuntimeCheckpointResponse,
  GetWorldRuntimeResponse,
  WorldRuntimeDelta,
  WorldRuntimeDeltaMessage,
  WorldRuntimeSnapshot,
  WorldRuntimeSnapshotMessage,
} from "@refactory/contracts/runtime";
export {
  WorldCommandQueuedMessage,
  WorldCommandReceiptMessage,
  WorldRuntimeBindMessage,
  WorldRuntimeClientMessage,
  WorldRuntimeCommandMessage,
  WorldRuntimeHeartbeatMessage,
  WorldRuntimeResyncRequiredMessage,
  WorldRuntimeServerMessage,
} from "@refactory/contracts/socket";

import { Data, Effect, Schema } from "effect";
import type {
  SubmitWorldCommandResponse as SubmitWorldCommandResponseType,
  WorldCommand as WorldCommandType,
} from "@refactory/contracts/commands";
import type { GetWorldRuntimeResponse as GetWorldRuntimeResponseType } from "@refactory/contracts/runtime";
import type { WorldRuntimeServerMessage as WorldRuntimeMessageType } from "@refactory/contracts/socket";
import {
  getOrCreateActorCredentials,
  makeSignedActorHeaders,
} from "./actorAuth";
import { makeWorldApiClient } from "./worldClient";

class WorldRuntimeMessageDecodeError extends Data.TaggedError(
  "WorldRuntimeMessageDecodeError",
)<{
  readonly cause: unknown;
}> {}

const requestUrlBase = "http://refactory.local";
const defaultFetchBasePath = "/api";
const defaultSigningBasePath = defaultFetchBasePath;

const trimTrailingSlash = (value: string) =>
  value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;

const normalizePathPrefix = (value: string) => {
  if (value.length === 0) {
    return "";
  }

  const parsed = new URL(value, requestUrlBase);
  const normalizedPathname = trimTrailingSlash(parsed.pathname);

  return normalizedPathname === "/" ? "" : normalizedPathname;
};

const decodeWorldRuntimeMessage = Schema.decodeUnknownSync(
  Schema.fromJsonString(WorldRuntimeServerMessage),
);

type SignedRuntimeClientOptions = {
  readonly actorDisplayName: string;
  readonly fetchBasePath?: string;
  readonly signingBasePath?: string;
};

type RuntimeSocketOptions = {
  readonly fetchBasePath?: string;
  readonly origin?: string;
  readonly worldId: string;
};

/** Build a fresh client-side world command id. */
export const makeWorldCommandId = () => crypto.randomUUID();

/** Build the future websocket endpoint URL for runtime delta transport. */
export const makeWorldRuntimeSocketUrl = (options: RuntimeSocketOptions) => {
  const origin = options.origin ?? window.location.origin;
  const protocol = origin.startsWith("https:") ? "wss:" : "ws:";
  const baseUrl = new URL(origin);
  const fetchBasePath = options.fetchBasePath ?? defaultFetchBasePath;
  const normalizedBasePath = normalizePathPrefix(fetchBasePath);

  return `${protocol}//${baseUrl.host}${normalizedBasePath}/worlds/${options.worldId}/runtime/socket`;
};

/** Build a signed websocket URL using the same actor identity model as HTTP. */
export const makeSignedWorldRuntimeSocketUrl = Effect.fnUntraced(function* (
  options: SignedRuntimeClientOptions & RuntimeSocketOptions,
) {
  const actor = yield* getOrCreateActorCredentials({
    displayName: options.actorDisplayName,
  });
  const signingBasePath =
    options.signingBasePath ?? defaultSigningBasePath;
  const normalizedSigningBasePath = normalizePathPrefix(signingBasePath);
  const pathAndQuery = `${normalizedSigningBasePath}/worlds/${options.worldId}/runtime/socket`;
  const signedHeaders = yield* makeSignedActorHeaders({
    actor,
    method: "GET",
    pathAndQuery,
  });
  const url = new URL(makeWorldRuntimeSocketUrl(options));

  for (const [headerName, headerValue] of Object.entries(signedHeaders)) {
    url.searchParams.set(headerName, headerValue);
  }

  return url.toString();
});

/** Fetch the current authoritative runtime snapshot for a world. */
export const getWorldRuntime = Effect.fnUntraced(function* (
  options: SignedRuntimeClientOptions & {
    readonly worldId: string;
  },
) {
  const client = yield* makeWorldApiClient(options);
  return yield* client.worlds.getWorldRuntime({
    params: { worldId: options.worldId },
  });
});

/** Fetch the latest persisted runtime checkpoint for a world, if one exists. */
export const getWorldRuntimeCheckpoint = Effect.fnUntraced(function* (
  options: SignedRuntimeClientOptions & {
    readonly worldId: string;
  },
) {
  const client = yield* makeWorldApiClient(options);
  return yield* client.worlds.getWorldRuntimeCheckpoint({
    params: { worldId: options.worldId },
  });
});

/** Submit a typed world command and wait for the tick-boundary receipt. */
export const submitWorldCommand = Effect.fnUntraced(function* (
  options: SignedRuntimeClientOptions & {
    readonly command: WorldCommandType;
    readonly worldId: string;
  },
) {
  const client = yield* makeWorldApiClient(options);
  return yield* client.worlds.submitWorldCommand({
    params: { worldId: options.worldId },
    payload: {
      command: options.command,
    },
  });
});

/** Decode a future realtime runtime message with the shared schema. */
export const parseWorldRuntimeMessage = Effect.fnUntraced(function* (
  serialized: string,
) {
  return yield* Effect.try({
    try: () => decodeWorldRuntimeMessage(serialized),
    catch: (cause) => new WorldRuntimeMessageDecodeError({ cause }),
  });
});

export const isWorldRuntimeSnapshotMessage = (
  message: WorldRuntimeMessageType,
): message is WorldRuntimeSnapshotMessage =>
  message._tag === "WorldRuntimeSnapshotMessage";

export const isWorldRuntimeDeltaMessage = (
  message: WorldRuntimeMessageType,
): message is WorldRuntimeDeltaMessage =>
  message._tag === "WorldRuntimeDeltaMessage";

export const isWorldCommandQueuedMessage = (
  message: WorldRuntimeMessageType,
): message is WorldCommandQueuedMessage =>
  message._tag === "WorldCommandQueuedMessage";

export const isWorldCommandReceiptMessage = (
  message: WorldRuntimeMessageType,
): message is WorldCommandReceiptMessage =>
  message._tag === "WorldCommandReceiptMessage";

export const isWorldRuntimeResyncRequiredMessage = (
  message: WorldRuntimeMessageType,
): message is WorldRuntimeResyncRequiredMessage =>
  message._tag === "WorldRuntimeResyncRequiredMessage";

export type GetWorldRuntimeResult = GetWorldRuntimeResponseType;
export type SubmitWorldCommandResult = SubmitWorldCommandResponseType;
