import type { ActorContext } from "@refactory/contracts/auth";
import { ActorAuthError } from "@refactory/contracts/auth";
import { SubmitWorldCommandRequest, WorldCommandQueueFullError } from "@refactory/contracts/commands";
import {
  WorldCommandQueuedMessage,
  WorldRuntimeClientMessage,
  type WorldRuntimeServerMessage,
} from "@refactory/contracts/socket";
import {
  GetWorldRuntimeCheckpointResponse,
  GetWorldRuntimeResponse,
  WorldRuntimeUnavailableError,
} from "@refactory/contracts/runtime";
import {
  CreateWorldRequest,
  IdempotencyConflictError,
  InvalidWorldCursorError,
  InvalidWorldNameError,
  WorldAccessDeniedError,
  WorldListQuery,
  WorldNameTakenError,
  WorldNotFoundError,
} from "@refactory/contracts/worlds";
import { Deferred, Effect, Exit, Fiber, Layer, Schema, Scope, ServiceMap, Stream } from "effect";
import { AppConfig } from "./app-config.ts";
import { stripActorAuthSearchParams, verifySignedActorRequest } from "./auth.ts";
import { ProfileRepository } from "./profiles.ts";
import { SqliteDatabase } from "./sqlite.ts";
import { RuntimeCheckpointStore } from "./world-runtime-checkpoints.ts";
import { WorldRuntimeService } from "./world-runtime.ts";
import { WorldRepository, WorldService } from "./worlds.ts";

type RuntimeSocketData = {
  actor: ActorContext;
  bound: boolean;
  receiptFiber: Fiber.Fiber<unknown, unknown> | undefined;
  subscriptionFiber: Fiber.Fiber<unknown, unknown> | undefined;
  worldId: string;
};

const decodeCreateWorldRequest = Schema.decodeUnknownSync(CreateWorldRequest);
const decodeSubmitWorldCommandRequest = Schema.decodeUnknownSync(SubmitWorldCommandRequest);
const decodeWorldListQuery = Schema.decodeUnknownSync(WorldListQuery);
const decodeWorldRuntimeClientMessage = Schema.decodeUnknownSync(WorldRuntimeClientMessage);

const SqliteLive = SqliteDatabase.Live.pipe(Layer.provide(AppConfig.Live));

const PersistenceLive = Layer.mergeAll(ProfileRepository.Live, RuntimeCheckpointStore.Live, WorldRepository.Live).pipe(
  Layer.provide(SqliteLive),
);

const DomainLive = Layer.mergeAll(AppConfig.Live, PersistenceLive);

const WorldServiceLive = WorldService.Live.pipe(Layer.provide(DomainLive));
const WorldRuntimeLive = WorldRuntimeService.Live.pipe(Layer.provide(PersistenceLive));

const ServerLayer = Layer.mergeAll(AppConfig.Live, PersistenceLive, WorldRuntimeLive, WorldServiceLive);

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

const errorResponse = (error: unknown) => {
  if (error instanceof ActorAuthError) {
    return json({ _tag: "ActorAuthError", message: error.message }, 401);
  }

  if (error instanceof InvalidWorldCursorError || error instanceof InvalidWorldNameError) {
    return json(error, 400);
  }

  if (
    error instanceof IdempotencyConflictError ||
    error instanceof WorldNameTakenError ||
    error instanceof WorldRuntimeUnavailableError
  ) {
    return json(error, 409);
  }

  if (error instanceof WorldAccessDeniedError) {
    return json(error, 403);
  }

  if (error instanceof WorldNotFoundError) {
    return json(error, 404);
  }

  if (error instanceof WorldCommandQueueFullError) {
    return json(error, 503);
  }

  return json({ _tag: "InternalServerError", message: "Internal server error" }, 500);
};

const sendSocketMessage = (socket: Bun.ServerWebSocket<RuntimeSocketData>, message: WorldRuntimeServerMessage) => {
  socket.send(JSON.stringify(message));
};

const scope = Scope.makeUnsafe();
const services = await Effect.runPromise(Layer.buildWithScope(ServerLayer, scope));
const config = ServiceMap.get(services, AppConfig);
const worlds = ServiceMap.get(services, WorldService);
const runtime = ServiceMap.get(services, WorldRuntimeService);
const runPromise = Effect.runPromiseWith(services);
const runFork = Effect.runForkWith(services);

