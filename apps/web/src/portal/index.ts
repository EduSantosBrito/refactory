/**
 * Portal System for Vibe Jam 2026 Webring
 *
 * Enables traversal between games in the jam webring.
 * - Entry portal: Return to previous game
 * - Exit portal: Continue to next game via vibej.am/portal/2026
 */

export {
  buildBackPortalUrl,
  buildExitUrl,
  redirectBackToRef,
  redirectToPortal,
} from "./portalRedirect";
export type { PortalParams } from "./portalState";
export {
  clearPortalSession,
  clearPortalWorldDraft,
  hasPortalParams,
  isPortalHandoff,
  PORTAL_CREATION_SESSION_QUERY_PARAM,
  parsePortalParams,
  readPortalSession,
  readPortalWorldDraft,
  storePortalSession,
  storePortalWorldDraft,
} from "./portalState";
