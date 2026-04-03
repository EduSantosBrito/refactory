import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type ApiStatus =
  | { readonly _tag: "loading" }
  | { readonly _tag: "ready"; readonly message: string }
  | { readonly _tag: "error"; readonly message: string };

function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ _tag: "loading" });
  const [hasStarted, setHasStarted] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

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
    setHasStarted(true);
    stageRef.current?.focus();
  };

  const apiLabel = apiStatus._tag === "loading" ? "Connecting backend..." : apiStatus.message;

  return (
    <>
      <div className="stage" aria-hidden="true" ref={stageRef} tabIndex={-1} />
      <div className="hud">
        <p className="eyebrow">2026 Vibe Coding Game Jam</p>
        <h1>Refactory</h1>
        <p className="tagline">A fast-loading factory sandbox prototype.</p>
        <p className={`status status-${apiStatus._tag}`}>{apiLabel}</p>
      </div>
      {hasStarted ? null : (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            aria-describedby="onboarding-description"
          >
            <p className="eyebrow">Welcome</p>
            <h2 id="onboarding-title">Build the factory. Clean the mess.</h2>
            <p id="onboarding-description" className="modal-copy">
              Refactory is a factory-building game about taking chaotic inputs and turning them into
              clean, reliable output.
            </p>
            <p className="modal-copy">
              Place machines, connect belts, and shape a layout that keeps parts moving without jams
              or waste.
            </p>
            <button type="button" className="play-button" onClick={handlePlay}>
              Play
            </button>
          </section>
        </div>
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
