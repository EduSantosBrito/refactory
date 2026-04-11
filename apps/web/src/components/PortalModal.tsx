import { useCallback, useEffect } from "react";

type PortalModalProps = {
  portalType: "entry" | "exit";
  onEnter: () => void;
  onClose: () => void;
};

export function PortalModal({ portalType, onEnter, onClose }: PortalModalProps) {
  const isExit = portalType === "exit";

  const title = isExit ? "Webring Portal" : "Return Portal";
  const description = isExit
    ? "This portal connects to other games in the Vibe Jam 2026 webring. Step through to discover another world."
    : "This portal leads back to where you came from.";
  const enterLabel = isExit ? "Continue to Next Game" : "Return to Previous Game";

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <div
      className="portal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="portal-title"
    >
      <div className="portal-modal">
        <div className="portal-header">
          <span className="portal-kicker">Vibe Jam 2026</span>
          <h2 id="portal-title" className="portal-title">
            {title}
          </h2>
        </div>

        <div className="portal-divider" />

        <p className="portal-description">{description}</p>

        <div className="portal-actions">
          <button
            type="button"
            className="game-btn game-btn-primary"
            onClick={onEnter}
          >
            {enterLabel}
          </button>
          <button
            type="button"
            className="game-btn game-btn-secondary"
            onClick={onClose}
          >
            Stay Here
          </button>
        </div>

        <p className="portal-hint">
          <kbd>ESC</kbd> to close
        </p>
      </div>
    </div>
  );
}
