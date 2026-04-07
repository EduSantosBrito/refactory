import {
  SubmitWorldCommandRequest,
  SubmitWorldCommandResponse,
  WorldCommand,
  WorldCommandReceipt,
} from "@refactory/contracts/commands";
import {
  GetWorldRuntimeCheckpointResponse,
  GetWorldRuntimeResponse,
  WorldRuntimeDeltaMessage,
  WorldRuntimeMessage,
  WorldRuntimeSnapshotMessage,
} from "@refactory/contracts/runtime";
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
  WorldRuntimeMessage,
  WorldRuntimeSnapshot,
  WorldRuntimeSnapshotMessage,
} from "@refactory/contracts/runtime";
import type {
  GetWorldRuntimeResponse as GetWorldRuntimeResponseType,
  WorldRuntimeMessage as WorldRuntimeMessageType,
} from "@refactory/contracts/runtime";
import type {
  SubmitWorldCommandResponse as SubmitWorldCommandResponseType,
  WorldCommand as WorldCommandType,
} from "@refactory/contracts/commands";
import { Effect, Schema } from "effect";
import { makeWorldApiClient } from "./worldClient";

const decodeWorldRuntimeMessage = Schema.decodeUnknownSync(WorldRuntimeMessage);

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
  const fetchBasePath = options.fetchBasePath ?? "/api";
  const normalizedBasePath = fetchBasePath.endsWith("/") ? fetchBasePath.slice(0, -1) : fetchBasePath;

  return `${protocol}//${baseUrl.host}${normalizedBasePath}/worlds/${options.worldId}/runtime/socket`;
};

/** Fetch the current authoritative runtime snapshot for a world. */
export const getWorldRuntime = Effect.fnUntraced(function*(options: SignedRuntimeClientOptions & {
  readonly worldId: string;
}) {
  const client = yield* makeWorldApiClient(options);
  return yield* client.worlds.getWorldRuntime({
    params: { worldId: options.worldId },
  });
});

/** Fetch the latest persisted runtime checkpoint for a world, if one exists. */
export const getWorldRuntimeCheckpoint = Effect.fnUntraced(function*(options: SignedRuntimeClientOptions & {
  readonly worldId: string;
}) {
  const client = yield* makeWorldApiClient(options);
  return yield* client.worlds.getWorldRuntimeCheckpoint({
    params: { worldId: options.worldId },
  });
});

/** Submit a typed world command and wait for the tick-boundary receipt. */
export const submitWorldCommand = Effect.fnUntraced(function*(options: SignedRuntimeClientOptions & {
  readonly command: WorldCommandType;
  readonly worldId: string;
}) {
  const client = yield* makeWorldApiClient(options);
  return yield* client.worlds.submitWorldCommand({
    params: { worldId: options.worldId },
    payload: {
      command: options.command,
    },
  });
});

/** Decode a future realtime runtime message with the shared schema. */
export const parseWorldRuntimeMessage = Effect.fnUntraced(function*(serialized: string) {
  return yield* Effect.try({
    try: () => decodeWorldRuntimeMessage(JSON.parse(serialized)),
    catch: (cause) => new TypeError(`Invalid world runtime message: ${String(cause)}`),
  });
});

export const isWorldRuntimeSnapshotMessage = (
  message: WorldRuntimeMessageType,
): message is WorldRuntimeSnapshotMessage => message._tag === "WorldRuntimeSnapshotMessage";

export const isWorldRuntimeDeltaMessage = (
  message: WorldRuntimeMessageType,
): message is WorldRuntimeDeltaMessage => message._tag === "WorldRuntimeDeltaMessage";

export type GetWorldRuntimeResult = GetWorldRuntimeResponseType;
export type SubmitWorldCommandResult = SubmitWorldCommandResponseType;
