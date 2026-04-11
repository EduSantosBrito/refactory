import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Effect } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { Raycaster, Vector2, type Group } from "three";

export type OutlineHoverOptions = {
  /** Callbacks from parent component */
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
};

type HoverState = {
  readonly hoveredAtom: Atom.Writable<boolean, boolean>;
  readonly registry: AtomRegistry.AtomRegistry;
};

const isDisposedRegistryError = (error: unknown) =>
  error instanceof Error && error.message.includes("registry is disposed");

const makeHoverState = (): HoverState => ({
  hoveredAtom: Atom.make(false).pipe(Atom.withLabel("outline.hovered")),
  registry: AtomRegistry.make(),
});

const setHovered = (
  registry: AtomRegistry.AtomRegistry,
  hoveredAtom: Atom.Writable<boolean, boolean>,
  hovered: boolean,
) =>
  Effect.sync(() =>
    registry.modify(hoveredAtom, (current) =>
      current === hovered ? [false, current] : [true, hovered],
    ),
  );

/**
 * useOutlineHover - Manages hover state for outline selection
 *
 * Returns hovered state to use with <Select enabled={hovered}> wrapper.
 *
 * @example
 * const { groupRef, hovered, pointerEvents } = useOutlineHover();
 *
 * return (
 *   <Select enabled={hovered}>
 *     <group ref={groupRef} {...pointerEvents}>
 *       <mesh>...</mesh>
 *     </group>
 *   </Select>
 * );
 */
export function useOutlineHover(options: OutlineHoverOptions = {}) {
  const { onPointerOver, onPointerOut } = options;
  const { camera, gl } = useThree();
  const groupRef = useRef<Group>(null);
  const lastPointerRef = useRef<Vector2 | null>(null);
  const raycasterRef = useRef(new Raycaster());
  const registryRef = useRef<AtomRegistry.AtomRegistry | null>(null);
  const hoveredAtomRef = useRef<Atom.Writable<boolean, boolean> | null>(null);

  const ensureHoverState = useCallback((): HoverState => {
    if (registryRef.current === null || hoveredAtomRef.current === null) {
      const state = makeHoverState();
      registryRef.current = state.registry;
      hoveredAtomRef.current = state.hoveredAtom;
      return state;
    }

    try {
      registryRef.current.get(hoveredAtomRef.current);

      return {
        hoveredAtom: hoveredAtomRef.current,
        registry: registryRef.current,
      };
    } catch (error) {
      if (!isDisposedRegistryError(error)) {
        throw error;
      }

      const recoveredState = makeHoverState();
      registryRef.current = recoveredState.registry;
      hoveredAtomRef.current = recoveredState.hoveredAtom;
      return recoveredState;
    }
  }, []);

  const subscribeHovered = useCallback(
    (onStoreChange: () => void) => {
      const { hoveredAtom, registry } = ensureHoverState();
      return registry.subscribe(hoveredAtom, onStoreChange);
    },
    [ensureHoverState],
  );

  const getHoveredSnapshot = useCallback(
    () => {
      const { hoveredAtom, registry } = ensureHoverState();
      return registry.get(hoveredAtom);
    },
    [ensureHoverState],
  );

  const getHoveredServerSnapshot = useCallback(
    () => {
      const { hoveredAtom, registry } = ensureHoverState();
      return Atom.getServerValue(hoveredAtom, registry);
    },
    [ensureHoverState],
  );

  const hovered = useSyncExternalStore(
    subscribeHovered,
    getHoveredSnapshot,
    getHoveredServerSnapshot,
  );

  const applyHovered = useCallback(
    (nextHovered: boolean) => {
      const { hoveredAtom, registry } = ensureHoverState();
      return Effect.runSync(setHovered(registry, hoveredAtom, nextHovered));
    },
    [ensureHoverState],
  );

  const updateHoveredFromPointer = useCallback(() => {
    const group = groupRef.current;
    const pointer = lastPointerRef.current;

    if (!group || !pointer) {
      return applyHovered(false);
    }

    const raycaster = raycasterRef.current;
    raycaster.setFromCamera(pointer, camera);
    return applyHovered(raycaster.intersectObject(group, true).length > 0);
  }, [applyHovered, camera]);

  useEffect(() => {
    const canvas = gl.domElement;

    const clearHover = () => {
      lastPointerRef.current = null;
      applyHovered(false);
    };

    const updatePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      lastPointerRef.current = new Vector2(x, y);
      updateHoveredFromPointer();
    };

    canvas.addEventListener("pointermove", updatePointer);
    canvas.addEventListener("pointerleave", clearHover);
    window.addEventListener("blur", clearHover);

    return () => {
      canvas.removeEventListener("pointermove", updatePointer);
      canvas.removeEventListener("pointerleave", clearHover);
      window.removeEventListener("blur", clearHover);
    };
  }, [applyHovered, gl, updateHoveredFromPointer]);

  useEffect(() => {
    document.body.classList.toggle("interactable-hover", hovered);

    return () => {
      if (hovered) {
        document.body.classList.remove("interactable-hover");
      }
    };
  }, [hovered]);

  useFrame(() => {
    if (lastPointerRef.current) {
      updateHoveredFromPointer();
    }
  });

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const changed = applyHovered(true);
      if (!changed) return;
      onPointerOver?.(e);
    },
    [applyHovered, onPointerOver],
  );

  const handlePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const changed = applyHovered(false);
      if (!changed) return;
      onPointerOut?.(e);
    },
    [applyHovered, onPointerOut],
  );

  return {
    /** Ref to attach to the group containing meshes */
    groupRef,
    /** Current hover state - use with <Select enabled={hovered}> */
    hovered,
    /** Spread these onto your group: {...pointerEvents} */
    pointerEvents: {
      onPointerOver: handlePointerOver,
      onPointerOut: handlePointerOut,
    },
  };
}
