import {
  lazy,
  type ReactNode,
  type RefObject,
  StrictMode,
  Suspense,
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import type {
  AssetId,
  WorldMode,
  WorldSummary,
  WorldVisibility,
} from "@refactory/contracts/worlds";
import { Effect } from "effect";
import "./styles.css";
import { AmbientMusicPlayer } from "./AmbientMusicPlayer";
import {
  getOrCreateActorCredentials,
  readStoredActorDisplayName,
} from "./api/actorAuth";
import { createWorld, getWorld, listOwnWorlds } from "./api/worldClient";
import { AudioSettingsProvider, useAudioSettings } from "./audio-settings";
import { DEFAULT_ASSET_ID } from "./characterAssets";
import { ActionBar } from "./components/ActionBar";
import { BuildMenu } from "./components/BuildMenu";
import { RefactoryLogo } from "./components/RefactoryLogo";
import type { CharacterName } from "./models/Character";
import { CHARACTER_SELECT_EVENT } from "./scenes/StartScreenCast";
import { Chatbox } from "./components/Chatbox";
import { InventoryModal } from "./components/InventoryModal";
import { SliderControl } from "./components/SliderControl";
import { VossDialog, type VossLine } from "./components/VossDialog";
import { WorldMenuHud, type WorldMenuAction } from "./components/WorldMenuHud";
import { preloadWorldExperience } from "./preload";
import { StartScreenScene } from "./scenes/StartScreenScene";
import { logWorldLoadEvent, logWorldLoadEventOnce } from "./world/worldLoadLog";

const World = lazy(() => import("./World").then((m) => ({ default: m.World })));
const Game = lazy(() => import("./Game").then((m) => ({ default: m.Game })));
const WORLD_VISUAL_READY_EVENT = "world-visual-ready";
const START_SCREEN_VISUAL_READY_EVENT = "start-screen-visual-ready";

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

type SelectedWorldState =
  | { readonly _tag: "mock" }
  | { readonly _tag: "loading"; readonly worldId: string }
  | {
      readonly _tag: "ready";
      readonly hostAssetId: AssetId;
      readonly mode: WorldMode;
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

const pickRandom = <T,>(options: readonly T[]): T =>
  options[Math.floor(Math.random() * options.length)] ?? options[0]!;

const makeRandomUsername = () =>
  `${pickRandom(usernamePrefixes)} ${pickRandom(usernameSuffixes)}-${Math.floor(
    10 + Math.random() * 90,
  )}`;

const makeRandomWorldName = () =>
  `${pickRandom(worldNamePrefixes)} ${pickRandom(worldNameSuffixes)} ${Math.floor(
    10 + Math.random() * 90,
  )}`;

const safeStorageGet = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
};

const readLastAccessedWorldId = () =>
  safeStorageGet(lastAccessedWorldStorageKey);

const writeLastAccessedWorldId = (worldId: string) =>
  safeStorageSet(lastAccessedWorldStorageKey, worldId);

const readPreferredAssetId = (): AssetId => {
  const stored = safeStorageGet(preferredAssetStorageKey);

  switch (stored) {
    case "BAR-001":
    case "FLA-002":
    case "FRO-003":
    case "RPA-004":
      return stored;
    default:
      return DEFAULT_ASSET_ID;
  }
};

const writePreferredAssetId = (assetId: AssetId) =>
  safeStorageSet(preferredAssetStorageKey, assetId);

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
    readonly autostart?: boolean;
    readonly entry?: "resume";
  },
) => {
  writeLastAccessedWorldId(worldId);
  const nextUrl = new URL(window.location.href);
  nextUrl.pathname = "/world";
  nextUrl.search = "";
  nextUrl.searchParams.set("worldId", worldId);
  if (options?.autostart) {
    nextUrl.searchParams.set("autostart", "1");
  }
  if (options?.entry) {
    nextUrl.searchParams.set("entry", options.entry);
  }
  window.location.assign(nextUrl.toString());
};

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

  if (pathname === "/world" || pathname === "/worlds") {
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

function StartScreenOverlay({
  onPlay,
  onPlayIntent,
  buttonLabel = "Begin shift",
  caption = "BAR-001 · FLA-002 · FRO-003 · RPA-004",
  copy,
  disabled = false,
  playHoverSound,
}: {
  readonly onPlay: () => void;
  readonly onPlayIntent?: () => void;
  readonly buttonLabel?: string;
  readonly caption?: string;
  readonly copy?: string;
  readonly disabled?: boolean;
  readonly playHoverSound: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-[clamp(1.5rem,4vh,3rem)]">
      <div className="pointer-events-auto flex max-w-[28rem] flex-col items-center gap-3 rounded-[1.8rem] border border-white/22 bg-white/10 px-4 py-4 text-center shadow-[0_18px_60px_rgba(8,32,43,0.14)] backdrop-blur-md">
        {copy ? (
          <p className="max-w-[24rem] text-sm font-semibold leading-6 text-white/84 drop-shadow-[0_1px_3px_rgba(0,0,0,0.24)]">
            {copy}
          </p>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          className="pill-button pill-button-secondary min-w-[16rem]"
          onPointerEnter={() => {
            onPlayIntent?.();
            playHoverSound();
          }}
          onFocus={() => {
            onPlayIntent?.();
            playHoverSound();
          }}
          onPointerDown={() => {
            onPlayIntent?.();
          }}
          onClick={onPlay}
        >
          <img
            className="pill-button-icon"
            src="/kits/ui/icon_play_dark.svg"
            alt=""
            aria-hidden="true"
          />
          <span>{buttonLabel}</span>
        </button>
        <p className="text-xs font-bold tracking-[0.16em] text-white/70 drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
          {caption}
        </p>
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

const BUILD_MODE_CURSOR_CLASS = "build-mode";

function WorldApp() {
  const searchParams = new URLSearchParams(window.location.search);
  const isMockWorld = searchParams.get("mock") === "1";
  const selectedWorldId = searchParams.get("worldId");
  const isResumeEntry = searchParams.get("entry") === "resume";
  const shouldAutoStart = searchParams.get("autostart") === "1" || isMockWorld;
  const [hasStarted, setHasStarted] = useState(isMockWorld || isResumeEntry);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAwaitingIntro, setIsAwaitingIntro] = useState(
    isMockWorld || isResumeEntry,
  );
  const [isStartScreenReady, setIsStartScreenReady] = useState(false);
  const [activeWorldMenu, setActiveWorldMenu] = useState<Exclude<
    WorldMenuAction,
    "settings"
  > | null>(null);
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);
  const [vossLines, setVossLines] = useState<readonly VossLine[] | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<SelectedWorldState>(() =>
    isMockWorld
      ? { _tag: "mock" }
      : selectedWorldId === null
        ? {
            _tag: "error",
            message: "No world was selected from the title screen.",
          }
        : {
            _tag: "loading",
            worldId: selectedWorldId,
          },
  );
  const resumeButtonRef = useRef<HTMLButtonElement | null>(null);
  const playHoverSound = useInterfaceSound(
    "/kits/sounds/select_003.ogg",
    0.088,
    [0.95, 1.05],
  );
  const playClickSound = useInterfaceSound("/kits/sounds/click_001.ogg", 0.35);

  useEffect(() => {
    if (hasStarted) {
      return;
    }

    logWorldLoadEventOnce(
      "start-page-starts-to-load",
      "Start page starts to load",
    );
  }, [hasStarted]);

  useEffect(() => {
    if (hasStarted) {
      setIsStartScreenReady(false);
      return;
    }

    const handleStartScreenReady = () => {
      setIsStartScreenReady(true);
    };

    window.addEventListener(
      START_SCREEN_VISUAL_READY_EVENT,
      handleStartScreenReady,
      {
        once: true,
      },
    );

    return () => {
      window.removeEventListener(
        START_SCREEN_VISUAL_READY_EVENT,
        handleStartScreenReady,
      );
    };
  }, [hasStarted]);

  useEffect(() => {
    if (isMockWorld) {
      setSelectedWorld({ _tag: "mock" });
      return;
    }

    if (selectedWorldId === null) {
      setSelectedWorld({
        _tag: "error",
        message: "No world was selected from the title screen.",
      });
      return;
    }

    let cancelled = false;

    const loadSelectedWorld = async () => {
      setSelectedWorld({ _tag: "loading", worldId: selectedWorldId });

      try {
        const storedDisplayName = await Effect.runPromise(
          readStoredActorDisplayName(),
        );
        const actorDisplayName = storedDisplayName ?? makeRandomUsername();
        const response = await Effect.runPromise(
          getWorld({
            actorDisplayName,
            worldId: selectedWorldId,
          }),
        );

        if (cancelled) {
          return;
        }

        writeLastAccessedWorldId(response.world.worldId);
        setSelectedWorld({
          _tag: "ready",
          hostAssetId:
            response.world.spec?.hostAssetId ?? readPreferredAssetId(),
          mode: response.world.mode,
          worldId: response.world.worldId,
          worldName: response.world.worldName,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setSelectedWorld({
          _tag: "error",
          message: getErrorMessage(error),
          worldId: selectedWorldId,
        });
      }
    };

    void loadSelectedWorld();

    return () => {
      cancelled = true;
    };
  }, [isMockWorld, selectedWorldId]);

  const handlePlayIntent = () => {
    void preloadWorldExperience();
  };

  useEffect(() => {
    if (!isResumeEntry) {
      return;
    }

    logWorldLoadEventOnce("world-resume-requested", "World resume requested");
    void preloadWorldExperience();
  }, [isResumeEntry]);

  const enterWorld = (withClickSound: boolean) => {
    if (selectedWorld._tag !== "ready" && selectedWorld._tag !== "mock") {
      return;
    }

    logWorldLoadEvent(
      withClickSound
        ? "User clicked on start shift"
        : "World autostart requested",
    );
    void preloadWorldExperience();
    if (withClickSound) {
      playClickSound();
    }
    startTransition(() => {
      setHasStarted(true);
      setActiveBuildId(null);
      setIsMenuOpen(false);
      setIsAwaitingIntro(true);
      setVossLines(null);
    });
  };

  const handlePlay = () => {
    enterWorld(true);
  };

  useEffect(() => {
    if (!shouldAutoStart || hasStarted) {
      return;
    }

    enterWorld(false);
  }, [hasStarted, selectedWorld, shouldAutoStart]);

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
    const cursorRoots = [document.body, document.documentElement, appRoot].filter(
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

  useEffect(() => {
    if (hasStarted || !isStartScreenReady) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let idleId: number | undefined;

    timeoutId = setTimeout(() => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(
          () => {
            void preloadWorldExperience();
          },
          { timeout: 150 },
        );
        return;
      }

      void preloadWorldExperience();
    }, 900);

    return () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [hasStarted, isStartScreenReady]);

  useEffect(() => {
    if (!hasStarted || !isAwaitingIntro) {
      return;
    }

    const handleWorldVisualReady = () => {
      if (!isResumeEntry) {
        setVossLines(VOSS_INTRO_LINES);
      }
      setIsAwaitingIntro(false);
    };

    window.addEventListener(WORLD_VISUAL_READY_EVENT, handleWorldVisualReady, {
      once: true,
    });

    return () => {
      window.removeEventListener(
        WORLD_VISUAL_READY_EVENT,
        handleWorldVisualReady,
      );
    };
  }, [hasStarted, isAwaitingIntro, isResumeEntry]);

  const activeAssetId =
    selectedWorld._tag === "ready"
      ? selectedWorld.hostAssetId
      : readPreferredAssetId();

  return (
    <>
      <Suspense
        fallback={
          hasStarted ? (
            <div className="stage stage-loading">Loading world...</div>
          ) : null
        }
      >
        {hasStarted ? (
          <World
            assetId={activeAssetId}
            isPaused={isMenuOpen || !!vossLines || isAwaitingIntro}
          />
        ) : (
          <StartScreenScene />
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

      {hasStarted ? null : (
        <StartScreenOverlay
          buttonLabel={
            selectedWorld._tag === "mock"
              ? "Begin mocked shift"
              : selectedWorld._tag === "ready"
                ? "Begin shift"
                : "World unavailable"
          }
          caption={
            selectedWorld._tag === "mock"
              ? "Mocked world · backend bypass"
              : selectedWorld._tag === "ready"
                ? `${selectedWorld.worldName} · ${selectedWorld.mode.toUpperCase()}`
                : "Return to title to choose or create a world"
          }
          copy={
            selectedWorld._tag === "mock"
              ? "Mocked world fallback enabled. This keeps the old scene-testing path available while the real world bootstrap is being wired up."
              : selectedWorld._tag === "ready"
                ? `Connected to ${selectedWorld.worldName}. Control-plane selection is backed by the world registry; runtime syncing is the next hookup.`
                : selectedWorld._tag === "error"
                  ? selectedWorld.message
                  : "Loading selected world..."
          }
          disabled={
            selectedWorld._tag !== "ready" && selectedWorld._tag !== "mock"
          }
          onPlay={handlePlay}
          onPlayIntent={handlePlayIntent}
          playHoverSound={playHoverSound}
        />
      )}
    </>
  );
}

function HomeApp() {
  const [seedUsername] = useState(makeRandomUsername);
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
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
  const [panelMessage, setPanelMessage] = useState<string | null>(null);
  const playHoverSound = useInterfaceSound(
    "/kits/sounds/select_003.ogg",
    0.088,
    [0.95, 1.05],
  );
  const playClickSound = useInterfaceSound("/kits/sounds/click_001.ogg", 0.35);

  const loadWorldDirectory = async (actorDisplayName: string) => {
    setIsRefreshing(true);

    try {
      const response = await Effect.runPromise(
        listOwnWorlds({ actorDisplayName }),
      );
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
    } catch (error) {
      setWorlds([]);
      setApiStatus({
        _tag: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrapHome = async () => {
      const fallbackUsername = seedUsername;

      try {
        const storedDisplayName = await Effect.runPromise(
          readStoredActorDisplayName(),
        );
        const actorDisplayName = storedDisplayName ?? fallbackUsername;

        if (cancelled) {
          return;
        }

        setPreferredUsername(actorDisplayName);
        setSettingsUsername(actorDisplayName);
        setNewWorldDraft(
          makeNewWorldDraft(actorDisplayName, readPreferredAssetId()),
        );

        await loadWorldDirectory(actorDisplayName);
      } catch {
        if (cancelled) {
          return;
        }

        setPreferredUsername(fallbackUsername);
        setSettingsUsername(fallbackUsername);
        setNewWorldDraft(
          makeNewWorldDraft(fallbackUsername, readPreferredAssetId()),
        );
        await loadWorldDirectory(fallbackUsername);
      }
    };

    void bootstrapHome();

    return () => {
      cancelled = true;
    };
  }, [seedUsername]);

  // Dispatch character selection to the 3D scene for the arrow indicator
  useEffect(() => {
    const selectedAsset = activePanel === "new-world"
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
    goToWorld(worldId, { autostart: true });
  };

  const handleLaunchMockWorld = () => {
    playClickSound();
    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = "/world";
    nextUrl.search = "?mock=1";
    window.location.assign(nextUrl.toString());
  };

  const handleLaunchModelViewer = () => {
    playClickSound();
    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = "/world";
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

    try {
      await Effect.runPromise(
        getOrCreateActorCredentials({ displayName: username }),
      );

      setPreferredUsername(username);
      setSettingsUsername(username);
      writePreferredAssetId(newWorldDraft.hostAssetId);

      const response = await Effect.runPromise(
        createWorld({
          actorDisplayName: username,
          request: {
            hostAssetId: newWorldDraft.hostAssetId,
            idempotencyKey: crypto.randomUUID(),
            mode: newWorldDraft.mode,
            visibility: newWorldDraft.visibility,
            worldName,
          },
        }),
      );

      goToWorld(response.world.worldId, { autostart: true });
    } catch (error) {
      setPanelMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSettings = async () => {
    const username = settingsUsername.trim();

    if (username.length === 0) {
      setPanelMessage("Username cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    setPanelMessage(null);

    try {
      await Effect.runPromise(
        getOrCreateActorCredentials({ displayName: username }),
      );
      setPreferredUsername(username);
      setSettingsUsername(username);
      setNewWorldDraft((current) => ({
        ...current,
        username,
      }));
      await loadWorldDirectory(username);
      setPanelMessage("Username updated.");
      setActivePanel("root");
    } catch (error) {
      setPanelMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
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
                        <button
                          key={world.worldId}
                          type="button"
                          disabled={!isReady}
                          className="world-list-card"
                          onClick={() => handleLaunchWorld(world.worldId)}
                          onPointerEnter={playHoverSound}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
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
