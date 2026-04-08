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
import {
  getOrCreateActorCredentials,
  makeSignedActorHeaders,
} from "./actorAuth";

const requestUrlBase = "http://refactory.local";
const defaultFetchBasePath = "/api";
const defaultSigningBasePath = defaultFetchBasePath;

type SignedWorldClientOptions = {
  readonly actorDisplayName: string;
  readonly fetchBasePath?: string;
  readonly signingBasePath?: string;
};

export class WorldApiClient extends ServiceMap.Service<
  WorldApiClient,
  HttpApiClient.ForApi<typeof Api>
>()("refactory/web/WorldApiClient") {}

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

  return pathname.startsWith(`${prefix}/`)
    ? pathname.slice(prefix.length)
    : pathname;
};

const toSigningPathAndQuery = (
  requestUrl: string,
  fetchBasePath: string,
  signingBasePath: string,
) => {
  const parsed = new URL(requestUrl, requestUrlBase);
  const strippedPath = stripPathPrefix(
    parsed.pathname,
    normalizePathPrefix(fetchBasePath),
  );
  const signingPrefix = normalizePathPrefix(signingBasePath);

  return `${signingPrefix}${strippedPath}${parsed.search}`;
};

const makePrefixedHttpClient = Effect.fnUntraced(function* (
  fetchBasePath: string,
) {
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
      const actor = yield* getOrCreateActorCredentials({
        displayName: options.actorDisplayName,
      }).pipe(
        Effect.mapError(
          (cause) =>
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
        pathAndQuery: toSigningPathAndQuery(
          request.url,
          fetchBasePath,
          signingBasePath,
        ),
      }).pipe(
        Effect.mapError(
          (cause) =>
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

/**
 * Build a typed client for the shared world API.
 *
 * @remarks
 * This keeps the web app and API server on one contract source instead of duplicating route and schema knowledge in a hand-written client.
 *
 * Requests are sent through the shared `Api` definition, prefixed with `fetchBasePath`, and protected endpoints are signed through the `ActorAuth` client middleware.
 *
 * @param options - Actor identity and path-prefix options for signed requests.
 * @returns An `Effect` that yields the generated world API client.
 */
export const makeWorldApiClient = (options: SignedWorldClientOptions) => {
  const fetchBasePath = options.fetchBasePath ?? defaultFetchBasePath;
  const clientLayer = Layer.mergeAll(
    FetchHttpClient.layer,
    makeActorAuthClient(options),
  );

  return HttpApiClient.make(Api, {
    transformClient: (client) =>
      client.pipe(
        HttpClient.mapRequest(HttpClientRequest.prependUrl(fetchBasePath)),
      ),
  }).pipe(Effect.provide(clientLayer));
};

/**
 * Expose the typed world API client as an Effect layer.
 *
 * @remarks
 * This is useful when a larger Effect program should depend on `WorldApiClient` as a service instead of constructing clients inline.
 *
 * The layer delegates to {@link makeWorldApiClient}, so it preserves the same shared contract, fetch transport, and signing middleware behavior.
 *
 * @param options - Actor identity and path-prefix options for signed requests.
 * @returns A layer that provides `WorldApiClient`.
 */
export const WorldApiClientLive = (options: SignedWorldClientOptions) =>
  Layer.effect(WorldApiClient, makeWorldApiClient(options));

/**
 * Create a world through the shared typed API contract.
 *
 * @remarks
 * This helper exists so callers do not need to repeat client construction or request-signing setup for the common world-creation path.
 *
 * It builds a signed client for the provided actor and forwards the typed payload to the generated `worlds.createWorld` endpoint.
 *
 * @param options - Actor identity, optional base paths, and the create-world request payload.
 * @returns An `Effect` that yields the typed create-world response.
 */
export const createWorld = Effect.fnUntraced(function* (options: {
  readonly actorDisplayName: string;
  readonly fetchBasePath?: string;
  readonly request: CreateWorldRequest;
  readonly signingBasePath?: string;
}) {
  const client = yield* makeWorldApiClient(options);
  return yield* client.worlds.createWorld({ payload: options.request });
});

/**
 * Fetch a world detail record through the shared typed API contract.
 *
 * @remarks
 * This centralizes signed reads for world detail lookups, including worlds that are only visible to their owner.
 *
 * It builds a signed client for the actor and forwards the world id to the generated `worlds.getWorld` endpoint.
 *
 * @param options - Actor identity, optional base paths, and the target world id.
 * @returns An `Effect` that yields the typed world-detail response.
 */
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

/**
 * List the current actor's worlds through the shared typed API contract.
 *
 * @remarks
 * This keeps signed list access and query handling consistent while hiding client construction from callers.
 *
 * It builds a signed client for the actor, defaults the optional query to an empty object, and calls the generated `worlds.listOwnWorlds` endpoint.
 *
 * @param options - Actor identity, optional base paths, and optional world-list query values.
 * @returns An `Effect` that yields the typed world-list response.
 */
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

/**
 * List public worlds without actor authentication.
 *
 * @remarks
 * Public discovery should not depend on local actor state or signed headers.
 *
 * This helper builds a plain prefixed `HttpClient`, derives the generated `listPublicWorlds` endpoint client, and executes it with the optional query.
 *
 * @param options - Optional base path and world-list query values.
 * @returns An `Effect` that yields the typed public world-list response.
 */
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
