import type { ActorContext } from "@refactory/contracts/auth";
import { ActorAuthError } from "@refactory/contracts/auth";
import {
  SubmitWorldCommandRequest,
  type WorldCommandReceipt,
} from "@refactory/contracts/commands";
import type {
  GetWorldRuntimeCheckpointResponse,
  GetWorldRuntimeResponse,
} from "@refactory/contracts/runtime";
import {
  WorldRuntimeClientMessage,
  type WorldRuntimeServerMessage,
} from "@refactory/contracts/socket";
import {
  CreateWorldRequest,
  WorldListQuery,
} from "@refactory/contracts/worlds";
import {
  Deferred,
  Effect,
  Fiber,
  Layer,
  ManagedRuntime,
  Match,
  Schema,
  Stream,
} from "effect";
import { AppConfig } from "./app-config.ts";
import {
  stripActorAuthSearchParams,
  verifySignedActorRequest,
} from "./auth.ts";
import { RequestDecodeError, toErrorResponse } from "./backend-errors.ts";
import { ProfileRepository } from "./profiles.ts";
import { createShutdown, installShutdownHandlers } from "./server-lifecycle.ts";
import { SqliteDatabase } from "./sqlite.ts";
import { WorldRuntimeService } from "./world-runtime.ts";
import { RuntimeCheckpointStore } from "./world-runtime-checkpoints.ts";
import { WorldRepository, WorldService } from "./worlds.ts";

type SocketRawMessage = string | Buffer<ArrayBuffer>;

type RuntimeSocketData = {
  actor: ActorContext;
  bound: boolean;
  receiptFiber: Fiber.Fiber<unknown, unknown> | undefined;
  subscriptionFiber: Fiber.Fiber<unknown, unknown> | undefined;
  worldId: string;
};

type Route =
  | { readonly _tag: "runtimeSocket"; readonly worldId: string }
  | { readonly _tag: "health" }
  | { readonly _tag: "listPublicWorlds" }
  | { readonly _tag: "createWorld" }
  | { readonly _tag: "listOwnWorlds" }
  | { readonly _tag: "getWorld"; readonly worldId: string }
  | { readonly _tag: "getWorldRuntime"; readonly worldId: string }
  | { readonly _tag: "getWorldRuntimeCheckpoint"; readonly worldId: string }
  | { readonly _tag: "submitWorldCommand"; readonly worldId: string }
  | { readonly _tag: "notFound" };

const decodeCreateWorldRequest = (input: unknown) =>
  Schema.decodeUnknownEffect(CreateWorldRequest)(input).pipe(
    Effect.mapError(
      (cause) =>
        new RequestDecodeError({
          boundary: "create world request body",
          cause,
          message: "Invalid create world request body",
        }),
    ),
  );

const decodeSubmitWorldCommandRequest = (input: unknown) =>
  Schema.decodeUnknownEffect(SubmitWorldCommandRequest)(input).pipe(
    Effect.mapError(
      (cause) =>
        new RequestDecodeError({
          boundary: "submit world command request body",
          cause,
          message: "Invalid submit world command request body",
        }),
    ),
  );

const decodeWorldListQuery = (input: unknown) =>
  Schema.decodeUnknownEffect(WorldListQuery)(input).pipe(
    Effect.mapError(
      (cause) =>
        new RequestDecodeError({
          boundary: "world list query",
          cause,
          message: "Invalid world list query",
        }),
    ),
  );

const decodeWorldRuntimeClientMessage = (input: unknown) =>
  Schema.decodeUnknownEffect(WorldRuntimeClientMessage)(input).pipe(
    Effect.mapError(
      (cause) =>
        new RequestDecodeError({
          boundary: "runtime socket message",
          cause,
          message: "Invalid runtime socket message",
        }),
    ),
  );

const SqliteLive = SqliteDatabase.Live.pipe(Layer.provide(AppConfig.Live));

