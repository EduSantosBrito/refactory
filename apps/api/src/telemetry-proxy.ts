import { Effect, Match } from "effect";
import { RequestDecodeError } from "./backend-errors.ts";

export type TelemetryProxyConfig = {
  readonly telemetryEnabled: boolean;
  readonly telemetryOtlpBaseUrl: string;
};

type ForwardTelemetryInput = {
  readonly headers: Record<string, string>;
  readonly payload: ArrayBuffer;
  readonly url: string;
};

type ForwardTelemetry = (input: ForwardTelemetryInput) => Promise<unknown>;

type TelemetryProxyOptions = {
  readonly forward?: ForwardTelemetry;
  readonly maxBytes?: number;
};

export const telemetryProxyMaxBytes = 1024 * 1024;

const empty = (status: number) =>
  new Response(null, {
    status,
  });

const telemetryPayloadTooLargeResponse = new Response(
  JSON.stringify({
    _tag: "RequestDecodeError",
    message: "Telemetry payload exceeds 1MB",
  }),
  {
    headers: {
      "content-type": "application/json",
    },
    status: 400,
  },
);

const copyForwardHeaders = (request: Request): Record<string, string> => ({
  "content-type":
    request.headers.get("content-type") ?? "application/json; charset=utf-8",
});

const defaultForwardTelemetry: ForwardTelemetry = ({
  headers,
  payload,
  url,
}) =>
  fetch(url, {
    body: payload,
    headers,
    method: "POST",
  });

export const handleTelemetryTracesRequest = Effect.fn(
  "api.telemetry.handleTelemetryTracesRequest",
)(
  function* (
    config: TelemetryProxyConfig,
    request: Request,
    options?: TelemetryProxyOptions,
  ) {
    return yield* Match.value(config.telemetryEnabled).pipe(
      Match.when(false, () => Effect.succeed(empty(204))),
      Match.orElse(() =>
        Effect.gen(function* () {
          const payload = yield* Effect.tryPromise({
            try: () => request.arrayBuffer(),
            catch: (cause) =>
              new RequestDecodeError({
                boundary: "telemetry traces body",
                cause,
                message: "Invalid telemetry traces body",
              }),
          });

          const maxBytes = options?.maxBytes ?? telemetryProxyMaxBytes;
          const forward = options?.forward ?? defaultForwardTelemetry;

          return yield* Match.value(payload.byteLength > maxBytes).pipe(
            Match.when(true, () => Effect.succeed(telemetryPayloadTooLargeResponse)),
            Match.orElse(() =>
              Effect.tryPromise({
                try: () =>
                  forward({
                    headers: copyForwardHeaders(request),
                    payload,
                    url: `${config.telemetryOtlpBaseUrl}/v1/traces`,
                  }),
                catch: (cause) =>
                  new RequestDecodeError({
                    boundary: "telemetry traces forward",
                    cause,
                    message: "Unable to forward telemetry traces",
                  }),
              }).pipe(Effect.as(empty(202))),
            ),
          );
        }),
      ),
    );
  },
);
