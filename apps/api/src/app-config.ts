import {
  Config,
  ConfigProvider,
  Effect,
  Layer,
  Option,
  Schema,
  ServiceMap,
} from "effect";

const parsePort = (value: string | undefined, fallback: number) => {
  return Option.fromUndefinedOr(value).pipe(
    Option.map((candidate) => Number(candidate)),
    Option.filter(
      (candidate: number) => Number.isInteger(candidate) && candidate > 0,
    ),
    Option.getOrElse(() => fallback),
  );
};

const parseBoolean = (value: string | undefined, fallback: boolean) =>
  Option.fromUndefinedOr(value).pipe(
    Option.map((candidate) => candidate.trim().toLowerCase()),
    Option.map((candidate) =>
      candidate === "1" ||
      candidate === "true" ||
      candidate === "yes" ||
      candidate === "on",
    ),
    Option.getOrElse(() => fallback),
  );

const defaultDatabasePath = new URL("../refactory.sqlite", import.meta.url)
  .pathname;

const appConfigConfig = Config.all({
  apiName: Config.succeed("refactory-api"),
  databasePath: Config.schema(Schema.String, "API_DATABASE_PATH").pipe(
    Config.withDefault(defaultDatabasePath),
  ),
  port: Config.all({
    apiPort: Config.option(Config.schema(Schema.String, "API_PORT")),
    port: Config.option(Config.schema(Schema.String, "PORT")),
  }).pipe(
    Config.map(({ apiPort, port }) =>
      parsePort(
        Option.getOrUndefined(apiPort) ?? Option.getOrUndefined(port),
        3001,
      ),
    ),
  ),
  rulesetVersion: Config.succeed("gpy7-v1"),
  telemetryEnabled: Config.option(
    Config.schema(Schema.String, "API_TELEMETRY_ENABLED"),
  ).pipe(
    Config.map((enabled) => parseBoolean(Option.getOrUndefined(enabled), false)),
  ),
  telemetryOtlpBaseUrl: Config.schema(
    Schema.String,
    "API_TELEMETRY_OTLP_BASE_URL",
  ).pipe(Config.withDefault("http://localhost:4318")),
  telemetryServiceName: Config.schema(
    Schema.String,
    "API_TELEMETRY_SERVICE_NAME",
  ).pipe(Config.withDefault("refactory-api")),
  telemetryServiceVersion: Config.schema(
    Schema.String,
    "API_TELEMETRY_SERVICE_VERSION",
  ).pipe(Config.withDefault("dev")),
  worldSchemaVersion: Config.succeed(1),
});

export class AppConfig extends ServiceMap.Service<
  AppConfig,
  {
    readonly apiName: string;
    readonly databasePath: string;
    readonly port: number;
    readonly rulesetVersion: string;
    readonly telemetryEnabled: boolean;
    readonly telemetryOtlpBaseUrl: string;
    readonly telemetryServiceName: string;
    readonly telemetryServiceVersion: string;
    readonly worldSchemaVersion: number;
  }
>()("refactory/AppConfig") {
  static readonly layer = Layer.effect(
    AppConfig,
    Effect.flatMap(ConfigProvider.ConfigProvider.asEffect(), (provider) =>
      appConfigConfig.parse(provider),
    ),
  );

  static readonly Live = AppConfig.layer.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv())),
  );
}