const PersistenceLive = Layer.mergeAll(
  ProfileRepository.Live,
  RuntimeCheckpointStore.Live,
  WorldRepository.Live,
).pipe(Layer.provide(SqliteLive));

const DomainLive = Layer.mergeAll(AppConfig.Live, PersistenceLive);

const WorldServiceLive = WorldService.Live.pipe(Layer.provide(DomainLive));
const WorldRuntimeLive = WorldRuntimeService.Live.pipe(
  Layer.provide(PersistenceLive),
);

const ServerLayer = Layer.mergeAll(
  AppConfig.Live,
  PersistenceLive,
  WorldRuntimeLive,
  WorldServiceLive,
);

const runtimeSocketPath = (pathname: string) => {
  const match = /^\/api\/worlds\/([^/]+)\/runtime\/socket$/.exec(pathname);
  return match?.[1];
};

const worldPath = (pathname: string) => {
  const match = /^\/api\/worlds\/([^/]+)$/.exec(pathname);
  return match?.[1];
};

const worldRuntimePath = (pathname: string) => {
  const match = /^\/api\/worlds\/([^/]+)\/runtime$/.exec(pathname);
  return match?.[1];
};

const worldRuntimeCheckpointPath = (pathname: string) => {
  const match = /^\/api\/worlds\/([^/]+)\/runtime\/checkpoint$/.exec(pathname);
  return match?.[1];
};

const worldCommandsPath = (pathname: string) => {
  const match = /^\/api\/worlds\/([^/]+)\/commands$/.exec(pathname);
  return match?.[1];
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    status,
  });

const sendSocketMessage = (
  socket: Bun.ServerWebSocket<RuntimeSocketData>,
  message: WorldRuntimeServerMessage,
) => {
  socket.send(JSON.stringify(message));
};

const invalidActorTimestampError = () =>
  new ActorAuthError({
    message: "Missing or invalid actor timestamp",
  });

const notFoundRoute = (): Route => ({ _tag: "notFound" });

const firstDefinedRoute = (routes: ReadonlyArray<Route | undefined>): Route =>
  routes.find((route) => route !== undefined) ?? notFoundRoute();

const runtimeSocketRoute = (pathname: string): Route | undefined =>
  Match.value(runtimeSocketPath(pathname)).pipe(
    Match.when(
      Match.defined,
      (worldId): Route => ({ _tag: "runtimeSocket", worldId }),
    ),
    Match.orElse(() => undefined),
  );

const getWorldRoute = (pathname: string): Route | undefined =>
  Match.value(worldPath(pathname)).pipe(
    Match.when(
      Match.defined,
      (worldId): Route => ({ _tag: "getWorld", worldId }),
    ),
    Match.orElse(() => undefined),
  );

const getWorldRuntimeRoute = (pathname: string): Route | undefined =>
  Match.value(worldRuntimePath(pathname)).pipe(
    Match.when(
      Match.defined,
      (worldId): Route => ({ _tag: "getWorldRuntime", worldId }),
    ),
    Match.orElse(() => undefined),
  );

const getWorldRuntimeCheckpointRoute = (pathname: string): Route | undefined =>
  Match.value(worldRuntimeCheckpointPath(pathname)).pipe(
    Match.when(
      Match.defined,
      (worldId): Route => ({ _tag: "getWorldRuntimeCheckpoint", worldId }),
    ),
    Match.orElse(() => undefined),
  );

const submitWorldCommandRoute = (pathname: string): Route | undefined =>
  Match.value(worldCommandsPath(pathname)).pipe(
    Match.when(
      Match.defined,
      (worldId): Route => ({ _tag: "submitWorldCommand", worldId }),
    ),
    Match.orElse(() => undefined),
  );

