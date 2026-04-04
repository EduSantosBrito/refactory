import { useRef, useMemo, useLayoutEffect, useEffect, Suspense } from "react";
import { useGLTF, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { AnimationMixer, Box3, LoopOnce, MathUtils, Vector3, CylinderGeometry } from "three";
import type { AnimationAction } from "three";
import type { Group, Object3D } from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { COLORS, MAT, type ModelProps } from "../models/colors";
import { Character, type CharacterName } from "../models/Character";
import {
  IronNode,
  CopperNode,
  Smelter,
  Processor,
  ConveyorBelt,
  ModularStorage,
  Burner,
  PowerPole,
  WindTurbine,
  Rocket,
  Miner,
  MechLeg,
  BeltSegment,
  BeltCurve,
  BeltChain,
  OakTree,
  DetailedTree,
  PineTree,
  FlatTopTree,
  Flower,
  Bush,
  GrassClump,
  Rock,
  Campfire,
  TreeStump,
} from "../models";
import type { ChainSegment, ChainItem } from "../models";
import { CURVE_ARC_LENGTH } from "../models/belt";

/* ── Types ─────────────────────────────────────────────────── */

interface CharacterEntry {
  kind: "character";
  name: string;
  characterName: CharacterName;
  targetHeight?: number;
  animate?: string | string[];
  roam?: boolean;
}

interface GltfEntry {
  kind: "gltf";
  name: string;
  path: string;
  targetHeight?: number;
  animate?: string | string[];
  roam?: boolean;
}

interface ComponentEntry {
  kind: "component";
  name: string;
  component: React.FC<ModelProps>;
  scale?: number;
}

type Entry = CharacterEntry | GltfEntry | ComponentEntry;

interface Section {
  label: string;
  entries: Entry[];
}

/* ── Wrappers for non-ModelProps components ───────────────── */

const MechLegMd: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <MechLeg direction={0} size="md" />
  </group>
);

const OakTreeSm: React.FC<ModelProps> = (props) => <OakTree size="sm" {...props} />;
const OakTreeLg: React.FC<ModelProps> = (props) => <OakTree size="lg" {...props} />;
const DetailedTreeSm: React.FC<ModelProps> = (props) => <DetailedTree size="sm" {...props} />;
const DetailedTreeLg: React.FC<ModelProps> = (props) => <DetailedTree size="lg" {...props} />;
const PineTreeSm: React.FC<ModelProps> = (props) => <PineTree size="sm" {...props} />;
const PineTreeLg: React.FC<ModelProps> = (props) => <PineTree size="lg" {...props} />;
const FlatTopTreeSm: React.FC<ModelProps> = (props) => <FlatTopTree size="sm" {...props} />;
const FlatTopTreeLg: React.FC<ModelProps> = (props) => <FlatTopTree size="lg" {...props} />;
const FlowerPurple: React.FC<ModelProps> = (props) => <Flower color="purple" {...props} />;
const FlowerRed: React.FC<ModelProps> = (props) => <Flower color="red" {...props} />;
const FlowerYellow: React.FC<ModelProps> = (props) => <Flower color="yellow" {...props} />;

/* ── Belt demo wrappers ───────────────────────────────────── */

const BeltStraightRunning: React.FC<ModelProps> = (props) => (
  <BeltSegment power="running" content="filled" {...props} />
);

const BeltStraightStopped: React.FC<ModelProps> = (props) => (
  <BeltSegment power="stopped" content="filled" {...props} />
);

const BeltCurveDemo: React.FC<ModelProps> = (props) => (
  <BeltCurve power="running" {...props} />
);

/** Small ore nugget for belt demo */
function OreNugget() {
  return (
    <mesh>
      <boxGeometry args={[0.08, 0.06, 0.08]} />
      <meshStandardMaterial color="#e8945a" roughness={0.55} metalness={0} />
    </mesh>
  );
}

const CHAIN_SEGMENTS: ChainSegment[] = [
  { key: "s1", type: "straight", position: [-1, 0, 0.5], rotationY: 0, pathLength: 1 },
  { key: "s2", type: "curve", position: [0, 0, 0.5], rotationY: 0, pathLength: CURVE_ARC_LENGTH },
  { key: "s3", type: "straight", position: [0, 0, -0.5], rotationY: Math.PI / 2, pathLength: 1 },
];

