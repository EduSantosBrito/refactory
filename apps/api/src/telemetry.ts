import { Effect, Layer, Match } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { OtlpSerialization, OtlpTracer } from "effect/unstable/observability";
import { AppConfig } from "./app-config.ts";

const makeTelemetryLayer = Effect.gen(function* () {
  const config = yield* AppConfig;

  return Match.value(config.telemetryEnabled).pipe(
    Match.when(false, () => Layer.empty),
    Match.orElse(() =>
      OtlpTracer.layer({
        resource: {
          serviceName: config.telemetryServiceName,
          serviceVersion: config.telemetryServiceVersion,
        },
        url: `${config.telemetryOtlpBaseUrl}/v1/traces`,
      }).pipe(
        Layer.provide(OtlpSerialization.layerJson),
        Layer.provide(FetchHttpClient.layer),
      ),
    ),
  );
});

export const TelemetryLive = Layer.unwrap(makeTelemetryLayer);