const fixedRoute = (method: string, pathname: string): Route | undefined =>
  Match.value(`${method} ${pathname}`).pipe(
    Match.when("GET /api/health", (): Route => ({ _tag: "health" })),
    Match.when(
      "GET /api/worlds/public",
      (): Route => ({ _tag: "listPublicWorlds" }),
    ),
    Match.when("POST /api/worlds", (): Route => ({ _tag: "createWorld" })),
    Match.when("GET /api/worlds", (): Route => ({ _tag: "listOwnWorlds" })),
    Match.orElse((): Route | undefined => undefined),
  );

const matchGetRoute = (pathname: string): Route =>
  firstDefinedRoute([
    runtimeSocketRoute(pathname),
    getWorldRoute(pathname),
    getWorldRuntimeRoute(pathname),
    getWorldRuntimeCheckpointRoute(pathname),
  ]);

const matchPostRoute = (pathname: string): Route =>
  firstDefinedRoute([submitWorldCommandRoute(pathname)]);

const matchRoute = (method: string, pathname: string): Route =>
  fixedRoute(method, pathname) ??
  Match.value(method).pipe(
    Match.when("GET", () => matchGetRoute(pathname)),
    Match.when("POST", () => matchPostRoute(pathname)),
    Match.orElse(notFoundRoute),
  );

const parseDefinedActorTimestamp = (definedValue: string) => {
  const timestamp = Number(definedValue);

  return Match.value(Number.isFinite(timestamp)).pipe(
    Match.when(true, () => Effect.succeed(timestamp)),
    Match.orElse(() => Effect.fail(invalidActorTimestampError())),
  );
};

const parseActorTimestamp = (value: string | null) =>
  Match.value(value).pipe(
    Match.when(null, () => Effect.fail(invalidActorTimestampError())),
    Match.orElse(parseDefinedActorTimestamp),
  );

const decodeWorldListQueryFromUrl = (url: URL) =>
  decodeWorldListQuery(Object.fromEntries(url.searchParams.entries()));

const decodeBinarySocketMessage = (rawMessage: Buffer<ArrayBuffer>) =>
  new TextDecoder().decode(rawMessage);

const serializeSocketMessage = (rawMessage: SocketRawMessage): string =>
  Match.value(rawMessage).pipe(
    Match.when(Match.string, (message) => message),
    Match.orElse((buffer) => decodeBinarySocketMessage(buffer)),
  );

const rethrow = (error: unknown): never => {
  throw error;
};

const parseActorFromHeaders = Effect.fnUntraced(function* (request: Request) {
  const timestamp = yield* parseActorTimestamp(
    request.headers.get("x-refactory-actor-timestamp"),
  );
  const url = yield* stripActorAuthSearchParams(request.url);

  return yield* verifySignedActorRequest(
    {
      method: request.method,
      url,
    },
    {
      "x-refactory-actor-key":
        request.headers.get("x-refactory-actor-key") ?? "",
      "x-refactory-actor-name":
        request.headers.get("x-refactory-actor-name") ?? "",
      "x-refactory-actor-timestamp": timestamp,
      signature: request.headers.get("x-refactory-actor-signature") ?? "",
    },
  );
});

const parseActorFromSearchParams = Effect.fnUntraced(function* (
  request: Request,
  url: URL,
) {
  const timestamp = yield* parseActorTimestamp(
    url.searchParams.get("x-refactory-actor-timestamp"),
  );
  const sanitizedUrl = yield* stripActorAuthSearchParams(request.url);

  return yield* verifySignedActorRequest(
    {
      method: request.method,
      url: sanitizedUrl,
    },
    {
      "x-refactory-actor-key":
        url.searchParams.get("x-refactory-actor-key") ?? "",
      "x-refactory-actor-name":
        url.searchParams.get("x-refactory-actor-name") ?? "",
      "x-refactory-actor-timestamp": timestamp,
      signature: url.searchParams.get("x-refactory-actor-signature") ?? "",
    },
  );
});

const managedRuntime = ManagedRuntime.make(ServerLayer);

