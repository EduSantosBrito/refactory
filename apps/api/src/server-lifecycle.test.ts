import { expect, mock, test } from "bun:test";
import { Effect } from "effect";
import { createShutdown } from "./server-lifecycle.ts";

test("createShutdown stops server and disposes runtime once", async () => {
  const stop = mock(() => undefined);
  const dispose = mock(async () => undefined);
  const shutdown = Effect.runSync(createShutdown({ stop }, { dispose }));

  await Promise.all([
    Effect.runPromise(shutdown()),
    Effect.runPromise(shutdown()),
    Effect.runPromise(shutdown()),
  ]);

  expect(stop).toHaveBeenCalledTimes(1);
  expect(stop).toHaveBeenCalledWith(true);
  expect(dispose).toHaveBeenCalledTimes(1);
});
