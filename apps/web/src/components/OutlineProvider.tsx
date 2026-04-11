import { useFrame, type ThreeElements } from "@react-three/fiber";
import { EffectComposer, Outline } from "@react-three/postprocessing";
import { Effect } from "effect";
import { KernelSize } from "postprocessing";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Group, Object3D } from "three";

type OutlineSelectionSetter = Dispatch<SetStateAction<Object3D[]>>;

type SelectProps = Omit<ThreeElements["group"], "ref"> & {
  enabled?: boolean;
};

type OutlineSelectionApi = {
  readonly setSelectedMeshes: Dispatch<SetStateAction<Object3D[]>>;
};

const OutlineSelectionContext = createContext<OutlineSelectionApi | null>(null);

const collectOutlineMeshes = (group: Group): ReadonlyArray<Object3D> => {
  const meshes: Object3D[] = [];

  group.traverse((object) => {
    if (object.type === "Mesh" && object.userData.isHitArea !== true) {
      meshes.push(object);
    }
  });

  return meshes;
};

const addOutlineSelection = (
  group: Group,
  setSelectedMeshes: OutlineSelectionSetter,
) => {
  const meshes = collectOutlineMeshes(group);

  setSelectedMeshes((current) => {
    let changed = false;
    const next = [...current];

    for (const mesh of meshes) {
      if (!next.includes(mesh)) {
        changed = true;
        next.push(mesh);
      }
    }

    return changed ? next : current;
  });

  return meshes;
};

const removeOutlineSelection = (
  meshes: ReadonlyArray<Object3D>,
  setSelectedMeshes: OutlineSelectionSetter,
) => {
  setSelectedMeshes((current) => {
    const next = current.filter((selected) => !meshes.includes(selected));
    return next.length === current.length ? current : next;
  });
};

const addOutlineSelectionEffect = (
  group: Group,
  setSelectedMeshes: OutlineSelectionSetter,
) => Effect.sync(() => addOutlineSelection(group, setSelectedMeshes));

const removeOutlineSelectionEffect = (
  meshes: ReadonlyArray<Object3D>,
  setSelectedMeshes: OutlineSelectionSetter,
) => Effect.sync(() => removeOutlineSelection(meshes, setSelectedMeshes));

type OutlineProviderProps = {
  children: ReactNode;
  /** Outline color as hex number (default: 0xffffff) */
  color?: number;
  /** Edge strength/thickness (default: 100) */
  edgeStrength?: number;
};

/**
 * OutlineProvider - Wraps scene with post-processing outline effect
 *
 * Wrap hoverable objects with <Select enabled={hovered}> to outline them.
 *
 * @example
 * <OutlineProvider>
 *   <Select enabled={isHovered}>
 *     <mesh>...</mesh>
 *   </Select>
 * </OutlineProvider>
 */
export function Select({ enabled = false, children, ...props }: SelectProps) {
  const groupRef = useRef<Group>(null);
  const selectedMeshesRef = useRef<ReadonlyArray<Object3D>>([]);
  const api = useContext(OutlineSelectionContext);

  useEffect(() => {
    if (!enabled || !api || !groupRef.current) {
      return;
    }

    const meshes = Effect.runSync(
      addOutlineSelectionEffect(groupRef.current, api.setSelectedMeshes),
    );
    selectedMeshesRef.current = meshes;

    return () => {
      Effect.runSync(
        removeOutlineSelectionEffect(
          selectedMeshesRef.current,
          api.setSelectedMeshes,
        ),
      );
      selectedMeshesRef.current = [];
    };
  }, [enabled, api]);

  // Track child count to detect structural changes without full traversal
  const lastChildCountRef = useRef(0);

  useFrame(() => {
    if (!enabled || !api || !groupRef.current) {
      return;
    }

    // Quick check: only re-collect if child count changed
    const childCount = groupRef.current.children.length;
    if (childCount === lastChildCountRef.current) {
      return;
    }
    lastChildCountRef.current = childCount;

    const nextMeshes = collectOutlineMeshes(groupRef.current);
    if (
      nextMeshes.length === selectedMeshesRef.current.length &&
      nextMeshes.every(
        (mesh, index) => mesh === selectedMeshesRef.current[index],
      )
    ) {
      return;
    }

    Effect.runSync(
      removeOutlineSelectionEffect(
        selectedMeshesRef.current,
        api.setSelectedMeshes,
      ),
    );
    Effect.runSync(
      addOutlineSelectionEffect(groupRef.current, api.setSelectedMeshes),
    );
    selectedMeshesRef.current = nextMeshes;
  });

  return (
    <group ref={groupRef} {...props}>
      {children}
    </group>
  );
}

export function OutlineProvider({
  children,
  color = 0xffffff,
  edgeStrength = 100,
}: OutlineProviderProps) {
  const [selectedMeshes, setSelectedMeshes] = useState<Object3D[]>([]);
  const selectionApi = useMemo<OutlineSelectionApi>(
    () => ({ setSelectedMeshes }),
    [],
  );

  return (
    <OutlineSelectionContext.Provider value={selectionApi}>
      {children}
      <EffectComposer multisampling={0} autoClear={false}>
        <Outline
          selection={selectedMeshes}
          visibleEdgeColor={color}
          hiddenEdgeColor={color}
          edgeStrength={edgeStrength}
          kernelSize={KernelSize.VERY_SMALL}
          blur={false}
          xRay={false}
        />
      </EffectComposer>
    </OutlineSelectionContext.Provider>
  );
}