const services = await managedRuntime
  .runPromise(
    Effect.gen(function* () {
      return {
        config: yield* AppConfig,
        worldRuntime: yield* WorldRuntimeService,
        worlds: yield* WorldService,
      };
    }),
  )
  .catch((error) =>
    managedRuntime.dispose().then(
      () => rethrow(error),
      () => rethrow(error),
    ),
  );

const { config, worlds, worldRuntime } = services;
const runPromise = managedRuntime.runPromise.bind(managedRuntime);
const runFork = managedRuntime.runFork.bind(managedRuntime);

const healthResponse = Effect.succeed(
  json({
    name: config.apiName,
    status: "ok",
  }),
);

const handleListPublicWorldsRoute = Effect.fnUntraced(function* (url: URL) {
  const query = yield* decodeWorldListQueryFromUrl(url);
  const response = yield* worlds.listPublicWorlds(query);

  return json(response);
});

const handleCreateWorldRoute = Effect.fnUntraced(function* (request: Request) {
  const actor = yield* parseActorFromHeaders(request);
  const payload = yield* Effect.tryPromise({
    try: () => request.json(),
    catch: (cause) =>
      new RequestDecodeError({
        boundary: "create world request body",
        cause,
        message: "Invalid create world request body",
      }),
  });
  const createWorldPayload = yield* decodeCreateWorldRequest(payload);
  const world = yield* worlds.createWorld(actor, createWorldPayload);

  return json({ world });
});

const handleListOwnWorldsRoute = Effect.fnUntraced(function* (
  request: Request,
  url: URL,
) {
  const actor = yield* parseActorFromHeaders(request);
  const query = yield* decodeWorldListQueryFromUrl(url);
  const response = yield* worlds.listOwnWorlds(actor, query);

  return json(response);
});

const handleGetWorldRoute = Effect.fnUntraced(function* (
  route: Extract<Route, { readonly _tag: "getWorld" }>,
  request: Request,
) {
  const actor = yield* parseActorFromHeaders(request);
  const world = yield* worlds.getWorld(actor, route.worldId);

  return json({ world });
});

const handleGetWorldRuntimeRoute = Effect.fnUntraced(function* (
  route: Extract<Route, { readonly _tag: "getWorldRuntime" }>,
  request: Request,
) {
  const actor = yield* parseActorFromHeaders(request);
  const snapshot = yield* worldRuntime.getWorldRuntime(actor, route.worldId);

  return json({ snapshot } satisfies Schema.Schema.Type<
    typeof GetWorldRuntimeResponse
  >);
});

const handleGetWorldRuntimeCheckpointRoute = Effect.fnUntraced(function* (
  route: Extract<Route, { readonly _tag: "getWorldRuntimeCheckpoint" }>,
  request: Request,
) {
  const actor = yield* parseActorFromHeaders(request);
  const checkpoint = yield* worldRuntime.getWorldRuntimeCheckpoint(
    actor,
    route.worldId,
  );

  return json({ checkpoint } satisfies Schema.Schema.Type<
    typeof GetWorldRuntimeCheckpointResponse
  >);
});

const handleSubmitWorldCommandRoute = Effect.fnUntraced(function* (
  route: Extract<Route, { readonly _tag: "submitWorldCommand" }>,
  request: Request,
) {
  const actor = yield* parseActorFromHeaders(request);
  const payload = yield* Effect.tryPromise({
    try: () => request.json(),
    catch: (cause) =>
      new RequestDecodeError({
        boundary: "submit world command request body",
        cause,
        message: "Invalid submit world command request body",
      }),
  });
  const submitWorldCommandPayload =
    yield* decodeSubmitWorldCommandRequest(payload);
  const receipt = yield* worldRuntime.submitWorldCommand(
    actor,
    route.worldId,
    submitWorldCommandPayload.command,
  );

  return json({ receipt });
});

