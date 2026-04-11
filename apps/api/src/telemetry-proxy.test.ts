import { expect, test } from "bun:test";
import { Effect } from "effect";
import {
  handleTelemetryTracesRequest,
  telemetryProxyMaxBytes,
} from "./telemetry-proxy.ts";

const telemetryEnabledConfig = {
  telemetryEnabled: true,
  telemetryOtlpBaseUrl: "http://localhost:4318",
} as const;

test("telemetry proxy returns 204 when telemetry is disabled", async () => {
  const response = await Effect.runPromise(
    handleTelemetryTracesRequest(
      {
        telemetryEnabled: false,
        telemetryOtlpBaseUrl: "http://localhost:4318",
      },
      new Request("http://localhost/api/telemetry/v1/traces", {
        body: JSON.stringify({ resourceSpans: [] }),
        method: "POST",
      }),
    ),
  );

  expect(response.status).toBe(204);
});

test("telemetry proxy forwards payload and returns 202 when telemetry is enabled", async () => {
  let forwarded = false;
  let forwardedUrl = "";
  let forwardedContentType = "";
  let forwardedPayloadSize = 0;

  const response = await Effect.runPromise(
    handleTelemetryTracesRequest(
      telemetryEnabledConfig,
      new Request("http://localhost/api/telemetry/v1/traces", {
        body: JSON.stringify({ resourceSpans: [{ scopeSpans: [] }] }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
      {
        forward: async ({ headers, payload, url }) => {
          forwarded = true;
          forwardedUrl = url;
          forwardedContentType = headers["content-type"] ?? "";
          forwardedPayloadSize = payload.byteLength;
        },
      },
    ),
  );

  expect(response.status).toBe(202);
  expect(forwarded).toBe(true);
  expect(forwardedUrl).toBe("http://localhost:4318/v1/traces");
  expect(forwardedContentType).toBe("application/json");
  expect(forwardedPayloadSize).toBeGreaterThan(0);
});

test("telemetry proxy rejects oversized payload with 400", async () => {
  let forwarded = false;
  const oversizedPayload = new Uint8Array(telemetryProxyMaxBytes + 1);

  const response = await Effect.runPromise(
    handleTelemetryTracesRequest(
      telemetryEnabledConfig,
      new Request("http://localhost/api/telemetry/v1/traces", {
        body: oversizedPayload,
        method: "POST",
      }),
      {
        forward: async () => {
          forwarded = true;
        },
      },
    ),
  );

  expect(response.status).toBe(400);
  expect(forwarded).toBe(false);
});
