import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { ApiDocs, ApiRoutes } from "./api.ts";
import { AppConfig } from "./app-config.ts";
import { ActorAuthLive } from "./auth.ts";
import { ProfileRepository } from "./profiles.ts";
import { SqliteDatabase } from "./sqlite.ts";
import { WorldRepository, WorldService } from "./worlds.ts";

const PersistenceLive = Layer.mergeAll(ProfileRepository.Live, WorldRepository.Live).pipe(
  Layer.provide(SqliteDatabase.Live),
);

const DomainLive = Layer.mergeAll(AppConfig.Live, PersistenceLive);

const WorldServiceLive = WorldService.Live.pipe(Layer.provide(DomainLive));

const ServerLive = Effect.gen(function* () {
  const config = yield* AppConfig;
  const routes = Layer.mergeAll(ApiRoutes, ApiDocs);

  const server = HttpRouter.serve(routes).pipe(
    Layer.provide(BunHttpServer.layer({ port: config.port })),
    Layer.provide([AppConfig.Live, PersistenceLive, WorldServiceLive, ActorAuthLive]),
  );

  yield* Effect.log(`API listening on http://localhost:${config.port}`);
  return yield* Layer.launch(server);
});

BunRuntime.runMain(ServerLive.pipe(Effect.provide(AppConfig.Live)), {
  disableErrorReporting: true,
});
