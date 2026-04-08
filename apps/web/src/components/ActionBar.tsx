import { useEffect, useState } from "react";

const SLOT_COUNT = 6;

/** Action bar slot — skeleton placeholder for now */
export type ActionBarSlot = {
  readonly itemId: string;
  readonly label: string;
} | null;

/** A few mock items so the bar doesn't look fully empty */
const MOCK_SLOTS: readonly ActionBarSlot[] = [
  { itemId: "iron_plate", label: "Iron Plate" },
  { itemId: "copper_wire", label: "Copper Wire" },
  null,
  null,
  null,
  { itemId: "gear", label: "Gear" },
];

export function ActionBar() {
  const [activeSlot, setActiveSlot] = useState<number>(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const num = Number.parseInt(event.key, 10);
      if (num >= 1 && num <= SLOT_COUNT) {
        event.preventDefault();
        setActiveSlot(num - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="action-bar" aria-label="Action bar">
      {MOCK_SLOTS.map((slot, i) => (
        <button
          key={i}
          type="button"
          className={`action-bar-slot ${i === activeSlot ? "is-active" : ""} ${slot ? "has-item" : ""}`}
          aria-label={slot ? `Slot ${i + 1}: ${slot.label}` : `Slot ${i + 1}: empty`}
          aria-pressed={i === activeSlot}
          onClick={() => setActiveSlot(i)}
        >
          <span className="action-bar-slot-key" aria-hidden="true">
            {i + 1}
          </span>
          {slot ? (
            <span className="action-bar-slot-icon" aria-hidden="true">
              {slot.itemId === "iron_plate" && "🔩"}
              {slot.itemId === "copper_wire" && "🪢"}
              {slot.itemId === "gear" && "⚙️"}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
