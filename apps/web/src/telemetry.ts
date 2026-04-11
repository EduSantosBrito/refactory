import { Layer, Match } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { OtlpSerialization, OtlpTracer } from "effect/unstable/observability";

const parseBooleanEnv = (value: string | undefined) =>
  Match.value(value?.trim().toLowerCase()).pipe(
    Match.when("1", () => true),
    Match.when("true", () => true),
    Match.when("yes", () => true),
    Match.when("on", () => true),
    Match.orElse(() => false),
  );

const telemetryEnabled = parseBooleanEnv(import.meta.env.VITE_TELEMETRY_ENABLED);
const tracesUrl =
  (import.meta.env.VITE_TELEMETRY_TRACES_URL as string | undefined) ??
  "/api/telemetry/v1/traces";

export const TelemetryLive = Match.value(telemetryEnabled).pipe(
  Match.when(false, () => Layer.empty),
  Match.orElse(() =>
    OtlpTracer.layer({
      resource: {
        serviceName: "refactory-web",
        serviceVersion: import.meta.env.MODE ?? "dev",
      },
      url: tracesUrl,
    }).pipe(
      Layer.provide(OtlpSerialization.layerJson),
      Layer.provide(FetchHttpClient.layer),
    ),
  ),
);
