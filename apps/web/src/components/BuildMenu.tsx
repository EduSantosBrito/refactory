import { useEffect, useState } from "react";

type BuildCategory = "production" | "power" | "logistics";

type BuildingEntry = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly summary: string;
  readonly emoji: string;
  readonly category: BuildCategory;
  readonly powerLabel: string;
  readonly ports: { readonly inputs: number; readonly outputs: number };
  readonly costLabel: string;
  readonly locked?: boolean;
};

const BUILD_CATEGORIES: ReadonlyArray<{
  readonly id: BuildCategory;
  readonly label: string;
}> = [
  { id: "production", label: "Production" },
  { id: "power", label: "Power" },
  { id: "logistics", label: "Logistics" },
];

const BUILDING_ENTRIES: ReadonlyArray<BuildingEntry> = [
  // ── Production ────────────────────────────────────────────
  {
    id: "miner_v1",
    name: "Miner v1",
    description: "Extracts raw ore from mineral nodes",
    summary:
      "Place on mineral nodes to begin automated ore extraction. Needed from the start.",
    emoji: "⛏️",
    category: "production",
    powerLabel: "10 MW",
    ports: { inputs: 0, outputs: 1 },
    costLabel: "1× Miner v1",
  },
  {
    id: "smelter_v1",
    name: "Smelter v1",
    description: "Smelts raw ore into refined ingots",
    summary:
      "Turns raw ore into ingots. Needed from the start to process mined resources.",
    emoji: "🔥",
    category: "production",
    powerLabel: "15 MW",
    ports: { inputs: 1, outputs: 1 },
    costLabel: "1× Smelter v1",
  },
  {
    id: "processor",
    name: "Processor",
    description: "Processes ingots into plates and rods",
    summary:
      "Converts ingots into plates and rods. Unlocks after the tutorial.",
    emoji: "🔧",
    category: "production",
    powerLabel: "10 MW",
    ports: { inputs: 1, outputs: 1 },
    costLabel: "1× Processor",
  },

  // ── Power ─────────────────────────────────────────────────
  {
    id: "burner_v1",
    name: "Burner v1",
    description: "Burns wood to generate power",
    summary:
      "Burns wood to power nearby machines. Needed from the start — fuel it manually.",
    emoji: "🪵",
    category: "power",
    powerLabel: "+30 MW",
    ports: { inputs: 0, outputs: 0 },
    costLabel: "1× Burner v1",
  },

  // ── Logistics ─────────────────────────────────────────────
  {
    id: "belt_v1",
    name: "Belt v1",
    description: "Transports items between ports",
    summary:
      "Connects machine ports to automate item transport between buildings.",
    emoji: "➡️",
    category: "logistics",
    powerLabel: "—",
    ports: { inputs: 0, outputs: 0 },
    costLabel: "1× Iron Ingot / tile",
  },
  {
    id: "splitter",
    name: "Splitter",
    description: "Splits one input to three outputs",
    summary:
      "Distributes one input across up to three outputs. Unlocks after the tutorial.",
    emoji: "🔀",
    category: "logistics",
    powerLabel: "—",
    ports: { inputs: 1, outputs: 3 },
    costLabel: "Locked",
    locked: true,
  },
  {
    id: "merger",
    name: "Merger",
    description: "Merges three inputs into one output",
    summary:
      "Combines up to three inputs into one output. Unlocks after the tutorial.",
    emoji: "🔄",
    category: "logistics",
    powerLabel: "—",
    ports: { inputs: 3, outputs: 1 },
    costLabel: "Locked",
    locked: true,
  },
  {
    id: "container",
    name: "Container",
    description: "Stores overflow items from belts",
    summary:
      "Stores overflow items from belt lines. Unlocks after the tutorial.",
    emoji: "📦",
    category: "logistics",
    powerLabel: "—",
    ports: { inputs: 4, outputs: 0 },
    costLabel: "Locked",
    locked: true,
  },
];