const CHAIN_ITEMS: ChainItem[] = Array.from({ length: 6 }, (_, i) => ({
  id: `ore-${i}`,
  progress: i / 6,
  node: <OreNugget />,
  heightOffset: 0.06,
}));

const BeltChainDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <BeltChain
      segments={CHAIN_SEGMENTS}
      items={CHAIN_ITEMS}
      power="running"
      content="filled"
      loop
    />
  </group>
);

/* ── Data ──────────────────────────────────────────────────── */

const SECTIONS: Section[] = [
  {
    label: "Ultimate Space Kit",
    entries: [
      { kind: "character", name: "Barbara (Bee) — Run", characterName: "Barbara", targetHeight: 0.45, animate: "Run", roam: true },
      { kind: "character", name: "Fernando (Flamingo) — Idle", characterName: "Fernando", targetHeight: 0.45, animate: "Idle" },
      { kind: "character", name: "Finn (Frog) — Wave", characterName: "Finn", targetHeight: 0.45, animate: "Wave" },
      { kind: "character", name: "Rae (Red Panda) — Idle", characterName: "Rae", targetHeight: 0.45, animate: "Idle" },
    ],
  },
  {
    label: "Game Models",
    entries: [
      { kind: "component", name: "Iron Node", component: IronNode },
      { kind: "component", name: "Copper Node", component: CopperNode },
      { kind: "component", name: "Smelter", component: Smelter },
      { kind: "component", name: "Processor", component: Processor },
      { kind: "component", name: "Burner", component: Burner },
      { kind: "component", name: "Belt (old)", component: ConveyorBelt },
      { kind: "component", name: "Belt Running", component: BeltStraightRunning },
      { kind: "component", name: "Belt Stopped", component: BeltStraightStopped },
      { kind: "component", name: "Belt Curve", component: BeltCurveDemo },
      { kind: "component", name: "Belt Chain", component: BeltChainDemo },
      { kind: "component", name: "Storage", component: ModularStorage, scale: 0.8 },
      { kind: "component", name: "Wind Turbine", component: WindTurbine },
      { kind: "component", name: "Rocket", component: Rocket, scale: 0.6 },
      { kind: "component", name: "Power Pole", component: PowerPole, scale: 0.7 },
      { kind: "component", name: "Miner", component: Miner, scale: 1.0 },
      { kind: "component", name: "MechLeg md", component: MechLegMd, scale: 2 },
    ],
  },
  {
    label: "Nature — Trees",
    entries: [
      { kind: "component", name: "Oak SM", component: OakTreeSm, scale: 2 },
      { kind: "component", name: "Oak MD", component: OakTree, scale: 1.5 },
      { kind: "component", name: "Oak LG", component: OakTreeLg, scale: 1.2 },
      { kind: "component", name: "Detailed SM", component: DetailedTreeSm, scale: 2 },
      { kind: "component", name: "Detailed MD", component: DetailedTree, scale: 1.5 },
      { kind: "component", name: "Detailed LG", component: DetailedTreeLg, scale: 1.2 },
      { kind: "component", name: "Pine SM", component: PineTreeSm, scale: 2 },
      { kind: "component", name: "Pine MD", component: PineTree, scale: 1.5 },
      { kind: "component", name: "Pine LG", component: PineTreeLg, scale: 1.2 },
      { kind: "component", name: "FlatTop SM", component: FlatTopTreeSm, scale: 2 },
      { kind: "component", name: "FlatTop MD", component: FlatTopTree, scale: 1.5 },
      { kind: "component", name: "FlatTop LG", component: FlatTopTreeLg, scale: 1.2 },
    ],
  },
  {
    label: "Nature — Ground",
    entries: [
      { kind: "component", name: "Bush", component: Bush, scale: 2.5 },
      { kind: "component", name: "Flower (Purple)", component: FlowerPurple, scale: 3 },
      { kind: "component", name: "Flower (Red)", component: FlowerRed, scale: 3 },
      { kind: "component", name: "Flower (Yellow)", component: FlowerYellow, scale: 3 },
      { kind: "component", name: "Grass Clump", component: GrassClump, scale: 3 },
      { kind: "component", name: "Rock", component: Rock, scale: 2.5 },
      { kind: "component", name: "Campfire", component: Campfire, scale: 3 },
      { kind: "component", name: "Tree Stump", component: TreeStump, scale: 3 },
    ],
  },
  {
    label: "GLB References",
    entries: [
      { kind: "gltf", name: "Miner (glb)", path: "/models/miner.glb" },
      { kind: "gltf", name: "Burner (glb)", path: "/models/burner.glb" },
      { kind: "gltf", name: "Coal Power (glb)", path: "/models/coal-power.glb" },
    ],
  },
];

