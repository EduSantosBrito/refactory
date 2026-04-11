import type { WorldRuntimeSnapshot } from "@refactory/contracts/runtime";
import type {
  AssetId,
  WorldMode,
  WorldSummary,
  WorldVisibility,
} from "@refactory/contracts/worlds";
import { Effect, Match, Option } from "effect";
import {
  lazy,
  type ReactNode,
  type RefObject,
  StrictMode,
  Suspense,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { AmbientMusicPlayer } from "./AmbientMusicPlayer";
import {
  getOrCreateActorCredentials,
  readStoredActorDisplayName,
} from "./api/actorAuth";
import {
  createWorld,
  deleteWorld,
  getWorld,
  listOwnWorlds,
} from "./api/worldClient";
import { getWorldRuntime } from "./api/worldRuntimeClient";
import { AudioSettingsProvider, useAudioSettings } from "./audio-settings";
import {
  getLocalStorageItem,
  removeLocalStorageItem,
  setLocalStorageItem,
} from "./browserStorage";
import type { BrowserStorage } from "./browserStorage.service";
import { DEFAULT_ASSET_ID } from "./characterAssets";
import { ActionBar } from "./components/ActionBar";
import { BuildMenu } from "./components/BuildMenu";
import { Chatbox } from "./components/Chatbox";
import { InventoryModal } from "./components/InventoryModal";
import { PortalModal } from "./components/PortalModal";
import { RefactoryLogo } from "./components/RefactoryLogo";
import { SliderControl } from "./components/SliderControl";
import { VossDialog, type VossLine } from "./components/VossDialog";
import { type WorldMenuAction, WorldMenuHud } from "./components/WorldMenuHud";
import type { CharacterName } from "./models/Character";
import {
  clearPortalWorldDraft,
  hasPortalParams,
  isPortalHandoff,
  PORTAL_CREATION_SESSION_QUERY_PARAM,
  parsePortalParams,
  readPortalSession,
  readPortalWorldDraft,
  redirectBackToRef,
  redirectToPortal,
  storePortalSession,
  storePortalWorldDraft,
  type PortalParams,
} from "./portal";
import { preloadWorldExperience } from "./preload";
import { CHARACTER_SELECT_EVENT } from "./scenes/StartScreenCast";
import { StartScreenScene } from "./scenes/StartScreenScene";
import {
  readPortalQueryUsername,
  resolveActorDisplayName,
} from "./usernameResolution";
import { runPromise } from "./effectRuntime";
import {
  logWorldLoadEventOnce,
  withWorldFlowSpan,
} from "./world/worldLoadLog";

const World = lazy(() => import("./World").then((m) => ({ default: m.World })));
const Game = lazy(() => import("./Game").then((m) => ({ default: m.Game })));
const WORLD_VISUAL_READY_EVENT = "world-visual-ready";
const DEFAULT_PORTAL_USERNAME = "Operator";

type ApiStatus =
  | { readonly _tag: "loading" }
  | { readonly _tag: "ready"; readonly message: string }
  | { readonly _tag: "error"; readonly message: string };

type HomePanel = "root" | "developer" | "new-world" | "load-world" | "settings";

type NewWorldDraft = {
  readonly hostAssetId: AssetId;
  readonly mode: WorldMode;
  readonly username: string;
  readonly visibility: WorldVisibility;
  readonly worldName: string;
};

type PendingWorldRemoval = {
  readonly worldId: string;
  readonly worldName: string;
};

type SelectedWorldState =
  | { readonly _tag: "mock" }
  | { readonly _tag: "creating" } // Portal entry: creating new world
  | { readonly _tag: "loading"; readonly worldId: string }
  | {
      readonly _tag: "ready";
      readonly hostAssetId: AssetId;
      readonly mode: WorldMode;
      readonly portalParams?: PortalParams;
      readonly runtimeSnapshot: WorldRuntimeSnapshot;
      readonly worldId: string;
      readonly worldName: string;
    }
  | {
      readonly _tag: "error";
      readonly message: string;
      readonly worldId?: string;
    };

const lastAccessedWorldStorageKey = "refactory.last-accessed-world-id.v1";
const preferredAssetStorageKey = "refactory.preferred-asset-id.v1";

const assetChoices: ReadonlyArray<{
  readonly assetId: AssetId;
  readonly characterName: CharacterName;
  readonly shortName: string;
  readonly worldCreationFlavor: string;
}> = [
  {
    assetId: "BAR-001",
    characterName: "Barbara",
    shortName: "Barbara",
    worldCreationFlavor:
      "Security plan may include a honeypot before anyone asked for one.",
  },
  {
    assetId: "FLA-002",
    characterName: "Fernando",
    shortName: "Fernando",
    worldCreationFlavor:
      "Strong preference for deploying directly to the cloud.",
  },
  {
    assetId: "FRO-003",
    characterName: "Finn",
    shortName: "Finn",
    worldCreationFlavor:
      "Debug strategy favors waiting perfectly still until the issue surfaces.",
  },
  {
    assetId: "RPA-004",
    characterName: "Rae",
    shortName: "Rae",
    worldCreationFlavor:
      "Branch reviews may pause for a nap halfway through the diff.",
  },
];

const usernamePrefixes = [
  "Copper",
  "Drift",
  "Ember",
  "Flint",
  "Helio",
  "Nova",
  "Orbit",
  "Quartz",
  "Signal",
  "Vector",
] as const;

const usernameSuffixes = [
  "Badger",
  "Bee",
  "Comet",
  "Fox",
  "Frog",
  "Otter",
  "Panda",
  "Pilot",
  "Scout",
  "Wren",
] as const;

const worldNamePrefixes = [
  "Amber",
  "Delta",
  "Iron",
  "North",
  "Pioneer",
  "Relay",
  "Signal",
  "Solar",
  "Stone",
  "Verdant",
] as const;

const worldNameSuffixes = [
  "Basin",
  "Cradle",
  "Drift",
  "Frontier",
  "Sector",
  "Spindle",
  "Station",
  "Stride",
  "Works",
  "Yard",
] as const;

const pickRandom = <T,>(options: readonly T[]): T => {
  const fallback = options[0];

  if (fallback === undefined) {
    throw new Error("pickRandom requires at least one option.");
  }

  return options[Math.floor(Math.random() * options.length)] ?? fallback;
};

const pickRandomAssetId = (): AssetId => pickRandom(assetChoices).assetId;

const makeRandomUsername = () =>
  `${pickRandom(usernamePrefixes)} ${pickRandom(usernameSuffixes)}-${Math.floor(
    10 + Math.random() * 90,
  )}`;

const makeRandomWorldName = () =>
  `${pickRandom(worldNamePrefixes)} ${pickRandom(worldNameSuffixes)} ${Math.floor(
    10 + Math.random() * 90,
  )}`;

const makePortalWorldName = (actorDisplayName: string, sessionId: string) =>
  `${actorDisplayName}'s Portal ${sessionId.slice(0, 8)}`;

const readLastAccessedWorldId = () =>
  getLocalStorageItem(lastAccessedWorldStorageKey);

const writeLastAccessedWorldId = (worldId: string) =>
  void setLocalStorageItem(lastAccessedWorldStorageKey, worldId);

const clearLastAccessedWorldId = () =>
  void removeLocalStorageItem(lastAccessedWorldStorageKey);

const readPreferredAssetId = (): AssetId => {
  const stored = getLocalStorageItem(preferredAssetStorageKey);

  return Match.value(stored).pipe(
    Match.when("BAR-001", (assetId) => assetId),
    Match.when("FLA-002", (assetId) => assetId),
    Match.when("FRO-003", (assetId) => assetId),
    Match.when("RPA-004", (assetId) => assetId),
    Match.orElse(() => DEFAULT_ASSET_ID),
  );
};

const writePreferredAssetId = (assetId: AssetId) =>
  void setLocalStorageItem(preferredAssetStorageKey, assetId);

const makeNewWorldDraft = (
  username: string,
  hostAssetId: AssetId,
): NewWorldDraft => ({
  hostAssetId,
  mode: "solo",
  username,
  visibility: "private",
  worldName: makeRandomWorldName(),
});

const formatWorldTimestamp = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};

