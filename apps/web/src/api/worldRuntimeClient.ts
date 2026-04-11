import type {
  WorldRuntimeDeltaMessage,
  WorldRuntimeSnapshotMessage,
} from "@refactory/contracts/runtime";
import {
  type TraceContext as SocketTraceContext,
  type WorldCommandQueuedMessage,
  type WorldCommandReceiptMessage,
  type WorldRuntimeCommandMessage as WorldRuntimeCommandMessageType,
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
import type { AnySpan } from "effect/Tracer";
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

const makeTraceparent = (span: AnySpan) => {
  const traceFlags = span.sampled ? "01" : "00";
  return `00-${span.traceId}-${span.spanId}-${traceFlags}`;
};

const toSocketTraceContext = (span: AnySpan): SocketTraceContext => ({
  traceparent: makeTraceparent(span),
});

/** Capture the currently active Effect span as W3C trace context for WS propagation. */
export const getCurrentSocketTraceContext = Effect.fn(
  "web.api.world_runtime.trace_context.current",
)(function* () {
  const span = yield* Effect.currentSpan;
  return toSocketTraceContext(span);
});

/** Build a WS world-command envelope with trace context attached when sent from an Effect span. */
export const makeWorldRuntimeCommandMessage = Effect.fn(
  "web.api.world_runtime.command.message.make",
)(function* (
  command: WorldCommandType,
) {
  const traceContext = yield* getCurrentSocketTraceContext();

  return {
    _tag: "WorldRuntimeCommandMessage",
    command,
    traceContext,
  } satisfies WorldRuntimeCommandMessageType;
});

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
export const makeSignedWorldRuntimeSocketUrl = Effect.fn("web.api.world_runtime.socket_url.make_signed")(function* (
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
export const getWorldRuntime = Effect.fn("web.api.world_runtime.get")(function* (
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
export const getWorldRuntimeCheckpoint = Effect.fn("web.api.world_runtime.checkpoint.get")(function* (
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
export const submitWorldCommand = Effect.fn("web.api.world_runtime.command.submit")(function* (
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
export const parseWorldRuntimeMessage = Effect.fn("web.api.world_runtime.message.parse")(function* (
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