const upgradeSocketResponse = (upgraded: boolean) =>
  Match.value(upgraded).pipe(
    Match.when(true, () => undefined),
    Match.orElse(
      () => new Response("WebSocket upgrade failed", { status: 500 }),
    ),
  );

const handleRuntimeSocketRoute = Effect.fnUntraced(function* (
  route: Extract<Route, { readonly _tag: "runtimeSocket" }>,
  request: Request,
  url: URL,
  bunServer: Bun.Server<RuntimeSocketData>,
) {
  const actor = yield* parseActorFromSearchParams(request, url);
  yield* worldRuntime.getWorldRuntime(actor, route.worldId);

  return upgradeSocketResponse(
    bunServer.upgrade(request, {
      data: {
        actor,
        bound: false,
        receiptFiber: undefined,
        subscriptionFiber: undefined,
        worldId: route.worldId,
      },
    }),
  );
});

const notFoundResponse = Effect.succeed(
  new Response("Not found", { status: 404 }),
);

const handleRoute = (
  route: Route,
  request: Request,
  url: URL,
  bunServer: Bun.Server<RuntimeSocketData>,
) =>
  Match.value(route).pipe(
    Match.when({ _tag: "runtimeSocket" }, (matchedRoute) =>
      handleRuntimeSocketRoute(matchedRoute, request, url, bunServer),
    ),
    Match.when({ _tag: "health" }, () => healthResponse),
    Match.when({ _tag: "listPublicWorlds" }, () =>
      handleListPublicWorldsRoute(url),
    ),
    Match.when({ _tag: "createWorld" }, () => handleCreateWorldRoute(request)),
    Match.when({ _tag: "listOwnWorlds" }, () =>
      handleListOwnWorldsRoute(request, url),
    ),
    Match.when({ _tag: "getWorld" }, (matchedRoute) =>
      handleGetWorldRoute(matchedRoute, request),
    ),
    Match.when({ _tag: "getWorldRuntime" }, (matchedRoute) =>
      handleGetWorldRuntimeRoute(matchedRoute, request),
    ),
    Match.when({ _tag: "getWorldRuntimeCheckpoint" }, (matchedRoute) =>
      handleGetWorldRuntimeCheckpointRoute(matchedRoute, request),
    ),
    Match.when({ _tag: "submitWorldCommand" }, (matchedRoute) =>
      handleSubmitWorldCommandRoute(matchedRoute, request),
    ),
    Match.orElse(() => notFoundResponse),
  );

const closeSocketNow = (
  socket: Bun.ServerWebSocket<RuntimeSocketData>,
  code: number,
  reason: string,
) => {
  socket.close(code, reason);
};

const sendReceiptMessageNow = (
  socket: Bun.ServerWebSocket<RuntimeSocketData>,
  receipt: WorldCommandReceipt,
) => {
  sendSocketMessage(socket, {
    _tag: "WorldCommandReceiptMessage",
    receipt,
  });
};

const sendQueuedMessageNow = (
  socket: Bun.ServerWebSocket<RuntimeSocketData>,
  commandId: string,
) => {
  sendSocketMessage(socket, {
    _tag: "WorldCommandQueuedMessage",
    commandId,
    worldId: socket.data.worldId,
  });
};

const sendResyncAndCloseNow = (
  socket: Bun.ServerWebSocket<RuntimeSocketData>,
  expectedDeltaSequence: number,
  message: string,
) => {
  sendSocketMessage(socket, {
    _tag: "WorldRuntimeResyncRequiredMessage",
    expectedDeltaSequence,
    message,
    worldId: socket.data.worldId,
  });
  socket.close(1008, message);
};

const attachReceiptFiberNow = (
  socket: Bun.ServerWebSocket<RuntimeSocketData>,
  receipt: Deferred.Deferred<WorldCommandReceipt>,
) => {
  socket.data.receiptFiber = runFork(
    Deferred.await(receipt).pipe(
      Effect.tap((resolvedReceipt) => {
        sendReceiptMessageNow(socket, resolvedReceipt);
        return Effect.void;
      }),
    ),
  );
};

