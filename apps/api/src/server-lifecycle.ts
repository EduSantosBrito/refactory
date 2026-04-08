import { Data, Effect } from "effect";

type ClosableServer = {
  readonly stop: (closeActiveConnections?: boolean) => void;
};

type DisposableRuntime = {
  readonly dispose: () => Promise<void>;
};

export class ShutdownError extends Data.TaggedError("ShutdownError")<{
  readonly cause: unknown;
}> {}

export const createShutdown = Effect.fnUntraced(function* (
  server: ClosableServer,
  runtime: DisposableRuntime,
) {
  let shutdownPromise: Promise<void> | undefined;
  const services = yield* Effect.services();
  const runPromise = Effect.runPromiseWith(services);
  const shutdownEffect = Effect.sync(() => {
    server.stop(true);
  }).pipe(
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: () => runtime.dispose(),
        catch: (cause) => new ShutdownError({ cause }),
      }),
    ),
  );

  return Effect.fnUntraced(function* () {
    const activeShutdown = shutdownPromise ?? runPromise(shutdownEffect);
    shutdownPromise = activeShutdown;

    return yield* Effect.promise(() => activeShutdown);
  });
});

const removeShutdownHandlers = (onSignal: () => void) => () => {
  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);
};

export const installShutdownHandlers = Effect.fnUntraced(function* (
  shutdown: Effect.Success<ReturnType<typeof createShutdown>>,
) {
  const services = yield* Effect.services();
  const runPromise = Effect.runPromiseWith(services);

  return yield* Effect.sync(() => {
    const onSignal = () => {
      void runPromise(shutdown()).catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
    };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);

    return removeShutdownHandlers(onSignal);
  });
});
