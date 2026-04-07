import {
  type ReactNode,
  StrictMode,
  Suspense,
  lazy,
  startTransition,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { AmbientMusicPlayer } from "./AmbientMusicPlayer";
import { AudioSettingsProvider, useAudioSettings } from "./audio-settings";
import { Chatbox } from "./components/Chatbox";
import { SliderControl } from "./components/SliderControl";
import { StartScreenScene } from "./scenes/StartScreenScene";

const Game = lazy(() => import("./Game").then((m) => ({ default: m.Game })));
const World = lazy(() => import("./World").then((m) => ({ default: m.World })));

type ApiStatus =
  | { readonly _tag: "loading" }
  | { readonly _tag: "ready"; readonly message: string }
  | { readonly _tag: "error"; readonly message: string };

function useInterfaceSound(path: string, volume: number, pitchRange: [number, number] = [1, 1]) {
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
    audio.playbackRate = pitchRange[0] + Math.random() * (pitchRange[1] - pitchRange[0]);
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
  if (window.location.pathname === "/world") {
    return <WorldApp />;
  }

  return <HomeApp />;
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
    <div className="pause-overlay" onClick={onResume}>
      <div
        className="pause-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
        onClick={(event) => event.stopPropagation()}
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
            className="play-button play-button-primary"
            onPointerEnter={playHoverSound}
            onFocus={playHoverSound}
            onClick={onResume}
          >
            <span className="play-button-face">
              <span className="play-button-caret" aria-hidden="true" />
              <span>Resume shift</span>
            </span>
          </button>
          <button
            type="button"
            className="play-button secondary-button"
            onPointerEnter={playHoverSound}
            onFocus={playHoverSound}
            onClick={onExit}
          >
            <span className="play-button-face">
              <span>Return to title</span>
            </span>
          </button>
        </div>
        <p className="pause-hint">{hint}</p>
      </div>
    </div>
  );
}

function StartScreenOverlay({
  onPlay,
  playHoverSound,
}: {
  readonly onPlay: () => void;
  readonly playHoverSound: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-[clamp(1.5rem,4vh,3rem)]">
      <div className="pointer-events-auto flex flex-col items-center gap-3">
        <button
          type="button"
          className="group flex items-center gap-3 rounded-full border-2 border-white/30 bg-white/85 px-8 py-3.5 text-lg font-black tracking-wide text-emerald-900 shadow-[0_4px_24px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-all duration-150 hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] active:translate-y-px"
          onPointerEnter={playHoverSound}
          onFocus={playHoverSound}
          onClick={onPlay}
        >
          <img
            className="h-4 w-4 transition-transform duration-150 group-hover:scale-110"
            src="/kits/ui/icon_play_dark.svg"
            alt=""
            aria-hidden="true"
          />
          <span>Begin shift</span>
        </button>
        <p className="text-xs font-bold tracking-[0.16em] text-white/70 drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
          BAR-001 &middot; FLA-002 &middot; FRO-003 &middot; RPA-004
        </p>
      </div>
    </div>
  );
}

