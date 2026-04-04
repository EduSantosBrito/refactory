import { StrictMode, useEffect, useRef, useState, lazy, startTransition, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { StartScreenScene } from "./scenes/StartScreenScene";

const Game = lazy(() => import("./Game").then((m) => ({ default: m.Game })));

type ApiStatus =
  | { readonly _tag: "loading" }
  | { readonly _tag: "ready"; readonly message: string }
  | { readonly _tag: "error"; readonly message: string };

function useInterfaceSound(path: string, volume: number, pitchRange: [number, number] = [1, 1]) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(path);
    audio.preload = "auto";
    audio.volume = volume;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [path, volume]);

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

function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ _tag: "loading" });
  const [hasStarted, setHasStarted] = useState(false);
  const playHoverSound = useInterfaceSound("/kits/sounds/select_003.ogg", 0.22, [0.95, 1.05]);
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
    });
  };

  const apiLabel = apiStatus._tag === "loading" ? "Connecting backend..." : apiStatus.message;

  return (
    <>
      <Suspense fallback={<div className="stage stage-loading">Loading...</div>}>
        {hasStarted ? <Game /> : <StartScreenScene />}
      </Suspense>

      {hasStarted ? (
        <div className="hud">
          <p className="eyebrow">2026 Vibe Coding Game Jam</p>
          <h1>Refactory</h1>
          <p className="tagline">Preview build: model sandbox and scene prototype.</p>
          <p className={`status status-${apiStatus._tag}`}>{apiLabel}</p>
        </div>
      ) : null}

      {hasStarted ? null : (
        <>
          {/* Title overlay */}
          <div className="pointer-events-none fixed inset-x-0 top-0 z-10 flex flex-col items-center pt-[clamp(2rem,6vh,4.5rem)]">
            <h1
              className="text-[clamp(3.5rem,10vw,7rem)] font-black leading-none tracking-wide text-white"
              style={{
                textShadow:
                  "0 4px 12px rgba(46,90,60,0.35), 0 0 40px rgba(255,255,240,0.15)",
              }}
            >
              Refactory
            </h1>
            <p className="mt-1 text-sm font-bold tracking-widest text-white/80 drop-shadow-[0_1px_4px_rgba(0,0,0,0.3)]">
              GeePeeYou // Computing Tomorrow&apos;s Possibilities
            </p>
          </div>

          {/* Bottom play area */}
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-[clamp(1.5rem,4vh,3rem)]">
            <div className="pointer-events-auto flex flex-col items-center gap-3">
              <button
                type="button"
                className="group flex items-center gap-3 rounded-full border-2 border-white/30 bg-white/85 px-8 py-3.5 text-lg font-black tracking-wide text-emerald-900 shadow-[0_4px_24px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-all duration-150 hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] active:translate-y-px"
                onPointerEnter={playHoverSound}
                onFocus={playHoverSound}
                onClick={handlePlay}
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
        </>
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
    <App />
  </StrictMode>,
);
