import { Layer, ServiceMap } from "effect";

const parsePort = (value: string | undefined, fallback: number) => {
  if (value === undefined) {
    return fallback;
  }

  const candidate = Number(value);

  return Number.isInteger(candidate) && candidate > 0 ? candidate : fallback;
};

const defaultDatabasePath = new URL("../refactory.sqlite", import.meta.url).pathname;

export class AppConfig extends ServiceMap.Service<
  AppConfig,
  {
    readonly apiName: string;
    readonly databasePath: string;
    readonly port: number;
    readonly rulesetVersion: string;
    readonly worldSchemaVersion: number;
  }
>()("refactory/AppConfig") {
  static readonly Live = Layer.succeed(AppConfig, {
    apiName: "refactory-api",
    databasePath: Bun.env.API_DATABASE_PATH ?? defaultDatabasePath,
    port: parsePort(Bun.env.API_PORT ?? Bun.env.PORT, 3001),
    rulesetVersion: "gpy7-v1",
    worldSchemaVersion: 1,
  });
}
