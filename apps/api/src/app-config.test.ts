import { expect, test } from "bun:test";
import { ConfigProvider, Layer, ManagedRuntime } from "effect";
import { AppConfig } from "./app-config.ts";

test("AppConfig reads overrides from ConfigProvider", async () => {
  const runtime = ManagedRuntime.make(
    Layer.provide(
      AppConfig.layer,
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({
          API_DATABASE_PATH: "/tmp/refactory-phase1.sqlite",
          API_PORT: "4123",
        }),
      ),
    ),
  );

  try {
    const config = await runtime.runPromise(AppConfig.asEffect());

    expect(config.databasePath).toBe("/tmp/refactory-phase1.sqlite");
    expect(config.port).toBe(4123);
  } finally {
    await runtime.dispose();
  }
});

test("AppConfig keeps existing API_PORT fallback semantics", async () => {
  const runtime = ManagedRuntime.make(
    Layer.provide(
      AppConfig.layer,
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({
          API_PORT: "not-a-port",
          PORT: "5123",
        }),
      ),
    ),
  );

  try {
    const config = await runtime.runPromise(AppConfig.asEffect());

    expect(config.port).toBe(3001);
  } finally {
    await runtime.dispose();
  }
});