const isApiProxyErrorMessage = (message: string) =>
  message.includes("/api/") &&
  (message.includes("502") ||
    message.includes("503") ||
    message.includes("Bad Gateway") ||
    message.includes("Service Unavailable"));

const isNetworkUnavailableMessage = (message: string) =>
  message.includes("Failed to fetch") ||
  message.includes("Network request failed");

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.length > 0) {
    const message = error.message.trim();

    if (
      isApiProxyErrorMessage(message) ||
      isNetworkUnavailableMessage(message)
    ) {
      if (window.location.hostname === "localhost") {
        return "World API unavailable. Start the API server on localhost:3001 or run bun run dev from the repo root.";
      }

      return "World API unavailable. The upstream /api service could not be reached.";
    }

    return message;
  }

  return "Backend request failed";
};

const resolveContinueWorld = (
  worlds: readonly WorldSummary[],
  lastAccessedWorldId: string | null,
) => {
  const readyWorlds = worlds.filter((world) => world.worldStatus === "ready");

  if (readyWorlds.length === 0) {
    return undefined;
  }

  return (
    readyWorlds.find((world) => world.worldId === lastAccessedWorldId) ??
    readyWorlds[0]
  );
};

const goToWorld = (
  worldId: string,
  options?: {
    readonly entry?: "resume";
  },
) => {
  writeLastAccessedWorldId(worldId);
  const nextUrl = new URL(window.location.href);
  nextUrl.pathname = "/play";
  nextUrl.search = "";
  nextUrl.searchParams.set("worldId", worldId);
  if (options?.entry) {
    nextUrl.searchParams.set("entry", options.entry);
  }
  window.location.assign(nextUrl.toString());
};

const ensurePortalCreationSessionIdInUrl = () => {
  const nextUrl = new URL(window.location.href);
  const existingSessionId = nextUrl.searchParams.get(
    PORTAL_CREATION_SESSION_QUERY_PARAM,
  );

  if (existingSessionId) {
    return existingSessionId;
  }

  const sessionId = crypto.randomUUID();
  nextUrl.searchParams.set(PORTAL_CREATION_SESSION_QUERY_PARAM, sessionId);
  window.history.replaceState(null, "", nextUrl.toString());

  return sessionId;
};

const replacePortalUrlWithWorldId = (worldId: string) => {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("worldId", worldId);
  nextUrl.searchParams.delete(PORTAL_CREATION_SESSION_QUERY_PARAM);
  window.history.replaceState(null, "", nextUrl.toString());
};

const loadRuntimeSnapshotEffect = (
  actorDisplayName: string,
  worldId: string,
) =>
  getWorldRuntime({
    actorDisplayName,
    worldId,
  }).pipe(Effect.map((response) => response.snapshot));

type RunResult<A> =
  | { readonly _tag: "failure"; readonly error: unknown }
  | { readonly _tag: "success"; readonly value: A };

const runPromiseEffect = <A, E>(effect: Effect.Effect<A, E, unknown>) =>
  runPromise(effect as Effect.Effect<A, E, BrowserStorage>);

const runResult = <A, E>(effect: Effect.Effect<A, E, unknown>) =>
  runPromiseEffect(
    (effect as Effect.Effect<A, E, BrowserStorage>).pipe(
      Effect.match({
        onFailure: (error): RunResult<A> => ({ _tag: "failure", error }),
        onSuccess: (value): RunResult<A> => ({ _tag: "success", value }),
      }),
    ),
  );

const withOperationSpan = <A, E, R>(
  name: string,
  attributes: Record<string, unknown>,
  effect: Effect.Effect<A, E, R>,
) =>
  withWorldFlowSpan(
    name,
    attributes,
    effect.pipe(
      Effect.tap(() =>
        Effect.annotateCurrentSpan({
          "operation.success": true,
        }),
      ),
      Effect.tapError(() =>
        Effect.annotateCurrentSpan({
          "operation.success": false,
        }),
      ),
    ),
  );

const readStoredDisplayNameEffect = () =>
  readStoredActorDisplayName().pipe(
    Effect.option,
    Effect.map(Option.getOrUndefined),
  );

function useInterfaceSound(
  path: string,
  volume: number,
  pitchRange: [number, number] = [1, 1],
) {
  const { getChannelVolume } = useAudioSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mixedVolume = volume * getChannelVolume("soundEffects");

  useEffect(() => {
    const audio = new Audio(path);
    audio.preload = "auto";
    audio.volume = mixedVolume;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [mixedVolume, path]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = mixedVolume;
  }, [mixedVolume]);

  return () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.currentTime = 0;
    audio.playbackRate =
      pitchRange[0] + Math.random() * (pitchRange[1] - pitchRange[0]);
    void audio.play().catch(() => undefined);
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function App() {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/play") {
    const searchParams = new URLSearchParams(window.location.search);

    if (searchParams.get("scene") === "models") {
      return <DeveloperModelsApp />;
    }

    return <WorldApp />;
  }

  return <HomeApp />;
}

function DeveloperModelsApp() {
  const playHoverSound = useInterfaceSound(
    "/kits/sounds/select_003.ogg",
    0.088,
    [0.95, 1.05],
  );
  const playClickSound = useInterfaceSound("/kits/sounds/click_001.ogg", 0.35);

  const handleReturnToTitle = () => {
    playClickSound();
    window.location.assign("/");
  };

  return (
    <>
      <Suspense
        fallback={<div className="stage stage-loading">Loading models...</div>}
      >
        <Game />
      </Suspense>

      <div className="developer-scene-toolbar">
        <button
          type="button"
          className="pill-button pill-button-secondary"
          onClick={handleReturnToTitle}
          onPointerEnter={playHoverSound}
          onFocus={playHoverSound}
        >
          Back to title
        </button>
      </div>
    </>
  );
}

