/**
 * Portal State Management
 *
 * Stores and retrieves portal session parameters for the Vibe Jam 2026 webring.
 * When a player enters via a portal handoff, their incoming parameters are stored
 * and forwarded when they exit through the exit portal.
 */

import type { AssetId } from "@refactory/contracts/worlds";
import { Effect } from "effect";
import {
  getSessionStorageItem,
  removeSessionStorageItem,
  setSessionStorageItem,
} from "../browserStorage";
import { runSync } from "../effectRuntime";

const PORTAL_STATE_KEY = "refactory.portal-session.v1";
const PORTAL_WORLD_DRAFT_KEY = "refactory.portal-world-draft.v1";

export const PORTAL_CREATION_SESSION_QUERY_PARAM =
  "refactoryPortalSession" as const;

export type PortalParams = Readonly<Record<string, string>>;

export type PortalWorldDraft = {
  readonly actorDisplayName: string;
  readonly hostAssetId: AssetId;
  readonly idempotencyKey: string;
  readonly sessionId: string;
  readonly worldName: string;
};

export const FORWARDED_PORTAL_PARAM_KEYS: ReadonlySet<string> = new Set([
  "avatar_url",
  "color",
  "hp",
  "ref",
  "rotation_x",
  "rotation_y",
  "rotation_z",
  "speed",
  "speed_x",
  "speed_y",
  "speed_z",
  "team",
  "username",
]);

const INTERNAL_PORTAL_PARAM_KEYS = new Set([
  "portal",
  "worldId",
  "entry",
  "mock",
  "scene",
  PORTAL_CREATION_SESSION_QUERY_PARAM,
]);

const isAssetId = (value: unknown): value is AssetId =>
  value === "BAR-001" ||
  value === "FLA-002" ||
  value === "FRO-003" ||
  value === "RPA-004";

const isPortalWorldDraft = (
  value: unknown,
  sessionId: string,
): value is PortalWorldDraft => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const draft = value as Record<string, unknown>;

  return (
    draft.sessionId === sessionId &&
    typeof draft.actorDisplayName === "string" &&
    typeof draft.idempotencyKey === "string" &&
    typeof draft.worldName === "string" &&
    isAssetId(draft.hostAssetId)
  );
};

const isPortalParams = (value: unknown): value is PortalParams => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((entry) => typeof entry === "string");
};

const parseJsonEffect = (value: string) =>
  Effect.try({
    try: () => JSON.parse(value) as unknown,
    catch: () => "portal.parseJson",
  }).pipe(Effect.catch(() => Effect.succeed<unknown | undefined>(undefined)));

const stringifyJsonEffect = (value: unknown) =>
  Effect.try({
    try: () => JSON.stringify(value),
    catch: () => "portal.stringifyJson",
  }).pipe(Effect.catch(() => Effect.succeed<string | undefined>(undefined)));

/**
 * Parse portal parameters from URL search params
 */
export function parsePortalParams(searchParams: URLSearchParams): PortalParams {
  const params: Record<string, string> = {};

  for (const [key, value] of searchParams.entries()) {
    if (
      !INTERNAL_PORTAL_PARAM_KEYS.has(key) &&
      FORWARDED_PORTAL_PARAM_KEYS.has(key)
    ) {
      params[key] = value;
    }
  }

  return params;
}

export function isPortalHandoff(searchParams: URLSearchParams): boolean {
  return (
    searchParams.get("portal") === "true" ||
    (searchParams.get("ref") ?? "").trim().length > 0
  );
}

/**
 * Store portal session in sessionStorage
 * Uses sessionStorage so params are cleared when tab closes
 */
export function storePortalSession(params: PortalParams): void {
  const encoded = runSync(stringifyJsonEffect(params));
  if (encoded === undefined || !setSessionStorageItem(PORTAL_STATE_KEY, encoded)) {
    console.warn("Failed to store portal session");
  }
}

/**
 * Read portal session from sessionStorage
 */
export function readPortalSession(): PortalParams | null {
  const stored = getSessionStorageItem(PORTAL_STATE_KEY);
  if (!stored) {
    return null;
  }

  const parsed = runSync(parseJsonEffect(stored));
  return isPortalParams(parsed) ? parsed : null;
}

/**
 * Clear portal session from sessionStorage
 */
export function clearPortalSession(): void {
  if (!removeSessionStorageItem(PORTAL_STATE_KEY)) {
    return;
  }
}

/**
 * Check if any portal params have values
 */
export function hasPortalParams(params: PortalParams): boolean {
  return Object.keys(params).length > 0;
}

export function readPortalWorldDraft(
  sessionId: string,
): PortalWorldDraft | null {
  const stored = getSessionStorageItem(PORTAL_WORLD_DRAFT_KEY);
  if (!stored) {
    return null;
  }

  const parsed = runSync(parseJsonEffect(stored));
  return isPortalWorldDraft(parsed, sessionId) ? parsed : null;
}

export function storePortalWorldDraft(draft: PortalWorldDraft): void {
  const encoded = runSync(stringifyJsonEffect(draft));
  if (
    encoded === undefined ||
    !setSessionStorageItem(PORTAL_WORLD_DRAFT_KEY, encoded)
  ) {
    console.warn("Failed to store portal world draft");
  }
}

export function clearPortalWorldDraft(sessionId: string): void {
  const stored = getSessionStorageItem(PORTAL_WORLD_DRAFT_KEY);
  if (!stored) {
    return;
  }

  const parsed = runSync(parseJsonEffect(stored));
  if (isPortalWorldDraft(parsed, sessionId)) {
    void removeSessionStorageItem(PORTAL_WORLD_DRAFT_KEY);
  }
}