const subscribeRuntimeFeedNow = (
  socket: Bun.ServerWebSocket<RuntimeSocketData>,
  feed: Effect.Success<ReturnType<typeof worldRuntime.openWorldRuntimeFeed>>,
) => {
  socket.data.bound = true;
  socket.data.subscriptionFiber = runFork(
    Effect.scoped(
      Stream.runForEach(feed.deltas, (delta) => {
        sendSocketMessage(socket, {
          _tag: "WorldRuntimeDeltaMessage",
          delta,
        });
        return Effect.void;
      }),
    ),
  );
};

const interruptFiberIfPresent = (
  fiber: Fiber.Fiber<unknown, unknown> | undefined,
) =>
  Match.value(fiber).pipe(
    Match.when(Match.undefined, () => undefined),
    Match.orElse((definedFiber) => {
      void Effect.runPromise(Fiber.interrupt(definedFiber));
    }),
  );

const ignoreSocketMessage = Effect.void;

const completeSocketBind = Effect.fnUntraced(function* (
  socket: Bun.ServerWebSocket<RuntimeSocketData>,
) {
  const feed = yield* worldRuntime.openWorldRuntimeFeed(
    socket.data.actor,
    socket.data.worldId,
  );

  subscribeRuntimeFeedNow(socket, feed);
});

const selectSocketBindHandler = (
  socket: Bun.ServerWebSocket<RuntimeSocketData>,
  snapshotDeltaSequence: number,
  message: Extract<
    WorldRuntimeClientMessage,
    { readonly _tag: "WorldRuntimeBindMessage" }
  >,
) =>
  Match.value(snapshotDeltaSequence === message.snapshotDeltaSequence).pipe(
    Match.when(true, () => completeSocketBind(socket)),
    Match.orElse(() => {
      sendResyncAndCloseNow(
        socket,
        snapshotDeltaSequence,
        "runtime delta sequence mismatch",
      );
      return Effect.void;
    }),
  );

const continueSocketBind = (
  socket: Bun.ServerWebSocket<RuntimeSocketData>,
  message: Extract<
    WorldRuntimeClientMessage,
    { readonly _tag: "WorldRuntimeBindMessage" }
  >,
) =>
  worldRuntime
    .getWorldRuntime(socket.data.actor, socket.data.worldId)
    .pipe(
      Effect.flatMap((snapshot) =>
        selectSocketBindHandler(socket, snapshot.deltaSequence, message),
      ),
    );

const bindRuntimeSocket = (
  socket: Bun.ServerWebSocket<RuntimeSocketData>,
  message: Extract<
    WorldRuntimeClientMessage,
    { readonly _tag: "WorldRuntimeBindMessage" }
  >,
) => {
  const continueBinding = () => continueSocketBind(socket, message);

  return Match.value(message.worldId === socket.data.worldId).pipe(
    Match.when(true, () => continueBinding()),
    Match.orElse(() => {
      sendResyncAndCloseNow(socket, 0, "runtime socket world mismatch");
      return Effect.void;
    }),
  );
};

const handleQueuedCommandResult = (
  socket: Bun.ServerWebSocket<RuntimeSocketData>,
  queued: Effect.Success<ReturnType<typeof worldRuntime.queueWorldCommand>>,
) =>
  Match.value(queued).pipe(
    Match.when({ _tag: "resolved" }, ({ receipt }) => {
      sendReceiptMessageNow(socket, receipt);
      return Effect.void;
    }),
    Match.when({ _tag: "queued" }, ({ commandId, receipt }) => {
      sendQueuedMessageNow(socket, commandId);
      attachReceiptFiberNow(socket, receipt);
      return Effect.void;
    }),
    Match.exhaustive,
  );

