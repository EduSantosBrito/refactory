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
    expect(config.telemetryEnabled).toBe(false);
    expect(config.telemetryOtlpBaseUrl).toBe("http://localhost:4318");
    expect(config.telemetryServiceName).toBe("refactory-api");
    expect(config.telemetryServiceVersion).toBe("dev");
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

test("AppConfig enables telemetry from explicit flags", async () => {
  const runtime = ManagedRuntime.make(
    Layer.provide(
      AppConfig.layer,
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({
          API_TELEMETRY_ENABLED: "true",
          API_TELEMETRY_OTLP_BASE_URL: "http://localhost:5318",
          API_TELEMETRY_SERVICE_NAME: "refactory-api-dev",
          API_TELEMETRY_SERVICE_VERSION: "v-next",
        }),
      ),
    ),
  );

  try {
    const config = await runtime.runPromise(AppConfig.asEffect());

    expect(config.telemetryEnabled).toBe(true);
    expect(config.telemetryOtlpBaseUrl).toBe("http://localhost:5318");
    expect(config.telemetryServiceName).toBe("refactory-api-dev");
    expect(config.telemetryServiceVersion).toBe("v-next");
  } finally {
    await runtime.dispose();
  }
});