const COLS = 5;
const SPACING = 2.8;
const TARGET_HEIGHT = 1.2;

/* ── Shared geometry ───────────────────────────────────────── */

const pedestalBase = new CylinderGeometry(0.72, 0.78, 0.1, 12);
const pedestalRing = new CylinderGeometry(0.68, 0.72, 0.02, 12);

/* ── Styles ────────────────────────────────────────────────── */

const labelStyle: React.CSSProperties = {
  color: "#e8d8c8",
  fontSize: "11px",
  fontFamily: "system-ui, sans-serif",
  textAlign: "center",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  textShadow: "0 1px 4px rgba(0,0,0,0.8)",
};

const sectionLabelStyle: React.CSSProperties = {
  color: "#7dd3fc",
  fontSize: "13px",
  fontFamily: "system-ui, sans-serif",
  fontWeight: 600,
  whiteSpace: "nowrap",
  pointerEvents: "none",
  textShadow: "0 1px 6px rgba(0,0,0,0.9)",
};

/* ── Auto-scale: measures after mount, then applies ────────── */

function useAutoScale(ref: React.RefObject<Group | null>, dep: Object3D, targetHeight = TARGET_HEIGHT) {
  useLayoutEffect(() => {
    const group = ref.current;
    if (!group) return;

    // Reset for measurement
    group.scale.setScalar(1);
    group.position.set(0, 0, 0);
    group.updateWorldMatrix(true, true);

    // Compute bounds from raw vertex positions — reliable for skinned meshes
    // where Box3.setFromObject gives wrong results before skeleton update
    const box = new Box3();
    const v = new Vector3();
    group.traverse((child: any) => {
      if (!child.isMesh || !child.geometry) return;
      const pos = child.geometry.getAttribute("position");
      if (!pos) return;
      for (let i = 0; i < pos.count; i++) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        v.applyMatrix4(child.matrixWorld);
        box.expandByPoint(v);
      }
    });

    if (box.isEmpty()) return;
    const size = new Vector3();
    box.getSize(size);
    if (size.y < 0.001) return;

    const s = targetHeight / size.y;
    group.scale.setScalar(s);
    group.position.y = -box.min.y * s;
  }, [dep, targetHeight]);
}

/* ── GLTF model: SkeletonUtils.clone for skinned meshes ──── */

function GltfModel({
  path,
  targetHeight,
  animate,
  roam,
}: {
  path: string;
  targetHeight?: number;
  animate?: string | string[];
  roam?: boolean;
}) {
  const { scene, animations } = useGLTF(path);
  const groupRef = useRef<Group>(null);
  const mixerRef = useRef<AnimationMixer | null>(null);

  const cloned = useMemo(() => {
    const c = skeletonClone(scene) as Group;
    const toRemove: Object3D[] = [];
    c.traverse((child) => {
      if (child.name === "Pistol") toRemove.push(child);
    });
    for (const obj of toRemove) obj.removeFromParent();
    return c;
  }, [scene]);
  useAutoScale(groupRef, cloned, targetHeight);

  // Animation setup — supports single loop or ordered sequence with crossfade
  const prevActionRef = useRef<AnimationAction | null>(null);
  const CROSSFADE = 0.25;

  useEffect(() => {
    if (!animate || animations.length === 0) return;

    const mixer = new AnimationMixer(cloned);
    mixerRef.current = mixer;

    const names = Array.isArray(animate) ? animate : [animate];
    let onFinished: (() => void) | null = null;

    if (names.length === 1) {
      const clip = animations.find((a) => a.name === names[0]);
      if (clip) {
        const action = mixer.clipAction(clip);
        action.play();
        prevActionRef.current = action;
      }
    } else {
      let idx = 0;
      const playAt = (i: number) => {
        const clip = animations.find((a) => a.name === names[i]);
        if (!clip) return;
        const action = mixer.clipAction(clip);
        action.reset();
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = false;
        if (prevActionRef.current && prevActionRef.current !== action) {
          action.crossFadeFrom(prevActionRef.current, CROSSFADE, true);
        }
        action.play();
        prevActionRef.current = action;
      };
      onFinished = () => {
        idx = (idx + 1) % names.length;
        playAt(idx);
      };
      mixer.addEventListener("finished", onFinished);
      playAt(0);
    }

    return () => {
      if (onFinished) mixer.removeEventListener("finished", onFinished);
      mixer.stopAllAction();
      prevActionRef.current = null;
      mixerRef.current = null;
    };
  }, [cloned, animations, animate]);

  // Roaming state — smooth random walk within pedestal bounds
  const roamState = useRef({ tx: 0, tz: 0, cx: 0, cz: 0, targetRot: 0 });

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);

    if (!roam || !groupRef.current) return;
    const st = roamState.current;
    const RADIUS = 0.5;
    const SPEED = 0.35;
    const ROT_SPEED = 8; // radians/sec damping factor
    const dx = st.tx - st.cx;
    const dz = st.tz - st.cz;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.05) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * RADIUS;
      st.tx = Math.cos(a) * r;
      st.tz = Math.sin(a) * r;
    } else {
      const step = Math.min(SPEED * delta, dist);
      st.cx += (dx / dist) * step;
      st.cz += (dz / dist) * step;
      st.targetRot = Math.atan2(dx, dz);
    }

    // Smooth rotation — lerp via shortest arc
    let diff = st.targetRot - cloned.rotation.y;
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    cloned.rotation.y += diff * MathUtils.clamp(ROT_SPEED * delta, 0, 1);

    const s = groupRef.current.scale.x;
    if (s > 0) {
      cloned.position.x = st.cx / s;
      cloned.position.z = st.cz / s;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  );
}

