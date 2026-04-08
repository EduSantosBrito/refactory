import { useEffect, useRef } from "react";

/** Placeholder slot data — swap for real inventory later */
export type InventorySlot = {
  readonly itemId: string;
  readonly label: string;
  readonly quantity: number;
} | null;

const GRID_COLS = 10;
const GRID_ROWS = 4;
const SLOT_COUNT = GRID_COLS * GRID_ROWS;

/** Skeleton inventory with a few mock items for visual reference */
const MOCK_SLOTS: readonly InventorySlot[] = Array.from(
  { length: SLOT_COUNT },
  (_, i) => {
    if (i === 0)
      return { itemId: "iron_plate", label: "Iron Plate", quantity: 42 };
    if (i === 1)
      return { itemId: "copper_wire", label: "Copper Wire", quantity: 99 };
    if (i === 2)
      return { itemId: "circuit", label: "Circuit Board", quantity: 15 };
    if (i === 5)
      return { itemId: "gear", label: "Gear", quantity: 8 };
    if (i === 10)
      return { itemId: "bolt", label: "Bolt", quantity: 64 };
    if (i === 11)
      return { itemId: "spring", label: "Spring", quantity: 30 };
    return null;
  },
);

export function InventoryModal({
  onClose,
}: {
  readonly onClose: () => void;
}) {
  const shellRef = useRef<HTMLDivElement>(null);

  // Close on I key (Escape is handled by main.tsx)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="inventory-overlay" onClick={onClose}>
      <div
        ref={shellRef}
        className="inventory-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Inventory"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="inventory-header">
          <span className="inventory-kicker">Storage</span>
          <h2 className="inventory-title">Inventory</h2>
        </div>

        {/* Item grid */}
        <div
          className="inventory-grid"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          }}
        >
          {MOCK_SLOTS.map((slot, i) => (
            <button
              key={i}
              type="button"
              className={`inventory-slot ${slot ? "has-item" : ""}`}
              aria-label={slot ? `${slot.label} ×${slot.quantity}` : `Empty slot ${i + 1}`}
            >
              {slot ? (
                <>
                  <span className="inventory-slot-icon" aria-hidden="true">
                    {/* Placeholder — replace with actual item sprite later */}
                    {slot.itemId === "iron_plate" && "🔩"}
                    {slot.itemId === "copper_wire" && "🪢"}
                    {slot.itemId === "circuit" && "🔌"}
                    {slot.itemId === "gear" && "⚙️"}
                    {slot.itemId === "bolt" && "🔧"}
                    {slot.itemId === "spring" && "🧲"}
                  </span>
                  <span className="inventory-slot-qty">{slot.quantity}</span>
                </>
              ) : null}
            </button>
          ))}
        </div>

        {/* Close hint */}
        <p className="inventory-hint">
          Press <kbd>I</kbd> or <kbd>Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
