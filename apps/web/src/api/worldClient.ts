import { Api } from "@refactory/contracts/api";
import { ActorAuth } from "@refactory/contracts/auth";
export {
  CreateWorldRequest,
  CreateWorldResponse,
  GetWorldResponse,
  ListWorldsResponse,
  WorldListQuery,
} from "@refactory/contracts/worlds";
import type {
  CreateWorldRequest,
  CreateWorldResponse,
  GetWorldResponse,
  ListWorldsResponse,
  WorldListQuery,
} from "@refactory/contracts/worlds";
import { Effect, Layer, ServiceMap } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientError,
  HttpClientRequest,
} from "effect/unstable/http";
import { HttpApiClient, HttpApiMiddleware } from "effect/unstable/httpapi";
import { getOrCreateActorCredentials, makeSignedActorHeaders } from "./actorAuth";

const requestUrlBase = "http://refactory.local";
const defaultFetchBasePath = "/api";
const defaultSigningBasePath = "";

type SignedWorldClientOptions = {
  readonly actorDisplayName: string;
  readonly fetchBasePath?: string;
  readonly signingBasePath?: string;
};

type PublicWorldClientOptions = {
  readonly fetchBasePath?: string;
};

export class WorldApiClient extends ServiceMap.Service<WorldApiClient, HttpApiClient.ForApi<typeof Api>>()(
  "refactory/web/WorldApiClient",
) {}

const trimTrailingSlash = (value: string) =>
  value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;

const normalizePathPrefix = (value: string) => {
  if (value.length === 0) {
    return "";
  }

  const parsed = new URL(value, requestUrlBase);
  const normalizedPathname = trimTrailingSlash(parsed.pathname);

  return normalizedPathname === "/" ? "" : normalizedPathname;
};

const stripPathPrefix = (pathname: string, prefix: string) => {
  if (prefix.length === 0) {
    return pathname;
  }

  if (pathname === prefix) {
    return "/";
  }

  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
};

const toSigningPathAndQuery = (requestUrl: string, fetchBasePath: string, signingBasePath: string) => {
  const parsed = new URL(requestUrl, requestUrlBase);
  const strippedPath = stripPathPrefix(parsed.pathname, normalizePathPrefix(fetchBasePath));
  const signingPrefix = normalizePathPrefix(signingBasePath);

  return `${signingPrefix}${strippedPath}${parsed.search}`;
};

const makePrefixedHttpClient = Effect.fnUntraced(function* (fetchBasePath: string) {
  const httpClient = yield* HttpClient.HttpClient;
  return httpClient.pipe(
    HttpClient.mapRequest(HttpClientRequest.prependUrl(fetchBasePath)),
  );
});

const makeActorAuthClient = (options: SignedWorldClientOptions) => {
  const fetchBasePath = options.fetchBasePath ?? defaultFetchBasePath;
  const signingBasePath = options.signingBasePath ?? defaultSigningBasePath;

  return HttpApiMiddleware.layerClient(
    ActorAuth,
    Effect.fnUntraced(function* ({ next, request }) {
      const actor = yield* getOrCreateActorCredentials({ displayName: options.actorDisplayName }).pipe(
        Effect.mapError((cause) =>
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.EncodeError({
              cause,
              description: "Actor credentials could not be loaded",
              request,
            }),
          }),
        ),
      );
      const headers = yield* makeSignedActorHeaders({
        actor,
        method: request.method,
        pathAndQuery: toSigningPathAndQuery(request.url, fetchBasePath, signingBasePath),
      }).pipe(
        Effect.mapError((cause) =>
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.EncodeError({
              cause,
              description: "Actor request could not be signed",
              request,
            }),
          }),
        ),
      );

      return yield* next(HttpClientRequest.setHeaders(request, headers));
    }),
  );
};

export const makeWorldApiClient = (options: SignedWorldClientOptions) => {
  const fetchBasePath = options.fetchBasePath ?? defaultFetchBasePath;

  return HttpApiClient.make(Api, {
    transformClient: (client) => client.pipe(HttpClient.mapRequest(HttpClientRequest.prependUrl(fetchBasePath))),
  }).pipe(
    Effect.provide(makeActorAuthClient(options)),
    Effect.provide(FetchHttpClient.layer),
  );
};

export const WorldApiClientLive = (options: SignedWorldClientOptions) =>
  Layer.effect(WorldApiClient, makeWorldApiClient(options));

export const createWorld = Effect.fnUntraced(function* (options: {
  readonly actorDisplayName: string;
  readonly fetchBasePath?: string;
  readonly request: CreateWorldRequest;
  readonly signingBasePath?: string;
}) {
  const client = yield* makeWorldApiClient(options);
  return yield* client.worlds.createWorld({ payload: options.request });
});

export const getWorld = Effect.fnUntraced(function* (options: {
  readonly actorDisplayName: string;
  readonly fetchBasePath?: string;
  readonly signingBasePath?: string;
  readonly worldId: string;
}) {
  const client = yield* makeWorldApiClient(options);
  return yield* client.worlds.getWorld({
    params: { worldId: options.worldId },
  });
});

export const listOwnWorlds = Effect.fnUntraced(function* (options: {
  readonly actorDisplayName: string;
  readonly fetchBasePath?: string;
  readonly query?: WorldListQuery;
  readonly signingBasePath?: string;
}) {
  const client = yield* makeWorldApiClient(options);
  return yield* client.worlds.listOwnWorlds({
    query: options.query ?? {},
  });
});

export const listPublicWorlds = Effect.fnUntraced(function* (options?: {
  readonly fetchBasePath?: string;
  readonly query?: WorldListQuery;
}) {
  const fetchBasePath = options?.fetchBasePath ?? defaultFetchBasePath;
  const httpClient = yield* makePrefixedHttpClient(fetchBasePath).pipe(
    Effect.provide(FetchHttpClient.layer),
  );
  const listPublicWorldsEndpoint = yield* HttpApiClient.endpoint(Api, {
    endpoint: "listPublicWorlds",
    group: "worlds",
    httpClient,
  });

  return yield* listPublicWorldsEndpoint({
    query: options?.query ?? {},
  });
});