/* ── Component model (procedural geometry) ─────────────────── */

function ComponentModel({ entry }: { entry: ComponentEntry }) {
  const Component = entry.component;
  return (
    <group scale={entry.scale ?? 1}>
      <Component />
    </group>
  );
}

/* ── Slot ──────────────────────────────────────────────────── */

function Slot({ x, z, entry }: { x: number; z: number; entry: Entry }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.05, 0]} geometry={pedestalBase}>
        <meshStandardMaterial color={COLORS.pedestal} {...MAT} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.1, 0]} geometry={pedestalRing}>
        <meshStandardMaterial color={COLORS.pedestalEdge} {...MAT} roughness={0.6} />
      </mesh>

      <Html position={[0, -0.1, 0.95]} center style={labelStyle}>
        {entry.name}
      </Html>

      <group position={[0, 0.15, 0]}>
        <Suspense fallback={null}>
          {entry.kind === "character" ? (
            <Character name={entry.characterName} targetHeight={entry.targetHeight} animation={entry.animate} roam={entry.roam} />
          ) : entry.kind === "gltf" ? (
            <GltfModel path={entry.path} targetHeight={entry.targetHeight} animate={entry.animate} roam={entry.roam} />
          ) : (
            <ComponentModel entry={entry} />
          )}
        </Suspense>
      </group>
    </group>
  );
}

/* ── Main viewer ───────────────────────────────────────────── */

export function CharacterViewer() {
  const items: ({ type: "section"; label: string; row: number } | { type: "entry"; entry: Entry; col: number; row: number })[] = [];
  let currentRow = 0;

  for (const section of SECTIONS) {
    items.push({ type: "section", label: section.label, row: currentRow });
    currentRow++;
    for (const [i, entry] of section.entries.entries()) {
      const col = i % COLS;
      const row = currentRow + Math.floor(i / COLS);
      items.push({ type: "entry", entry, col, row });
    }
    currentRow += Math.ceil(section.entries.length / COLS);
  }

  const totalRows = currentRow;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[((COLS - 1) * SPACING) / 2, -0.01, (totalRows * SPACING) / 2]}>
        <planeGeometry args={[COLS * SPACING + 4, totalRows * SPACING + 4]} />
        <meshStandardMaterial color={COLORS.ground} roughness={0.85} />
      </mesh>

      {items.map((item) => {
        if (item.type === "section") {
          const z = item.row * SPACING;
          const x = ((COLS - 1) * SPACING) / 2;
          return (
            <group key={item.label} position={[x, 0, z]}>
              <Html position={[0, 0.3, 0]} center style={sectionLabelStyle}>
                {item.label}
              </Html>
            </group>
          );
        }
        return (
          <Slot
            key={item.entry.name}
            x={item.col * SPACING}
            z={item.row * SPACING}
            entry={item.entry}
          />
        );
      })}
    </group>
  );
}