const handleWorldRuntimeCommandMessage = (
  socket: Bun.ServerWebSocket<RuntimeSocketData>,
  message: Extract<
    WorldRuntimeClientMessage,
    { readonly _tag: "WorldRuntimeCommandMessage" }
  >,
) =>
  worldRuntime
    .queueWorldCommand(socket.data.actor, socket.data.worldId, message.command)
    .pipe(
      Effect.flatMap((queued) => handleQueuedCommandResult(socket, queued)),
    );

const handleUnboundSocketMessage = (
  socket: Bun.ServerWebSocket<RuntimeSocketData>,
  message: Schema.Schema.Type<typeof WorldRuntimeClientMessage>,
) =>
  Match.value(message).pipe(
    Match.when({ _tag: "WorldRuntimeBindMessage" }, (bindMessage) =>
      bindRuntimeSocket(socket, bindMessage),
    ),
    Match.orElse(() => {
      closeSocketNow(socket, 1008, "runtime socket must bind before use");
      return Effect.void;
    }),
  );

const handleBoundSocketMessage = (
  socket: Bun.ServerWebSocket<RuntimeSocketData>,
  message: Schema.Schema.Type<typeof WorldRuntimeClientMessage>,
) =>
  Match.value(message).pipe(
    Match.when(
      { _tag: "WorldRuntimeHeartbeatMessage" },
      () => ignoreSocketMessage,
    ),
    Match.when({ _tag: "WorldRuntimeBindMessage" }, () => ignoreSocketMessage),
    Match.when({ _tag: "WorldRuntimeCommandMessage" }, (commandMessage) =>
      handleWorldRuntimeCommandMessage(socket, commandMessage),
    ),
    Match.exhaustive,
  );

const handleSocketMessage = Effect.fnUntraced(function* (
  socket: Bun.ServerWebSocket<RuntimeSocketData>,
  rawMessage: SocketRawMessage,
) {
  const message = Effect.try({
    try: () => JSON.parse(serializeSocketMessage(rawMessage)),
    catch: (cause) =>
      new RequestDecodeError({
        boundary: "runtime socket message",
        cause,
        message: "Invalid runtime socket message",
      }),
  }).pipe(Effect.flatMap(decodeWorldRuntimeClientMessage));

  const decodedMessage = yield* message;

  return yield* Match.value(socket.data.bound).pipe(
    Match.when(true, () => handleBoundSocketMessage(socket, decodedMessage)),
    Match.orElse(() => handleUnboundSocketMessage(socket, decodedMessage)),
  );
});

const handleRequest = (
  request: Request,
  bunServer: Bun.Server<RuntimeSocketData>,
) => {
  const url = new URL(request.url);
  const route = matchRoute(request.method, url.pathname);

  return handleRoute(route, request, url, bunServer);
};

const server = Bun.serve<RuntimeSocketData>({
  fetch: (request, bunServer) =>
    runPromise(
      handleRequest(request, bunServer).pipe(
        Effect.matchEffect({
          onFailure: toErrorResponse,
          onSuccess: Effect.succeed,
        }),
      ),
    ),
  port: config.port,
  websocket: {
    close: (socket) => {
      interruptFiberIfPresent(socket.data.subscriptionFiber);
      interruptFiberIfPresent(socket.data.receiptFiber);
    },
    message: (socket, rawMessage) => {
      void runPromise(
        handleSocketMessage(socket, rawMessage).pipe(
          Effect.matchEffect({
            onFailure: () => {
              closeSocketNow(socket, 1008, "invalid runtime socket message");
              return Effect.void;
            },
            onSuccess: () => Effect.void,
          }),
        ),
      );
    },
    open: () => undefined,
  },
});

const shutdown = Effect.runSync(createShutdown(server, managedRuntime));
Effect.runSync(installShutdownHandlers(shutdown));
console.log(`API listening on http://localhost:${config.port}`);