function PauseMenuOverlay({
  copy,
  hint,
  children,
  onResume,
  onExit,
  playHoverSound,
  resumeButtonRef,
}: {
  readonly copy: string;
  readonly hint: string;
  readonly children?: ReactNode;
  readonly onResume: () => void;
  readonly onExit: () => void;
  readonly playHoverSound: () => void;
  readonly resumeButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  const { settings, setVolume } = useAudioSettings();

  return (
    <div className="pause-overlay">
      <button
        type="button"
        className="pause-overlay-dismiss"
        aria-label="Resume shift"
        onClick={onResume}
      />
      <div
        className="pause-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
      >
        <p className="pause-kicker">Shift paused</p>
        <h2 id="pause-title" className="pause-title">
          Operations menu
        </h2>
        <div className="pause-divider" aria-hidden="true" />
        <p className="pause-copy">{copy}</p>
        <div className="audio-settings-panel">
          <SliderControl
            label="Overall sound control"
            value={settings.overall}
            onChange={(value) => setVolume("overall", value)}
          />
          <SliderControl
            label="Music control"
            value={settings.music}
            onChange={(value) => setVolume("music", value)}
          />
          <SliderControl
            label="Sound effect control"
            value={settings.soundEffects}
            onChange={(value) => setVolume("soundEffects", value)}
          />
        </div>
        {children}
        <div className="pause-actions">
          <button
            ref={resumeButtonRef}
            type="button"
            className="pill-button pill-button-primary"
            onPointerEnter={playHoverSound}
            onFocus={playHoverSound}
            onClick={onResume}
          >
            <img
              className="pill-button-icon"
              src="/kits/ui/icon_play_dark.svg"
              alt=""
              aria-hidden="true"
            />
            <span>Resume shift</span>
          </button>
          <button
            type="button"
            className="pill-button pill-button-secondary"
            onPointerEnter={playHoverSound}
            onFocus={playHoverSound}
            onClick={onExit}
          >
            <span>Return to title</span>
          </button>
        </div>
        <p className="pause-hint">{hint}</p>
      </div>
    </div>
  );
}

function TitleActionButton({
  children,
  disabled = false,
  onClick,
  onPointerEnter,
  tone = "primary",
  subtitle,
}: {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly onPointerEnter?: () => void;
  readonly tone?: "primary" | "secondary";
  readonly subtitle?: string;
}) {
  const toneClass =
    tone === "primary" ? "pill-button-primary" : "pill-button-secondary";

  return (
    <button
      type="button"
      disabled={disabled}
      className={`pill-button ${toneClass}`}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onFocus={onPointerEnter}
    >
      <span className="title-btn-label">
        <span>{children}</span>
        {subtitle ? (
          <span className="title-btn-subtitle">{subtitle}</span>
        ) : null}
      </span>
    </button>
  );
}

function WorldRemovalAlert({
  disabled,
  message,
  onCancel,
  onConfirm,
  onPointerEnter,
  worldName,
}: {
  readonly disabled: boolean;
  readonly message: string | null;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly onPointerEnter: () => void;
  readonly worldName: string;
}) {
  return (
    <div className="world-remove-alert-overlay">
      <div
        className="world-remove-alert"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="world-remove-alert-title"
        aria-describedby="world-remove-alert-copy"
      >
        <p className="game-panel-label">Remove world?</p>
        <h2 id="world-remove-alert-title" className="world-remove-alert-title">
          {worldName}
        </h2>
        <p id="world-remove-alert-copy" className="game-panel-copy">
          This will permanently remove the world from your saves.
        </p>
        {message ? (
          <p className="game-panel-message game-panel-message-error">
            {message}
          </p>
        ) : null}
        <div className="world-remove-alert-actions">
          <button
            type="button"
            disabled={disabled}
            className="game-btn game-btn-secondary"
            onClick={onCancel}
            onPointerEnter={onPointerEnter}
            onFocus={onPointerEnter}
          >
            Keep world
          </button>
          <button
            type="button"
            disabled={disabled}
            className="game-btn game-btn-danger"
            onClick={onConfirm}
            onPointerEnter={onPointerEnter}
            onFocus={onPointerEnter}
          >
            {disabled ? "Removing..." : "Remove world"}
          </button>
        </div>
      </div>
    </div>
  );
}

const VOSS_INTRO_LINES: readonly VossLine[] = [
  {
    text: "Operator. You have been assigned to extraction site GPY-7, codename Silicon. GeePeeYou thanks you for your continued compliance.",
  },
  {
    text: "Your task is simple. Extract resources. Meet quota. Do not ask questions about the incident.",
  },
  {
    text: "Previous operators lasted an average of... well. That metric has been redacted for morale purposes.",
  },
  {
    text: "Equipment has been pre-deployed. If anything looks broken, that is a feature. Please begin your shift.",
  },
];

const WIP_SIGN_LINES: readonly VossLine[] = [
  {
    text: "Ah. The WIP sign. A monument to optimism.",
    sound: "printer",
  },
  {
    text: "It stands for 'Work In Progress'. Much like your career here.",
    sound: "chime",
  },
  {
    text: "Updates are scheduled. Return dates are not.",
    sound: "dialup",
  },
  {
    text: "GeePeeYou thanks you for your patience. Your patience has been noted and filed.",
    sound: "shutdown",
  },
];

const BUILD_MODE_CURSOR_CLASS = "build-mode";

function WorldApp() {
  const locationSearch = window.location.search;
  const searchParams = new URLSearchParams(locationSearch);
  const isMockWorld = searchParams.get("mock") === "1";
  const selectedWorldId = searchParams.get("worldId");
  const isResumeEntry = searchParams.get("entry") === "resume";

  // Portal entry detection for Vibe Jam 2026 webring
  const isPortalEntry = isPortalHandoff(searchParams);
  const portalParams = useMemo(
    () =>
      Match.value(isPortalEntry).pipe(
        Match.when(true, () =>
          parsePortalParams(new URLSearchParams(locationSearch)),
        ),
        Match.orElse(() => null),
      ),
    [isPortalEntry, locationSearch],
  );

  const [hasStarted, setHasStarted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAwaitingIntro, setIsAwaitingIntro] = useState(false);
  const [activeWorldMenu, setActiveWorldMenu] = useState<Exclude<
    WorldMenuAction,
    "settings"
  > | null>(null);
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);
  const [vossLines, setVossLines] = useState<readonly VossLine[] | null>(null);
  const [portalModal, setPortalModal] = useState<"entry" | "exit" | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<SelectedWorldState>(
    (): SelectedWorldState =>
      Match.value({ isMockWorld, isPortalEntry, selectedWorldId }).pipe(
        Match.when(
          { isMockWorld: true },
          (): SelectedWorldState => ({ _tag: "mock" }),
        ),
        Match.when(
          { selectedWorldId: Match.string },
          ({ selectedWorldId: worldId }): SelectedWorldState => ({
            _tag: "loading",
            worldId,
          }),
        ),
        Match.when(
          { isPortalEntry: true },
          (): SelectedWorldState => ({ _tag: "creating" }),
        ),
        Match.orElse(
          (): SelectedWorldState => ({
            _tag: "error",
            message: "No world was selected from the title screen.",
          }),
        ),
      ),
  );
  const resumeButtonRef = useRef<HTMLButtonElement | null>(null);
  const portalCreatedWorldIdRef = useRef<string | null>(null);
  const selectedWorldPortalParams = Match.value(selectedWorld).pipe(
    Match.when({ _tag: "ready" }, ({ portalParams }) => portalParams),
    Match.orElse(() => undefined),
  );
  const activePortalParams = Option.getOrNull(
    Option.orElse(
      Option.filter(Option.fromNullishOr(portalParams), hasPortalParams),
      () => Option.fromUndefinedOr(selectedWorldPortalParams),
    ),
  );
  const isActivePortalEntry =
    isPortalEntry || selectedWorldPortalParams !== undefined;
  const hasBackPortal = Boolean(activePortalParams?.ref);
  const playHoverSound = useInterfaceSound(
    "/kits/sounds/select_003.ogg",
    0.088,
    [0.95, 1.05],
  );
  const playClickSound = useInterfaceSound("/kits/sounds/click_001.ogg", 0.35);

  useEffect(() => {
    if (!isPortalEntry) {
      return;
    }

    storePortalSession(parsePortalParams(new URLSearchParams(locationSearch)));
  }, [isPortalEntry, locationSearch]);

  useEffect(() => {
    if (isMockWorld) {
      setSelectedWorld({ _tag: "mock" });
      return;
    }

    if (selectedWorldId === null) {
      if (isPortalEntry) {
        return;
      }

      setSelectedWorld({
        _tag: "error",
        message: "No world was selected from the title screen.",
      });
      return;
    }

    if (
      isPortalEntry &&
      portalCreatedWorldIdRef.current !== null &&
      portalCreatedWorldIdRef.current === selectedWorldId
    ) {
      return;
    }

    let cancelled = false;

    const loadSelectedWorld = async () => {
      logWorldLoadEventOnce("world-starts-to-load", "World starts to load");
      setSelectedWorld({ _tag: "loading", worldId: selectedWorldId });

      const loadedWorldResult = await runResult(
        withOperationSpan(
          "web.world.load",
          {
            operation: "world.load",
            "portal.entry": isPortalEntry,
            "world.id": selectedWorldId,
          },
          Effect.gen(function* () {
            const storedDisplayName = yield* readStoredDisplayNameEffect();
            const actorDisplayName = yield* resolveActorDisplayName({
              allowAutoGenerated: !isPortalEntry,
              autoGeneratedUsername: makeRandomUsername(),
              configuredUsername: storedDisplayName,
              defaultUsername: DEFAULT_PORTAL_USERNAME,
              queryUsername: portalParams?.username,
            });
            const response = yield* getWorld({
              actorDisplayName,
              worldId: selectedWorldId,
            });
            const runtimeSnapshot = yield* loadRuntimeSnapshotEffect(
              actorDisplayName,
              response.world.worldId,
            );

            return {
              response,
              runtimeSnapshot,
            };
          }),
        ),
      );

      if (cancelled) {
        return;
      }

      Match.value(loadedWorldResult).pipe(
        Match.when({ _tag: "success" }, ({ value }) => {
          const { response, runtimeSnapshot } = value;
          const loadedPortalParams = response.world.spec?.portal?.queryParams;

          if (loadedPortalParams) {
            storePortalSession(loadedPortalParams);
          }

          writeLastAccessedWorldId(response.world.worldId);
          setSelectedWorld({
            _tag: "ready",
            hostAssetId:
              response.world.spec?.hostAssetId ?? readPreferredAssetId(),
            mode: response.world.mode,
            portalParams: loadedPortalParams,
            runtimeSnapshot,
            worldId: response.world.worldId,
            worldName: response.world.worldName,
          });
        }),
        Match.when({ _tag: "failure" }, ({ error }) => {
          setSelectedWorld({
            _tag: "error",
            message: getErrorMessage(error),
            worldId: selectedWorldId,
          });
        }),
        Match.exhaustive,
      );
    };

    void loadSelectedWorld();

    return () => {
      cancelled = true;
    };
  }, [isMockWorld, isPortalEntry, selectedWorldId, portalParams?.username]);

  // Portal entry: auto-create a solo world for the visitor
  useEffect(() => {
    if (!isPortalEntry || selectedWorld._tag !== "creating") {
      return;
    }

    let cancelled = false;

    const createPortalWorld = async () => {
      const createdWorldResult = await runResult(
        withOperationSpan(
          "web.world.create.portal",
          {
            operation: "world.create.portal",
            "portal.entry": true,
          },
          Effect.gen(function* () {
            const portalSessionId = ensurePortalCreationSessionIdInUrl();
            const storedDisplayName = yield* readStoredDisplayNameEffect();
            const actorDisplayName = yield* resolveActorDisplayName({
              allowAutoGenerated: false,
              autoGeneratedUsername: makeRandomUsername(),
              configuredUsername: storedDisplayName,
              defaultUsername: DEFAULT_PORTAL_USERNAME,
              queryUsername: portalParams?.username,
            });
            const storedDraft = readPortalWorldDraft(portalSessionId);
            const portalWorldDraft =
              storedDraft?.actorDisplayName === actorDisplayName
                ? storedDraft
                : {
                    actorDisplayName,
                    hostAssetId: pickRandomAssetId(),
                    idempotencyKey: crypto.randomUUID(),
                    sessionId: portalSessionId,
                    worldName: makePortalWorldName(
                      actorDisplayName,
                      portalSessionId,
                    ),
                  };

            if (portalWorldDraft !== storedDraft) {
              storePortalWorldDraft(portalWorldDraft);
            }

            const response = yield* createWorld({
              actorDisplayName,
              request: {
                hostAssetId: portalWorldDraft.hostAssetId,
                idempotencyKey: portalWorldDraft.idempotencyKey,
                mode: "solo",
                portal: { queryParams: portalParams ?? {} },
                visibility: "private",
                worldName: portalWorldDraft.worldName,
              },
            });
            const runtimeSnapshot = yield* loadRuntimeSnapshotEffect(
              actorDisplayName,
              response.world.worldId,
            );

            return {
              portalSessionId,
              portalWorldDraft,
              response,
              runtimeSnapshot,
            };
          }),
        ),
      );

      if (cancelled) {
        return;
      }

      Match.value(createdWorldResult).pipe(
        Match.when({ _tag: "success" }, ({ value }) => {
          const { portalSessionId, portalWorldDraft, response, runtimeSnapshot } =
            value;
          const createdPortalParams =
            response.world.spec?.portal?.queryParams ?? portalParams ?? {};

          storePortalSession(createdPortalParams);
          writeLastAccessedWorldId(response.world.worldId);
          portalCreatedWorldIdRef.current = response.world.worldId;
          replacePortalUrlWithWorldId(response.world.worldId);
          clearPortalWorldDraft(portalSessionId);
          setSelectedWorld({
            _tag: "ready",
            hostAssetId:
              response.world.spec?.hostAssetId ?? portalWorldDraft.hostAssetId,
            mode: response.world.mode,
            portalParams: createdPortalParams,
            runtimeSnapshot,
            worldId: response.world.worldId,
            worldName: response.world.worldName,
          });

          void preloadWorldExperience();
        }),
        Match.when({ _tag: "failure" }, ({ error }) => {
          setSelectedWorld({
            _tag: "error",
            message: getErrorMessage(error),
          });
        }),
        Match.exhaustive,
      );
    };

    void createPortalWorld();

    return () => {
      cancelled = true;
    };
  }, [isPortalEntry, selectedWorld._tag, portalParams?.username]);

  useEffect(() => {
    if (!isResumeEntry) {
      return;
    }

    logWorldLoadEventOnce("world-resume-requested", "World resume requested");
    void preloadWorldExperience();
  }, [isResumeEntry]);

  useEffect(() => {
    if (hasStarted) {
      return;
    }

    if (selectedWorld._tag !== "ready" && selectedWorld._tag !== "mock") {
      return;
    }

    logWorldLoadEventOnce("world-route-started", "World route started");
    void preloadWorldExperience();
    startTransition(() => {
      setHasStarted(true);
      setActiveBuildId(null);
      setIsMenuOpen(false);
      setIsAwaitingIntro(true);
      setVossLines(null);
    });
  }, [hasStarted, selectedWorld]);

  const handleResume = () => {
    playClickSound();
    setIsMenuOpen(false);
  };

  const handleWorldMenuSelect = (action: WorldMenuAction) => {
    playClickSound();

    if (action !== "build") {
      setActiveBuildId(null);
    }

    if (action === "settings") {
      setActiveWorldMenu(null);
      setIsMenuOpen((current) => !current);
      return;
    }

    setActiveWorldMenu((current) => (current === action ? null : action));
  };

  const handleReturnToTitle = () => {
    playClickSound();
    window.location.assign("/");
  };

  // Escape key for pause menu (blocked when Voss dialog is open)
  useEffect(() => {
    const appRoot = document.getElementById("app");
    const cursorRoots = [
      document.body,
      document.documentElement,
      appRoot,
    ].filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
    const isBuildModeActive =
      hasStarted &&
      activeBuildId !== null &&
      !isMenuOpen &&
      !vossLines &&
      !isAwaitingIntro &&
      activeWorldMenu === null;

    for (const element of cursorRoots) {
      element.classList.toggle(BUILD_MODE_CURSOR_CLASS, isBuildModeActive);
    }

    return () => {
      for (const element of cursorRoots) {
        element.classList.remove(BUILD_MODE_CURSOR_CLASS);
      }
    };
  }, [
    activeBuildId,
    activeWorldMenu,
    hasStarted,
    isAwaitingIntro,
    isMenuOpen,
    vossLines,
  ]);

  useEffect(() => {
    if (!hasStarted) {
      setIsMenuOpen(false);
      setActiveBuildId(null);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.repeat ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      // Don't open pause menu while Voss is talking
      if (vossLines) return;

      // If a world menu is open (inventory/build/destroy), Escape closes it
      if (activeWorldMenu) {
        event.preventDefault();
        setActiveWorldMenu(null);
        return;
      }

      if (activeBuildId !== null) {
        event.preventDefault();
        setActiveBuildId(null);
        return;
      }

      event.preventDefault();
      setIsMenuOpen((current) => !current);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeBuildId, activeWorldMenu, hasStarted, vossLines]);

  useEffect(() => {
    if (!hasStarted || isMenuOpen || vossLines || isAwaitingIntro) {
      setActiveWorldMenu(null);
      return;
    }

    const actionByKey = {
      i: "inventory",
      b: "build",
      d: "destroy",
    } as const satisfies Record<string, Exclude<WorldMenuAction, "settings">>;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const pressedKey = event.key.toLowerCase() as keyof typeof actionByKey;
      const action = actionByKey[pressedKey];
      if (!action) {
        return;
      }

      event.preventDefault();
      setActiveWorldMenu((current) => (current === action ? null : action));
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasStarted, isAwaitingIntro, isMenuOpen, vossLines]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    resumeButtonRef.current?.focus();
  }, [isMenuOpen]);

  // Listen for voss-dialog events from the game world
  useEffect(() => {
    const handleVossEvent = (e: Event) => {
      const detail = (e as CustomEvent<readonly VossLine[]>).detail;
      if (detail) setVossLines(detail);
    };

    window.addEventListener("voss-dialog", handleVossEvent);
    return () => window.removeEventListener("voss-dialog", handleVossEvent);
  }, []);

  // Listen for building interaction events from the 3D world
  useEffect(() => {
    const handleBuildingInteract = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      Match.value(id).pipe(
        Match.when("wip-sign", () =>
          window.dispatchEvent(
            new CustomEvent("voss-dialog", { detail: WIP_SIGN_LINES }),
          ),
        ),
        Match.when("portal-entry", () => setPortalModal("entry")),
        Match.when("portal-exit", () => setPortalModal("exit")),
        Match.orElse(() => undefined),
      );
    };

    window.addEventListener("building-interact", handleBuildingInteract);
    return () =>
      window.removeEventListener("building-interact", handleBuildingInteract);
  }, []);

  useEffect(() => {
    if (!hasStarted || !isAwaitingIntro) {
      return;
    }

    const handleWorldVisualReady = () => {
      logWorldLoadEventOnce("world-visual-ready", "World visuals ready");
      if (!isResumeEntry) {
        setVossLines(VOSS_INTRO_LINES);
      }
      setIsAwaitingIntro(false);
    };

    window.addEventListener(WORLD_VISUAL_READY_EVENT, handleWorldVisualReady, {
      once: true,
    });

    // Fallback: if the event doesn't fire within 3 seconds, unlock anyway
    // This prevents the character from being stuck if the event races
    const fallbackTimeout = setTimeout(() => {
      logWorldLoadEventOnce(
        "world-visual-ready-timeout",
        "World visual ready timeout fallback",
      );
      setIsAwaitingIntro(false);
    }, 3000);

    return () => {
      clearTimeout(fallbackTimeout);
      window.removeEventListener(
        WORLD_VISUAL_READY_EVENT,
        handleWorldVisualReady,
      );
    };
  }, [hasStarted, isAwaitingIntro, isResumeEntry]);

  const activeAssetId = Match.value(selectedWorld).pipe(
    Match.when({ _tag: "ready" }, ({ hostAssetId }) => hostAssetId),
    Match.orElse(() => readPreferredAssetId()),
  );

  return (
    <>
      <Suspense
        fallback={<div className="stage stage-loading">Loading world...</div>}
      >
        {hasStarted ? (
          <World
            assetId={activeAssetId}
            isPaused={
              isMenuOpen || !!vossLines || !!portalModal || isAwaitingIntro
            }
            isPortalEntry={isActivePortalEntry}
            hasBackPortal={hasBackPortal}
            portalParams={activePortalParams}
            runtimeSnapshot={
              selectedWorld._tag === "ready"
                ? selectedWorld.runtimeSnapshot
                : undefined
            }
          />
        ) : (
          <div className="stage stage-loading">
            {selectedWorld._tag === "error"
              ? `World unavailable: ${selectedWorld.message}`
              : "Loading world..."}
          </div>
        )}
      </Suspense>

      {hasStarted && isMenuOpen && !vossLines ? (
        <PauseMenuOverlay
          copy="Movement and camera controls are paused. Resume the world or return to the title screen."
          hint="Press Esc to resume"
          onResume={handleResume}
          onExit={handleReturnToTitle}
          playHoverSound={playHoverSound}
          resumeButtonRef={resumeButtonRef}
        />
      ) : null}

      {hasStarted && vossLines ? (
        <VossDialog lines={vossLines} onComplete={() => setVossLines(null)} />
      ) : null}

      {hasStarted && portalModal ? (
        <PortalModal
          portalType={portalModal}
          onEnter={() => {
            const params = Option.getOrNull(
              Option.orElse(Option.fromNullishOr(activePortalParams), () =>
                Option.fromNullishOr(readPortalSession()),
              ),
            );
            Match.value(portalModal).pipe(
              Match.when("exit", () => redirectToPortal(params)),
              Match.when("entry", () => redirectBackToRef(params)),
              Match.exhaustive,
            );
          }}
          onClose={() => setPortalModal(null)}
        />
      ) : null}

      {hasStarted && !isMenuOpen && !vossLines && !isAwaitingIntro ? (
        <WorldMenuHud
          activeAction={activeWorldMenu}
          onActionSelect={handleWorldMenuSelect}
          onActionHover={playHoverSound}
        />
      ) : null}

      {hasStarted && activeWorldMenu === "inventory" ? (
        <InventoryModal onClose={() => setActiveWorldMenu(null)} />
      ) : null}

      {hasStarted && activeWorldMenu === "build" ? (
        <BuildMenu
          activeBuildId={activeBuildId}
          onBuildSelect={setActiveBuildId}
          onClose={() => setActiveWorldMenu(null)}
        />
      ) : null}

      {hasStarted && !isMenuOpen && !vossLines && !isAwaitingIntro ? (
        <ActionBar />
      ) : null}

      {hasStarted ? <Chatbox characterTag={activeAssetId} /> : null}
    </>
  );
}

