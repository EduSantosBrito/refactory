# Tracing (Effect + Jaeger)

This project supports local trace visualization with Effect OTLP exporters and Jaeger.

## 1. Start Jaeger

```sh
bun run observability:up
```

Jaeger UI: `http://localhost:16686`

Stop stack:

```sh
bun run observability:down
```

## 2. Enable telemetry

Set the following environment variables.

API:

```sh
API_TELEMETRY_ENABLED=true
API_TELEMETRY_OTLP_BASE_URL=http://localhost:4318
API_TELEMETRY_SERVICE_NAME=refactory-api
API_TELEMETRY_SERVICE_VERSION=dev
```

Web:

```sh
VITE_TELEMETRY_ENABLED=true
VITE_TELEMETRY_TRACES_URL=/api/telemetry/v1/traces
```

## 3. Run apps

```sh
bun run dev
```

## 4. What to expect

- Backend service name: `refactory-api`
- Frontend service name: `refactory-web`
- Frontend traces are proxied through API endpoint: `POST /api/telemetry/v1/traces`
- Proxy returns:
  - `204` when API telemetry is disabled
  - `202` when payload is forwarded
  - `400` when payload is larger than 1MB
