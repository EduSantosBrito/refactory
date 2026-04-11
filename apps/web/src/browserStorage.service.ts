import { Data, Effect, Layer, ServiceMap } from "effect";

export class BrowserStorageError extends Data.TaggedError(
  "BrowserStorageError",
)<{
  readonly cause: unknown;
  readonly operation: string;
}> {}

export class BrowserStorage extends ServiceMap.Service<
  BrowserStorage,
  {
    localGet: (key: string) => Effect.Effect<string | null, BrowserStorageError>;
    localRemove: (key: string) => Effect.Effect<void, BrowserStorageError>;
    localSet: (key: string, value: string) => Effect.Effect<void, BrowserStorageError>;
    sessionGet: (key: string) => Effect.Effect<string | null, BrowserStorageError>;
    sessionRemove: (key: string) => Effect.Effect<void, BrowserStorageError>;
    sessionSet: (key: string, value: string) => Effect.Effect<void, BrowserStorageError>;
  }
>()("refactory/web/BrowserStorage") {
  static readonly Live = Layer.effect(
    BrowserStorage,
    Effect.succeed(
      BrowserStorage.of({
        localGet: Effect.fn("web.storage.local.get")((key: string) =>
          Effect.try({
            try: () => window.localStorage.getItem(key),
            catch: (cause) =>
              new BrowserStorageError({
                cause,
                operation: "browserStorage.local.get",
              }),
          }),
        ),
        localRemove: Effect.fn("web.storage.local.remove")((key: string) =>
          Effect.try({
            try: () => {
              window.localStorage.removeItem(key);
            },
            catch: (cause) =>
              new BrowserStorageError({
                cause,
                operation: "browserStorage.local.remove",
              }),
          }),
        ),
        localSet: Effect.fn("web.storage.local.set")((key: string, value: string) =>
          Effect.try({
            try: () => {
              window.localStorage.setItem(key, value);
            },
            catch: (cause) =>
              new BrowserStorageError({
                cause,
                operation: "browserStorage.local.set",
              }),
          }),
        ),
        sessionGet: Effect.fn("web.storage.session.get")((key: string) =>
          Effect.try({
            try: () => window.sessionStorage.getItem(key),
            catch: (cause) =>
              new BrowserStorageError({
                cause,
                operation: "browserStorage.session.get",
              }),
          }),
        ),
        sessionRemove: Effect.fn("web.storage.session.remove")((key: string) =>
          Effect.try({
            try: () => {
              window.sessionStorage.removeItem(key);
            },
            catch: (cause) =>
              new BrowserStorageError({
                cause,
                operation: "browserStorage.session.remove",
              }),
          }),
        ),
        sessionSet: Effect.fn("web.storage.session.set")((key: string, value: string) =>
          Effect.try({
            try: () => {
              window.sessionStorage.setItem(key, value);
            },
            catch: (cause) =>
              new BrowserStorageError({
                cause,
                operation: "browserStorage.session.set",
              }),
          }),
        ),
      }),
    ),
  );
}

const withStorage = Effect.fn("web.storage.with_storage")(
  function* <A>(
    use: (storage: BrowserStorage["Service"]) => Effect.Effect<A, BrowserStorageError>,
  ) {
    const storage = yield* BrowserStorage;
    return yield* use(storage);
  },
);

export const getLocalStorageItemEffect = Effect.fn("web.storage.local.get_safe")((key: string) =>
  withStorage((storage) => storage.localGet(key)).pipe(
    Effect.catch(() => Effect.succeed<string | null>(null)),
  ),
);

export const setLocalStorageItemEffect = Effect.fn("web.storage.local.set_safe")((key: string, value: string) =>
  withStorage((storage) => storage.localSet(key, value)).pipe(
    Effect.as(true),
    Effect.catch(() => Effect.succeed(false)),
  ),
);

export const removeLocalStorageItemEffect = Effect.fn(
  "web.storage.local.remove_safe",
)((key: string) =>
  withStorage((storage) => storage.localRemove(key)).pipe(
    Effect.as(true),
    Effect.catch(() => Effect.succeed(false)),
  ),
);

export const getSessionStorageItemEffect = Effect.fn("web.storage.session.get_safe")((key: string) =>
  withStorage((storage) => storage.sessionGet(key)).pipe(
    Effect.catch(() => Effect.succeed<string | null>(null)),
  ),
);

export const setSessionStorageItemEffect = Effect.fn("web.storage.session.set_safe")((key: string, value: string) =>
  withStorage((storage) => storage.sessionSet(key, value)).pipe(
    Effect.as(true),
    Effect.catch(() => Effect.succeed(false)),
  ),
);

export const removeSessionStorageItemEffect = Effect.fn(
  "web.storage.session.remove_safe",
)((key: string) =>
  withStorage((storage) => storage.sessionRemove(key)).pipe(
    Effect.as(true),
    Effect.catch(() => Effect.succeed(false)),
  ),
);