function HomeApp() {
  const [seedUsername] = useState(makeRandomUsername);
  const homeLocationSearch = window.location.search;
  const isHomePortalEntry = useMemo(
    () => isPortalHandoff(new URLSearchParams(homeLocationSearch)),
    [homeLocationSearch],
  );
  const [_apiStatus, setApiStatus] = useState<ApiStatus>({
    _tag: "loading",
  });
  const [activePanel, setActivePanel] = useState<HomePanel>("root");
  const [preferredUsername, setPreferredUsername] = useState(seedUsername);
  const [settingsUsername, setSettingsUsername] = useState(seedUsername);
  const [newWorldDraft, setNewWorldDraft] = useState<NewWorldDraft>(() =>
    makeNewWorldDraft(seedUsername, readPreferredAssetId()),
  );
  const [worlds, setWorlds] = useState<readonly WorldSummary[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemovingWorld, setIsRemovingWorld] = useState(false);
  const [pendingWorldRemoval, setPendingWorldRemoval] =
    useState<PendingWorldRemoval | null>(null);
  const [panelMessage, setPanelMessage] = useState<string | null>(null);
  const [removeWorldMessage, setRemoveWorldMessage] = useState<string | null>(
    null,
  );
  const playHoverSound = useInterfaceSound(
    "/kits/sounds/select_003.ogg",
    0.088,
    [0.95, 1.05],
  );
  const playClickSound = useInterfaceSound("/kits/sounds/click_001.ogg", 0.35);

  const loadWorldDirectory = useCallback(async (actorDisplayName: string) => {
    setIsRefreshing(true);

    const directoryResult = await runResult(listOwnWorlds({ actorDisplayName }));

    Match.value(directoryResult).pipe(
      Match.when({ _tag: "success" }, ({ value: response }) => {
        setWorlds(response.worlds);
        setApiStatus({
          _tag: "ready",
          message:
            response.worlds.length === 0
              ? "World registry online"
              : response.worlds.length === 1
                ? "1 world indexed"
                : `${response.worlds.length} worlds indexed`,
        });
      }),
      Match.when({ _tag: "failure" }, ({ error }) => {
        setWorlds([]);
        setApiStatus({
          _tag: "error",
          message: getErrorMessage(error),
        });
      }),
      Match.exhaustive,
    );

    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrapHome = async () => {
      const fallbackUsername = seedUsername;
      const actorDisplayName = await runPromiseEffect(
        withOperationSpan(
          "web.home.bootstrap",
          {
            operation: "home.bootstrap",
            "portal.entry": isHomePortalEntry,
          },
          Effect.gen(function* () {
            const [storedDisplayName, portalQueryUsername] = yield* Effect.all(
              [
                readStoredDisplayNameEffect(),
                readPortalQueryUsername(homeLocationSearch),
              ],
              { concurrency: "unbounded" },
            );
            return yield* resolveActorDisplayName({
              allowAutoGenerated: !isHomePortalEntry,
              autoGeneratedUsername: fallbackUsername,
              configuredUsername: storedDisplayName,
              defaultUsername: DEFAULT_PORTAL_USERNAME,
              queryUsername: portalQueryUsername,
            });
          }),
        ),
      );

      if (cancelled) {
        return;
      }

      setPreferredUsername(actorDisplayName);
      setSettingsUsername(actorDisplayName);
      setNewWorldDraft(makeNewWorldDraft(actorDisplayName, readPreferredAssetId()));
      await loadWorldDirectory(actorDisplayName);
    };

    void bootstrapHome();

    return () => {
      cancelled = true;
    };
  }, [seedUsername, loadWorldDirectory, isHomePortalEntry, homeLocationSearch]);

  // Dispatch character selection to the 3D scene for the arrow indicator
  useEffect(() => {
    const selectedAsset =
      activePanel === "new-world"
        ? assetChoices.find((a) => a.assetId === newWorldDraft.hostAssetId)
        : null;

    window.dispatchEvent(
      new CustomEvent(CHARACTER_SELECT_EVENT, {
        detail: selectedAsset?.characterName ?? null,
      }),
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent(CHARACTER_SELECT_EVENT, { detail: null }),
      );
    };
  }, [activePanel, newWorldDraft.hostAssetId]);

  const continueWorld = resolveContinueWorld(worlds, readLastAccessedWorldId());

  const handleOpenRoot = () => {
    playClickSound();
    setPanelMessage(null);
    setActivePanel("root");
  };

  const handleOpenNewWorld = () => {
    playClickSound();
    setPanelMessage(null);
    setNewWorldDraft(
      makeNewWorldDraft(preferredUsername, readPreferredAssetId()),
    );
    setActivePanel("new-world");
  };

  const handleOpenLoadWorld = () => {
    playClickSound();
    setPanelMessage(null);
    setActivePanel("load-world");
  };

  const handleOpenSettings = () => {
    playClickSound();
    setPanelMessage(null);
    setSettingsUsername(preferredUsername);
    setActivePanel("settings");
  };

  const handleOpenDeveloper = () => {
    playClickSound();
    setPanelMessage(null);
    setActivePanel("developer");
  };

  const handleContinue = () => {
    if (!continueWorld) {
      return;
    }

    playClickSound();
    goToWorld(continueWorld.worldId, { entry: "resume" });
  };

  const handleLaunchWorld = (worldId: string) => {
    playClickSound();
    goToWorld(worldId, { entry: "resume" });
  };

  const handleRequestRemoveWorld = (world: WorldSummary) => {
    playClickSound();
    setPanelMessage(null);
    setRemoveWorldMessage(null);
    setPendingWorldRemoval({
      worldId: world.worldId,
      worldName: world.worldName,
    });
  };

  const handleCancelRemoveWorld = () => {
    playClickSound();
    setPendingWorldRemoval(null);
    setRemoveWorldMessage(null);
  };

  const handleConfirmRemoveWorld = async () => {
    const world = pendingWorldRemoval;

    if (world === null) {
      return;
    }

    playClickSound();
    setIsRemovingWorld(true);
    setRemoveWorldMessage(null);
    setPanelMessage(null);

    const deleteResult = await runResult(
      deleteWorld({
        actorDisplayName: preferredUsername,
        worldId: world.worldId,
      }),
    );

    await Match.value(deleteResult).pipe(
      Match.when({ _tag: "success" }, async () => {
        if (readLastAccessedWorldId() === world.worldId) {
          clearLastAccessedWorldId();
        }

        await loadWorldDirectory(preferredUsername);
        setPendingWorldRemoval(null);
        setPanelMessage(`${world.worldName} removed.`);
      }),
      Match.when({ _tag: "failure" }, ({ error }) => {
        setRemoveWorldMessage(getErrorMessage(error));
      }),
      Match.exhaustive,
    );

    setIsRemovingWorld(false);
  };

  const handleLaunchMockWorld = () => {
    playClickSound();
    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = "/play";
    nextUrl.search = "?mock=1";
    window.location.assign(nextUrl.toString());
  };

  const handleLaunchModelViewer = () => {
    playClickSound();
    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = "/play";
    nextUrl.search = "";
    nextUrl.searchParams.set("scene", "models");
    window.location.assign(nextUrl.toString());
  };

  const isDevEnvironment =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  const handleCreateWorld = async () => {
    const username = newWorldDraft.username.trim();
    const worldName = newWorldDraft.worldName.trim();

    if (username.length === 0) {
      setPanelMessage("Username cannot be empty.");
      return;
    }

    if (worldName.length === 0) {
      setPanelMessage("World name cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    setPanelMessage(null);

    const createResult = await runResult(
      withOperationSpan(
        "web.world.create",
        {
          operation: "world.create",
          "world.mode": newWorldDraft.mode,
        },
        Effect.gen(function* () {
          yield* getOrCreateActorCredentials({ displayName: username });

          return yield* createWorld({
            actorDisplayName: username,
            request: {
              hostAssetId: newWorldDraft.hostAssetId,
              idempotencyKey: crypto.randomUUID(),
              mode: newWorldDraft.mode,
              visibility: newWorldDraft.visibility,
              worldName,
            },
          });
        }),
      ),
    );

    Match.value(createResult).pipe(
      Match.when({ _tag: "success" }, ({ value: response }) => {
        setPreferredUsername(username);
        setSettingsUsername(username);
        writePreferredAssetId(newWorldDraft.hostAssetId);

        goToWorld(response.world.worldId);
      }),
      Match.when({ _tag: "failure" }, ({ error }) => {
        setPanelMessage(getErrorMessage(error));
      }),
      Match.exhaustive,
    );

    setIsSubmitting(false);
  };

  const handleSaveSettings = async () => {
    const username = settingsUsername.trim();

    if (username.length === 0) {
      setPanelMessage("Username cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    setPanelMessage(null);

    const saveResult = await runResult(
      withOperationSpan(
        "web.settings.save",
        {
          operation: "settings.save",
        },
        getOrCreateActorCredentials({ displayName: username }),
      ),
    );

    await Match.value(saveResult).pipe(
      Match.when({ _tag: "success" }, async () => {
        setPreferredUsername(username);
        setSettingsUsername(username);
        setNewWorldDraft((current) => ({
          ...current,
          username,
        }));
        await loadWorldDirectory(username);
        setPanelMessage("Username updated.");
        setActivePanel("root");
      }),
      Match.when({ _tag: "failure" }, ({ error }) => {
        setPanelMessage(getErrorMessage(error));
      }),
      Match.exhaustive,
    );

    setIsSubmitting(false);
  };

  return (
    <>
      <Suspense
        fallback={<div className="stage stage-loading">Loading...</div>}
      >
        <StartScreenScene />
      </Suspense>

      <div className="title-overlay">
        <RefactoryLogo className="game-logo" />
      </div>

      {/* ── Root menu: floating buttons, no card ── */}
      {activePanel === "root" ? (
        <nav className="title-menu">
          <TitleActionButton
            disabled={continueWorld === undefined || isRefreshing}
            onClick={handleContinue}
            onPointerEnter={playHoverSound}
            subtitle={continueWorld ? continueWorld.worldName : undefined}
          >
            Continue
          </TitleActionButton>
          <TitleActionButton
            disabled={isSubmitting}
            onClick={handleOpenNewWorld}
            onPointerEnter={playHoverSound}
          >
            New Game
          </TitleActionButton>
          <TitleActionButton
            disabled={worlds.length === 0 || isRefreshing}
            onClick={handleOpenLoadWorld}
            onPointerEnter={playHoverSound}
            tone="secondary"
          >
            Load Game
          </TitleActionButton>
          <TitleActionButton
            disabled={isSubmitting}
            onClick={handleOpenSettings}
            onPointerEnter={playHoverSound}
            tone="secondary"
          >
            Settings
          </TitleActionButton>
          {isDevEnvironment ? (
            <TitleActionButton
              disabled={isSubmitting}
              onClick={handleOpenDeveloper}
              onPointerEnter={playHoverSound}
              tone="secondary"
            >
              Developer
            </TitleActionButton>
          ) : null}
        </nav>
      ) : null}

      {/* ── Sub-panels: warm parchment card ── */}
      {activePanel !== "root" ? (
        <div className="game-panel-shell">
          <div className="game-panel">
            {/* ── New Game panel ── */}
            {activePanel === "new-world" ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="game-panel-action"
                    onClick={handleOpenRoot}
                  >
                    Back
                  </button>
                </div>

                {/* Character selection — text cards, arrow in 3D scene */}
                <div className="flex flex-col gap-1.5">
                  <p className="game-panel-label">Choose your operator</p>
                  <div className="character-picker-grid">
                    {assetChoices.map((asset) => (
                      <button
                        key={asset.assetId}
                        type="button"
                        className={`character-card ${
                          newWorldDraft.hostAssetId === asset.assetId
                            ? "is-selected"
                            : ""
                        }`}
                        onClick={() => {
                          playClickSound();
                          setNewWorldDraft((current) => ({
                            ...current,
                            hostAssetId: asset.assetId,
                          }));
                        }}
                        onPointerEnter={playHoverSound}
                      >
                        <span className="character-card-name">
                          {asset.shortName}
                        </span>
                        <span className="character-card-flavor">
                          {asset.worldCreationFlavor}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* World name */}
                <div className="flex flex-col gap-2">
                  <p className="game-panel-label">World name</p>
                  <div className="flex gap-2">
                    <input
                      className="game-panel-input min-w-0 flex-1"
                      value={newWorldDraft.worldName}
                      onChange={(event) =>
                        setNewWorldDraft((current) => ({
                          ...current,
                          worldName: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="game-panel-action"
                      onClick={() =>
                        setNewWorldDraft((current) => ({
                          ...current,
                          worldName: makeRandomWorldName(),
                        }))
                      }
                    >
                      Reroll
                    </button>
                  </div>
                </div>

                {/* Playing as */}
                <div className="flex flex-col gap-2">
                  <p className="game-panel-label">Playing as</p>
                  <input
                    className="game-panel-input"
                    value={newWorldDraft.username}
                    onChange={(event) =>
                      setNewWorldDraft((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                  />
                </div>

                {/* Game mode */}
                <div className="flex flex-col gap-2">
                  <p className="game-panel-label">Game mode</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["solo", "multiplayer"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`game-panel-toggle ${
                          newWorldDraft.mode === mode ? "is-selected" : ""
                        }`}
                        onClick={() => {
                          playClickSound();
                          setNewWorldDraft((current) => ({
                            ...current,
                            mode,
                            visibility:
                              mode === "solo" ? "private" : current.visibility,
                          }));
                        }}
                        onPointerEnter={playHoverSound}
                      >
                        {mode === "solo" ? "Solo" : "Multiplayer"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visibility — multiplayer only */}
                {newWorldDraft.mode === "multiplayer" ? (
                  <div className="flex flex-col gap-2">
                    <p className="game-panel-label">Who can join?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(["private", "public"] as const).map((visibility) => (
                        <button
                          key={visibility}
                          type="button"
                          className={`game-panel-toggle ${
                            newWorldDraft.visibility === visibility
                              ? "is-selected"
                              : ""
                          }`}
                          onClick={() => {
                            playClickSound();
                            setNewWorldDraft((current) => ({
                              ...current,
                              visibility,
                            }));
                          }}
                          onPointerEnter={playHoverSound}
                        >
                          {visibility === "private"
                            ? "Friends only"
                            : "Everyone"}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {panelMessage ? (
                  <p className="game-panel-message game-panel-message-error">
                    {panelMessage}
                  </p>
                ) : null}

                <div className="flex flex-col gap-2 pt-0.5">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    className="game-btn game-btn-primary"
                    onClick={() => {
                      playClickSound();
                      void handleCreateWorld();
                    }}
                    onPointerEnter={playHoverSound}
                  >
                    {isSubmitting ? "Preparing world..." : "Start Adventure"}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    className="game-btn game-btn-secondary"
                    onClick={handleOpenRoot}
                    onPointerEnter={playHoverSound}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {/* ── Load Game panel ── */}
            {activePanel === "load-world" ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="game-panel-action"
                    onClick={handleOpenRoot}
                  >
                    Back
                  </button>
                </div>

                <div className="flex max-h-[22rem] flex-col gap-2 overflow-y-auto pr-1">
                  {worlds.length === 0 ? (
                    <p className="game-panel-copy py-4">
                      No saved games yet. Start a new adventure!
                    </p>
                  ) : (
                    worlds.map((world) => {
                      const isReady = world.worldStatus === "ready";
                      const isLastAccessed =
                        world.worldId === readLastAccessedWorldId();

                      return (
                        <div key={world.worldId} className="world-list-item">
                          <button
                            type="button"
                            disabled={!isReady || isRemovingWorld}
                            className="world-list-card"
                            onClick={() => handleLaunchWorld(world.worldId)}
                            onPointerEnter={playHoverSound}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="world-list-card-name">
                                  {world.worldName}
                                </p>
                                <p className="world-list-card-meta">
                                  {world.mode} · {world.visibility}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {isLastAccessed ? (
                                  <span className="world-list-badge world-list-badge-recent">
                                    Last played
                                  </span>
                                ) : null}
                                <span
                                  className={`world-list-badge ${
                                    isReady
                                      ? "world-list-badge-ready"
                                      : "world-list-badge-building"
                                  }`}
                                >
                                  {world.worldStatus.replaceAll("_", " ")}
                                </span>
                              </div>
                            </div>
                            <p
                              className="world-list-card-meta"
                              style={{ marginTop: "0.5rem" }}
                            >
                              Updated {formatWorldTimestamp(world.updatedAt)}
                            </p>
                          </button>
                          <button
                            type="button"
                            disabled={isRemovingWorld}
                            className="world-list-remove-action"
                            onClick={() => handleRequestRemoveWorld(world)}
                            onPointerEnter={playHoverSound}
                            onFocus={playHoverSound}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  type="button"
                  className="game-btn game-btn-secondary"
                  onClick={handleOpenRoot}
                  onPointerEnter={playHoverSound}
                >
                  Back to menu
                </button>
              </div>
            ) : null}

            {/* ── Settings panel ── */}
            {activePanel === "settings" ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="game-panel-action"
                    onClick={handleOpenRoot}
                  >
                    Back
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="game-panel-label">Your name</p>
                  <div className="flex gap-2">
                    <input
                      className="game-panel-input min-w-0 flex-1"
                      value={settingsUsername}
                      onChange={(event) =>
                        setSettingsUsername(event.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="game-panel-action"
                      onClick={() => setSettingsUsername(makeRandomUsername())}
                    >
                      Reroll
                    </button>
                  </div>
                </div>

                <p className="game-panel-copy">
                  This is how other players see you.
                </p>

                {panelMessage ? (
                  <p
                    className={`game-panel-message ${
                      panelMessage === "Username updated."
                        ? "game-panel-message-success"
                        : "game-panel-message-error"
                    }`}
                  >
                    {panelMessage}
                  </p>
                ) : null}

                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    className="game-btn game-btn-primary"
                    onClick={() => {
                      playClickSound();
                      void handleSaveSettings();
                    }}
                    onPointerEnter={playHoverSound}
                  >
                    {isSubmitting ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    className="game-btn game-btn-secondary"
                    onClick={handleOpenRoot}
                    onPointerEnter={playHoverSound}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {/* ── Developer panel ── */}
            {activePanel === "developer" ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="game-panel-action"
                    onClick={handleOpenRoot}
                  >
                    Back
                  </button>
                </div>

                <p className="game-panel-copy">
                  Developer-only scene entry points.
                </p>

                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    className="game-btn game-btn-secondary"
                    onClick={handleLaunchMockWorld}
                    onPointerEnter={playHoverSound}
                  >
                    Mocked world
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    className="game-btn game-btn-secondary"
                    onClick={handleLaunchModelViewer}
                    onPointerEnter={playHoverSound}
                  >
                    Models
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {pendingWorldRemoval ? (
        <WorldRemovalAlert
          disabled={isRemovingWorld}
          message={removeWorldMessage}
          onCancel={handleCancelRemoveWorld}
          onConfirm={() => {
            void handleConfirmRemoveWorld();
          }}
          onPointerEnter={playHoverSound}
          worldName={pendingWorldRemoval.worldName}
        />
      ) : null}
    </>
  );
}

const app = document.getElementById("app");

if (!(app instanceof HTMLDivElement)) {
  throw new Error("Missing app container");
}

createRoot(app).render(
  <StrictMode>
    <AudioSettingsProvider>
      <AmbientMusicPlayer />
      <App />
    </AudioSettingsProvider>
  </StrictMode>,
);
