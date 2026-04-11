/**
 * Portal Redirect
 *
 * Handles redirecting players to the Vibe Jam 2026 webring portal,
 * forwarding all relevant parameters.
 */

import { Match, Option } from "effect";
import { FORWARDED_PORTAL_PARAM_KEYS, type PortalParams } from "./portalState";

const VIBE_JAM_PORTAL_URL = "https://vibej.am/portal/2026";
const REFACTORY_PUBLIC_ORIGIN = "https://refactory.fun";
const REFACTORY_PLAY_PATH = "/play";
const PORTAL_SIGNAL_PARAM = "portal";

const hasProtocol = (value: string) => /^https?:\/\//i.test(value);

const makeUrlFromRef = (ref: string): URL | null => {
  const candidate = hasProtocol(ref) ? ref : `https://${ref}`;
  if (!URL.canParse(candidate)) {
    return null;
  }
  return new URL(candidate);
};

const getCurrentGameRefUrl = (): string => {
  const currentUrl = new URL(window.location.href);
  const refUrl = new URL(REFACTORY_PLAY_PATH, REFACTORY_PUBLIC_ORIGIN);
  const worldId = currentUrl.searchParams.get("worldId");

  if (worldId) {
    refUrl.searchParams.set("worldId", worldId);
  }

  return refUrl.toString();
};

const applyForwardedParams = (url: URL, params: PortalParams | null): void => {
  if (!params) {
    return;
  }

  for (const [key, value] of Object.entries(params)) {
    if (!FORWARDED_PORTAL_PARAM_KEYS.has(key)) {
      continue;
    }

    url.searchParams.set(key, value);
  }
};

/**
 * Build the exit portal URL with forwarded parameters
 */
export function buildExitUrl(
  params: PortalParams | null,
  currentGameUrl?: string,
): string {
  const url = new URL(VIBE_JAM_PORTAL_URL);

  applyForwardedParams(url, params);
  url.searchParams.set("ref", currentGameUrl ?? getCurrentGameRefUrl());

  return url.toString();
}

/**
 * Build the URL for the entry/back portal.
 */
export function buildBackPortalUrl(
  params: PortalParams | null,
  currentGameUrl?: string,
): string | null {
  const backUrlOption = Option.flatMap(
    Option.fromNullishOr(params?.ref),
    (ref) => Option.fromNullishOr(makeUrlFromRef(ref)),
  );

  return Option.match(backUrlOption, {
    onNone: () => null,
    onSome: (url) => {
      url.searchParams.delete(PORTAL_SIGNAL_PARAM);
      applyForwardedParams(url, params);
      url.searchParams.set("ref", currentGameUrl ?? getCurrentGameRefUrl());
      return url.toString();
    },
  });
}

/**
 * Redirect to the Vibe Jam portal webring
 */
export function redirectToPortal(params: PortalParams | null): void {
  const exitUrl = buildExitUrl(params);

  // Use location.assign for a clean redirect
  window.location.assign(exitUrl);
}

/**
 * Redirect to the previous game when the incoming ref is present.
 */
export function redirectBackToRef(params: PortalParams | null): boolean {
  const backUrl = buildBackPortalUrl(params);

  return Match.value(backUrl).pipe(
    Match.when(Match.null, () => false),
    Match.orElse((url) => {
      window.location.assign(url);
      return true;
    }),
  );
}