export function BuildMenu({
  onClose,
  activeBuildId,
  onBuildSelect,
}: {
  readonly onClose: () => void;
  readonly activeBuildId: string | null;
  readonly onBuildSelect: (buildId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(activeBuildId);

  const [activeCategory, setActiveCategory] = useState<BuildCategory>(() => {
    const activeBuild = activeBuildId
      ? BUILDING_ENTRIES.find((b) => b.id === activeBuildId) ?? null
      : null;

    return activeBuild?.category ?? "production";
  });

  const filtered = BUILDING_ENTRIES.filter(
    (b) => b.category === activeCategory,
  );
  const selected = selectedId
    ? BUILDING_ENTRIES.find((b) => b.id === selectedId) ?? null
    : null;

  // Close on B key (Escape is handled by main.tsx)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleCategoryChange = (cat: BuildCategory) => {
    setActiveCategory(cat);
  };

  const handleCardClick = (entry: BuildingEntry) => {
    if (entry.locked) return;
    setSelectedId(entry.id);
  };

  const handleBuild = () => {
    if (!selectedId) return;
    onBuildSelect(selectedId);
    onClose();
  };

  return (
    <div className="build-overlay" onClick={onClose}>
      <div
        className="build-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Build menu"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="build-header">
          <span className="build-kicker">Workshop</span>
          <h2 className="build-title">Build</h2>
        </div>

        {/* Body: vertical tabs + content */}
        <div className="build-body">
          {/* Category sidebar */}
          <nav className="build-categories" aria-label="Build categories">
            {BUILD_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`build-category-tab ${activeCategory === cat.id ? "is-active" : ""}`}
                onClick={() => handleCategoryChange(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </nav>

          {/* Content: grid + detail */}
          <div className="build-content">
            <div className="build-grid">
              {filtered.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={[
                    "build-card",
                    selectedId === entry.id ? "is-selected" : "",
                    entry.locked ? "is-locked" : "",
                  ].join(" ")}
                  aria-label={entry.name}
                  aria-pressed={selectedId === entry.id}
                  disabled={entry.locked}
                  onClick={() => handleCardClick(entry)}
                >
                  <span className="build-card-icon" aria-hidden="true">
                    {entry.emoji}
                  </span>
                  <span className="build-card-name">{entry.name}</span>
                  <span className="build-card-desc">{entry.description}</span>
                  <span className="build-card-cost">
                    {entry.locked ? "🔒 " : ""}
                    {entry.costLabel}
                  </span>
                  {entry.locked ? (
                    <span className="build-card-lock" aria-hidden="true">
                      🔒
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            {/* Detail panel */}
            <div className="build-detail">
              {selected ? (
                <>
                  <p className="build-detail-name">{selected.name}</p>
                  <p className="build-detail-desc">{selected.summary}</p>

                  <div className="build-detail-stats">
                    <div className="build-detail-stat">
                      <span className="build-detail-stat-label">Power</span>
                      <span className="build-detail-stat-value">
                        {selected.powerLabel}
                      </span>
                    </div>

                    {selected.ports.inputs > 0 ||
                    selected.ports.outputs > 0 ? (
                      <div className="build-detail-stat">
                        <span className="build-detail-stat-label">Ports</span>
                        <span className="build-detail-stat-value">
                          {selected.ports.inputs > 0
                            ? `${selected.ports.inputs} in`
                            : ""}
                          {selected.ports.inputs > 0 &&
                          selected.ports.outputs > 0
                            ? " · "
                            : ""}
                          {selected.ports.outputs > 0
                            ? `${selected.ports.outputs} out`
                            : ""}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="build-detail-cost">
                    <span className="build-detail-stat-label">Build cost</span>
                    <span className="build-detail-cost-value">
                      {selected.costLabel}
                    </span>
                  </div>
                </>
              ) : (
                <p className="build-detail-empty">
                  Select a building to view details
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="build-footer">
          <p className="build-hint">
            Press <kbd>B</kbd> or <kbd>Esc</kbd> to close
          </p>
          <button
            type="button"
            className="game-btn game-btn-primary build-confirm"
            disabled={!selectedId}
            onClick={handleBuild}
          >
            Build
          </button>
        </div>
      </div>
    </div>
  );
}
