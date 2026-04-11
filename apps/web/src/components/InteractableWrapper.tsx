import { useCallback, useEffect, useState, type ReactNode } from "react";

type InteractableWrapperProps = {
  children: ReactNode;
  interactionId: string;
  enabled?: boolean;
};

export function InteractableWrapper({
  children,
  interactionId,
  enabled = true,
}: InteractableWrapperProps) {
  const [hovered, setHovered] = useState(false);

  const handlePointerOver = useCallback(
    (e: { stopPropagation: () => void }) => {
      if (!enabled) return;
      e.stopPropagation();
      setHovered(true);
    },
    [enabled],
  );

  const handlePointerOut = useCallback(() => {
    setHovered(false);
  }, []);

  const handleClick = useCallback(
    (e: { stopPropagation: () => void }) => {
      if (!enabled) return;
      e.stopPropagation();
      window.dispatchEvent(
        new CustomEvent("building-interact", {
          detail: { id: interactionId },
        }),
      );
    },
    [enabled, interactionId],
  );

  // Update cursor on hover
  useEffect(() => {
    if (hovered && enabled) {
      document.body.style.cursor =
        'url("/kits/cursors/hand_point.svg") 10 5, pointer';
    }
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered, enabled]);

  return (
    <group
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {children}
    </group>
  );
}
