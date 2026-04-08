const WORLD_MENU_ACTIONS = [
  {
    id: "settings",
    label: "Settings",
    keyLabel: "Esc",
    tone: "slate",
  },
  {
    id: "inventory",
    label: "Inventory",
    keyLabel: "I",
    tone: "blue",
  },
  {
    id: "build",
    label: "Build",
    keyLabel: "B",
    tone: "gold",
  },
  {
    id: "destroy",
    label: "Destroy",
    keyLabel: "D",
    tone: "red",
  },
] as const;

export type WorldMenuAction = (typeof WORLD_MENU_ACTIONS)[number]["id"];

export function WorldMenuHud({
  activeAction,
  onActionSelect,
  onActionHover,
}: {
  readonly activeAction: WorldMenuAction | null;
  readonly onActionSelect: (action: WorldMenuAction) => void;
  readonly onActionHover?: () => void;
}) {
  return (
    <nav
      className="world-menu-hud"
      aria-label="World menus"
    >
      {WORLD_MENU_ACTIONS.map((action) => {
        const isActive = activeAction === action.id;

        return (
          <button
            key={action.id}
            type="button"
            className={[
              "world-menu-pill",
              `world-menu-pill--${action.tone}`,
              isActive ? "is-active" : "",
            ].join(" ")}
            aria-pressed={isActive}
            onPointerEnter={onActionHover}
            onFocus={onActionHover}
            onClick={() => onActionSelect(action.id)}
          >
            <span className="world-menu-pill-badge" aria-hidden="true">
              {action.keyLabel}
            </span>
            <span className="world-menu-pill-label">{action.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
