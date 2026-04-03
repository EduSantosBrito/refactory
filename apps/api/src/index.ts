import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";

const parsePort = (value: string | undefined, fallback: number) => {
  if (value === undefined) {
    return fallback;
  }

  const candidate = Number(value);

  return Number.isInteger(candidate) && candidate > 0 ? candidate : fallback;
};

const port = parsePort(Bun.env.API_PORT ?? Bun.env.PORT, 3001);

const ApiRoutes = HttpRouter.use(
  Effect.fn(function* (router) {
    yield* router.add(
      "GET",
      "/api/health",
      HttpServerResponse.json({
        message: `Effect API online on :${port}`,
        name: "refactory-api",
        status: "ok",
      }),
    );
    yield* router.add(
      "GET",
      "/api/game",
      HttpServerResponse.json({
        name: "Refactory",
        theme: "Factory automation sandbox",
      }),
    );
  }),
);

const ServerLive = HttpRouter.serve(ApiRoutes).pipe(
  Layer.provide(BunHttpServer.layer({ port })),
);

const program = Layer.launch(ServerLive).pipe(
  Effect.tap(() => Effect.log(`API listening on http://localhost:${port}`)),
);

BunRuntime.runMain(program, {
  disableErrorReporting: true,
});
