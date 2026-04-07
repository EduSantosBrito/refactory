import { useId } from "react";

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

export function SliderControl({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}) {
  const id = useId();
  const percent = clampPercent(value);

  return (
    <div className="slider-control">
      <div className="slider-control-header">
        <label className="slider-control-label" htmlFor={id}>
          {label}
        </label>
        <span className="slider-control-value">{percent}%</span>
      </div>

      <div className="slider-shell">
        <div className="slider-track" aria-hidden="true">
          <div className="slider-track-fill" style={{ width: `${percent}%` }} />
        </div>
        <div className="slider-thumb" aria-hidden="true" style={{ left: `${percent}%` }} />
        <input
          id={id}
          className="slider-input"
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          onChange={(event) => {
            onChange(Number(event.currentTarget.value) / 100);
          }}
        />
      </div>
    </div>
  );
}