const parseActor = async (request: Request) => {
  const timestamp = Number(request.headers.get("x-refactory-actor-timestamp"));

  if (!Number.isFinite(timestamp)) {
    throw new ActorAuthError({ message: "Missing or invalid actor timestamp" });
  }

  return runPromise(
    verifySignedActorRequest(
      {
        method: request.method,
        url: stripActorAuthSearchParams(request.url),
      },
      {
        "x-refactory-actor-key": request.headers.get("x-refactory-actor-key") ?? "",
        "x-refactory-actor-name": request.headers.get("x-refactory-actor-name") ?? "",
        "x-refactory-actor-timestamp": timestamp,
        signature: request.headers.get("x-refactory-actor-signature") ?? "",
      },
    ),
  );
};

const server = Bun.serve<RuntimeSocketData>({
  fetch: async (request, bunServer) => {
    const url = new URL(request.url);
    const socketWorldId = runtimeSocketPath(url.pathname);

    if (socketWorldId !== undefined) {
      try {
        const timestamp = Number(url.searchParams.get("x-refactory-actor-timestamp"));

        if (!Number.isFinite(timestamp)) {
          throw new ActorAuthError({ message: "Missing or invalid actor timestamp" });
        }

        const actor = await runPromise(
          verifySignedActorRequest(
            {
              method: request.method,
              url: stripActorAuthSearchParams(request.url),
            },
            {
              "x-refactory-actor-key": url.searchParams.get("x-refactory-actor-key") ?? "",
              "x-refactory-actor-name": url.searchParams.get("x-refactory-actor-name") ?? "",
              "x-refactory-actor-timestamp": timestamp,
              signature: url.searchParams.get("x-refactory-actor-signature") ?? "",
            },
          ),
        );

        await runPromise(runtime.getWorldRuntime(actor, socketWorldId));

        const upgraded = bunServer.upgrade(request, {
          data: {
            actor,
            bound: false,
            receiptFiber: undefined,
            subscriptionFiber: undefined,
            worldId: socketWorldId,
          },
        });

        return upgraded ? undefined : new Response("WebSocket upgrade failed", { status: 500 });
      } catch (error) {
        return errorResponse(error);
      }
    }

    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        return json({ name: config.apiName, status: "ok" });
      }

      if (request.method === "GET" && url.pathname === "/api/worlds/public") {
        const response = await runPromise(worlds.listPublicWorlds(decodeWorldListQuery(Object.fromEntries(url.searchParams.entries()))));
        return json(response);
      }

      if (request.method === "POST" && url.pathname === "/api/worlds") {
        const actor = await parseActor(request);
        const payload = decodeCreateWorldRequest(await request.json());
        const world = await runPromise(worlds.createWorld(actor, payload));
        return json({ world });
      }

      if (request.method === "GET" && url.pathname === "/api/worlds") {
        const actor = await parseActor(request);
        const response = await runPromise(worlds.listOwnWorlds(actor, decodeWorldListQuery(Object.fromEntries(url.searchParams.entries()))));
        return json(response);
      }

      const worldId = worldPath(url.pathname);

      if (request.method === "GET" && worldId !== undefined) {
        const actor = await parseActor(request);
        const world = await runPromise(worlds.getWorld(actor, worldId));
        return json({ world });
      }

      const runtimeWorldId = worldRuntimePath(url.pathname);

      if (request.method === "GET" && runtimeWorldId !== undefined) {
        const actor = await parseActor(request);
        const snapshot = await runPromise(runtime.getWorldRuntime(actor, runtimeWorldId));
        return json({ snapshot } satisfies Schema.Schema.Type<typeof GetWorldRuntimeResponse>);
      }

      const checkpointWorldId = worldRuntimeCheckpointPath(url.pathname);

      if (request.method === "GET" && checkpointWorldId !== undefined) {
        const actor = await parseActor(request);
        const checkpoint = await runPromise(runtime.getWorldRuntimeCheckpoint(actor, checkpointWorldId));
        return json({ checkpoint } satisfies Schema.Schema.Type<typeof GetWorldRuntimeCheckpointResponse>);
      }

      const commandWorldId = worldCommandsPath(url.pathname);

      if (request.method === "POST" && commandWorldId !== undefined) {
        const actor = await parseActor(request);
        const payload = decodeSubmitWorldCommandRequest(await request.json());
        const receipt = await runPromise(runtime.submitWorldCommand(actor, commandWorldId, payload.command));
        return json({ receipt });
      }

      return new Response("Not found", { status: 404 });
    } catch (error) {
      return errorResponse(error);
    }
  },
  port: config.port,
  websocket: {
    close: (socket) => {
      if (socket.data.subscriptionFiber !== undefined) {
        void Effect.runPromise(Fiber.interrupt(socket.data.subscriptionFiber));
      }

      if (socket.data.receiptFiber !== undefined) {
        void Effect.runPromise(Fiber.interrupt(socket.data.receiptFiber));
      }
    },
    message: (socket, rawMessage) => {
      void (async () => {
        try {
          const serialized = typeof rawMessage === "string" ? rawMessage : new TextDecoder().decode(rawMessage);
          const message = decodeWorldRuntimeClientMessage(JSON.parse(serialized));

          if (!socket.data.bound) {
            if (message._tag !== "WorldRuntimeBindMessage") {
              socket.close(1008, "runtime socket must bind before use");
              return;
            }

            if (message.worldId !== socket.data.worldId) {
              sendSocketMessage(socket, {
                _tag: "WorldRuntimeResyncRequiredMessage",
                expectedDeltaSequence: 0,
                message: "runtime socket world mismatch",
                worldId: socket.data.worldId,
              });
              socket.close(1008, "runtime socket world mismatch");
              return;
            }

            const snapshot = await runPromise(runtime.getWorldRuntime(socket.data.actor, socket.data.worldId));

            if (snapshot.deltaSequence !== message.snapshotDeltaSequence) {
              sendSocketMessage(socket, {
                _tag: "WorldRuntimeResyncRequiredMessage",
                expectedDeltaSequence: snapshot.deltaSequence,
                message: "runtime delta sequence mismatch",
                worldId: socket.data.worldId,
              });
              socket.close(1008, "runtime delta sequence mismatch");
              return;
            }

            const feed = await runPromise(runtime.openWorldRuntimeFeed(socket.data.actor, socket.data.worldId));
            socket.data.bound = true;
            socket.data.subscriptionFiber = runFork(
              Effect.scoped(
                Stream.runForEach(feed.deltas, (delta) =>
                  Effect.sync(() => {
                    sendSocketMessage(socket, {
                      _tag: "WorldRuntimeDeltaMessage",
                      delta,
                    });
                  })
                ),
              ),
            );
            return;
          }

          switch (message._tag) {
            case "WorldRuntimeHeartbeatMessage":
              return;
            case "WorldRuntimeBindMessage":
              return;
            case "WorldRuntimeCommandMessage": {
              const queued = await runPromise(runtime.queueWorldCommand(socket.data.actor, socket.data.worldId, message.command));

              if (queued._tag === "resolved") {
                sendSocketMessage(socket, {
                  _tag: "WorldCommandReceiptMessage",
                  receipt: queued.receipt,
                });
                return;
              }

              sendSocketMessage(socket, {
                _tag: "WorldCommandQueuedMessage",
                commandId: queued.commandId,
                worldId: socket.data.worldId,
              });
              socket.data.receiptFiber = runFork(
                Effect.flatMap(Deferred.await(queued.receipt), (receipt) =>
                  Effect.sync(() => {
                    sendSocketMessage(socket, {
                      _tag: "WorldCommandReceiptMessage",
                      receipt,
                    });
                  })
                ),
              );
            }
          }
        } catch {
          socket.close(1008, "invalid runtime socket message");
        }
      })();
    },
    open: () => {
      return;
    },
  },
});

console.log(`API listening on http://localhost:${config.port}`);

process.on("SIGINT", () => {
  server.stop(true);
  void Effect.runPromise(Scope.close(scope, Exit.void));
});