function WorldApp() {
  const [hasStarted, setHasStarted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const resumeButtonRef = useRef<HTMLButtonElement | null>(null);
  const playHoverSound = useInterfaceSound("/kits/sounds/select_003.ogg", 0.088, [0.95, 1.05]);
  const playClickSound = useInterfaceSound("/kits/sounds/click_001.ogg", 0.35);

  const handlePlay = () => {
    playClickSound();
    startTransition(() => {
      setHasStarted(true);
      setIsMenuOpen(false);
    });
  };

  const handleResume = () => {
    playClickSound();
    setIsMenuOpen(false);
  };

  const handleReturnToTitle = () => {
    playClickSound();
    startTransition(() => {
      setIsMenuOpen(false);
      setHasStarted(false);
    });
  };

  useEffect(() => {
    if (!hasStarted) {
      setIsMenuOpen(false);
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

      event.preventDefault();
      setIsMenuOpen((current) => !current);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasStarted]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    resumeButtonRef.current?.focus();
  }, [isMenuOpen]);

  return (
    <>
      <Suspense fallback={<div className="stage stage-loading">Loading world...</div>}>
        {hasStarted ? <World isPaused={isMenuOpen} /> : <StartScreenScene />}
      </Suspense>

      {hasStarted && isMenuOpen ? (
        <PauseMenuOverlay
          copy="Movement and camera controls are paused. Resume the world or return to the title screen."
          hint="Press Esc to resume"
          onResume={handleResume}
          onExit={handleReturnToTitle}
          playHoverSound={playHoverSound}
          resumeButtonRef={resumeButtonRef}
        />
      ) : null}

      {hasStarted ? <Chatbox /> : null}

      {hasStarted ? null : (
        <StartScreenOverlay onPlay={handlePlay} playHoverSound={playHoverSound} />
      )}
    </>
  );
}

function HomeApp() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ _tag: "loading" });
  const [hasStarted, setHasStarted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const resumeButtonRef = useRef<HTMLButtonElement | null>(null);
  const playHoverSound = useInterfaceSound("/kits/sounds/select_003.ogg", 0.088, [0.95, 1.05]);
  const playClickSound = useInterfaceSound("/kits/sounds/click_001.ogg", 0.35);

  useEffect(() => {
    const controller = new AbortController();

    const loadStatus = async () => {
      try {
        const response = await fetch("/api/health", { signal: controller.signal });

        if (!response.ok) {
          setApiStatus({ _tag: "error", message: `API unavailable (${response.status})` });
          return;
        }

        const payload = await response.json();
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "message" in payload &&
          typeof payload.message === "string"
            ? payload.message
            : "API online";

        setApiStatus({
          _tag: "ready",
          message,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setApiStatus({ _tag: "error", message: "API offline" });
      }
    };

    void loadStatus();

    return () => {
      controller.abort();
    };
  }, []);

  const handlePlay = () => {
    playClickSound();
    startTransition(() => {
      setHasStarted(true);
      setIsMenuOpen(false);
    });
  };

  const handleResume = () => {
    playClickSound();
    setIsMenuOpen(false);
  };

  const handleReturnToTitle = () => {
    playClickSound();
    startTransition(() => {
      setIsMenuOpen(false);
      setHasStarted(false);
    });
  };

  useEffect(() => {
    if (!hasStarted) {
      setIsMenuOpen(false);
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

      event.preventDefault();
      setIsMenuOpen((current) => !current);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasStarted]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    resumeButtonRef.current?.focus();
  }, [isMenuOpen]);

  const apiLabel = apiStatus._tag === "loading" ? "Connecting backend..." : apiStatus.message;

  return (
    <>
      <Suspense fallback={<div className="stage stage-loading">Loading...</div>}>
        {hasStarted ? <Game isPaused={isMenuOpen} /> : <StartScreenScene />}
      </Suspense>

      {hasStarted ? (
        <div className="hud">
          <p className="eyebrow">2026 Vibe Coding Game Jam</p>
          <h1>Refactory</h1>
          <p className="tagline">Preview build: model sandbox and scene prototype.</p>
          <p className="text-xs text-white/75">
            Drag orbits. Hold space to drag-pan. Arrows pan. Shift plus arrows orbits. Plus/minus
            zooms. Esc opens shift menu.
          </p>
          <p className={`status status-${apiStatus._tag}`}>{apiLabel}</p>
        </div>
      ) : null}

      {hasStarted && isMenuOpen ? (
        <PauseMenuOverlay
          copy="Camera controls are paused. Resume the sandbox or return to the title screen."
          hint="Press Esc to resume"
          onResume={handleResume}
          onExit={handleReturnToTitle}
          playHoverSound={playHoverSound}
          resumeButtonRef={resumeButtonRef}
        />
      ) : null}

      {hasStarted ? null : (
        <StartScreenOverlay onPlay={handlePlay} playHoverSound={playHoverSound} />
      )}
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
