import { Html } from "@react-three/drei";
import { Suspense } from "react";
import { CylinderGeometry } from "three";
import type { ChainItem, ChainSegment } from "../models";
import {
  BeltChain,
  BeltCurve,
  BeltSegment,
  DirectorVoss,
  MechLeg,
  Merger,
  Miner,
  ModularStorage,
  NODE_MINER_OFFSET,
  PowerPole,
  ResourceNode,
  Rocket,
  Splitter,
  WindTurbine,
  WIPSign,
} from "../models";
import { CURVE_ARC_LENGTH, getBeltLoopItemCount } from "../models/belt";
import {
  AntennaModule,
  BiomassBurner,
  Body as BuildingBody,
  Foundation as BuildingFoundation,
  ChimneyStack,
  ContainerStorage,
  DrillHead,
  HeatSinkArray,
  IndustrialSmelter,
  OreSmelter,
  Portal,
  PowerUnit,
  ProcessorUnit,
  SideLamp,
  SidePanel,
  SidePipe,
  SideTank,
  SideVent,
  SortingFrame,
  TankCluster,
  TurbinePlate,
} from "../models/building";
import { Character, type CharacterName } from "../models/Character";
import { COLORS, MAT, type ModelProps } from "../models/colors";

/* ── Types ─────────────────────────────────────────────────── */

interface CharacterEntry {
  kind: "character";
  name: string;
  characterName: CharacterName;
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

type Entry = CharacterEntry | ComponentEntry;

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

/* ── ResourceNode variants for showcase ──────────────────── */
const IronImpure: React.FC<ModelProps> = (props) => (
  <ResourceNode resource="iron" purity="impure" {...props} />
);
const IronNormal: React.FC<ModelProps> = (props) => (
  <ResourceNode resource="iron" purity="normal" {...props} />
);
const IronPure: React.FC<ModelProps> = (props) => (
  <ResourceNode resource="iron" purity="pure" {...props} />
);
const CopperImpure: React.FC<ModelProps> = (props) => (
  <ResourceNode resource="copper" purity="impure" {...props} />
);
const CopperNormal: React.FC<ModelProps> = (props) => (
  <ResourceNode resource="copper" purity="normal" {...props} />
);
const CopperPure: React.FC<ModelProps> = (props) => (
  <ResourceNode resource="copper" purity="pure" {...props} />
);
const MinerOnImpure: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <ResourceNode resource="iron" purity="impure" />
    <Miner nodeHeight={NODE_MINER_OFFSET.impure} />
  </group>
);
const MinerOnNormal: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <ResourceNode resource="iron" purity="normal" />
    <Miner nodeHeight={NODE_MINER_OFFSET.normal} />
  </group>
);
const MinerOnPure: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <ResourceNode resource="iron" purity="pure" />
    <Miner nodeHeight={NODE_MINER_OFFSET.pure} />
  </group>
);

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
  {
    key: "s1",
    type: "straight",
    position: [-1, 0, 0.5],
    rotationY: 0,
    pathLength: 1,
  },
  {
    key: "s2",
    type: "curve",
    position: [0, 0, 0.5],
    rotationY: 0,
    pathLength: CURVE_ARC_LENGTH,
  },
  {
    key: "s3",
    type: "straight",
    position: [0, 0, -0.5],
    rotationY: Math.PI / 2,
    pathLength: 1,
  },
];

const CHAIN_TOTAL_LENGTH = CHAIN_SEGMENTS.reduce(
  (total, segment) => total + segment.pathLength,
  0,
);
const CHAIN_ITEM_COUNT = getBeltLoopItemCount(CHAIN_TOTAL_LENGTH);

const CHAIN_ITEMS: ChainItem[] = Array.from(
  { length: CHAIN_ITEM_COUNT },
  (_, i) => ({
    id: `ore-${i}`,
    progress: i / CHAIN_ITEM_COUNT,
    node: <OreNugget />,
    heightOffset: 0.06,
  }),
);

function createBeltChainDemo(ratePerMinute: number): React.FC<ModelProps> {
  return function BeltChainRateDemo(props) {
    return (
      <group {...props}>
        <BeltChain
          segments={CHAIN_SEGMENTS}
          items={CHAIN_ITEMS}
          power="running"
          content="filled"
          ratePerMinute={ratePerMinute}
          loop
        />
      </group>
    );
  };
}

const BeltChain60Demo = createBeltChainDemo(60);
const BeltChain120Demo = createBeltChainDemo(120);
const BeltChain240Demo = createBeltChainDemo(240);

/* ── Modular Building wrappers ──────────────────────────────── */

const FoundationSmDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <group position={[0, 0.13, 0]}>
      <BuildingFoundation legSize="sm" />
    </group>
  </group>
);
const FoundationMdDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <group position={[0, 0.21, 0]}>
      <BuildingFoundation legSize="md" />
    </group>
  </group>
);
const BodyShortDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <group position={[0, 0.1, 0]}>
      <BuildingBody height="short" />
    </group>
  </group>
);
const BodyDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <group position={[0, 0.134, 0]}>
      <BuildingBody />
    </group>
  </group>
);
const BodyTallDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <group position={[0, 0.2, 0]}>
      <BuildingBody height="tall" />
    </group>
  </group>
);
const PowerUnitDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <PowerUnit />
  </group>
);
const AntennaModuleDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <AntennaModule />
  </group>
);
const ChimneyStackDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <ChimneyStack />
  </group>
);
const TurbinePlateDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <TurbinePlate />
  </group>
);
const DrillHeadDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <DrillHead />
  </group>
);
const TankClusterDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <TankCluster />
  </group>
);
const HeatSinkArrayDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <HeatSinkArray />
  </group>
);
const SortingFrameDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <SortingFrame />
  </group>
);
const SideTankDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <SideTank />
  </group>
);
const SideVentDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <SideVent />
  </group>
);
const SidePipeDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <SidePipe />
  </group>
);
const SidePanelDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <SidePanel />
  </group>
);
const SideLampDemo: React.FC<ModelProps> = (props) => (
  <group {...props}>
    <SideLamp />
  </group>
);

/* ── Connected Factory Demo ─────────────────────────────────── */

/**
 * Small ore cargo item for belt demo (cube)
 */
function FactoryOreCargo() {
  return (
    <mesh rotation={[0.3, 0.5, 0]}>
      <octahedronGeometry args={[0.1, 0]} />
      <meshStandardMaterial color="#e8945a" roughness={0.5} metalness={0} />
    </mesh>
  );
}

/**
 * Small ingot bar for belt demo
 */
function FactoryIngotCargo() {
  return (
    <mesh>
      <boxGeometry args={[0.18, 0.08, 0.1]} />
      <meshStandardMaterial color="#b0b4ba" roughness={0.4} metalness={0.15} />
    </mesh>
  );
}

/**
 * Processed item (teal barrel) for belt demo
 */
function FactoryProcessedCargo() {
  return (
    <mesh>
      <cylinderGeometry args={[0.06, 0.06, 0.16, 8]} />
      <meshStandardMaterial color="#5ec4b6" roughness={0.45} metalness={0} />
    </mesh>
  );
}

/*
 * Factory layout (top-down, each unit = 1 grid tile):
 *
 *                              [Miner B] at (0, -3)
 *                                   |
 *  z=-2:                          belt
 *                                   |
 *  z=-1:                    curve → belt east
 *                                          \
 *  z=0:  [Miner A] ─ belt ─ belt ─ [Merger] ─ belt ─ belt ─ [Smelter] ─ belt ─ belt ─ [Splitter] ─ belt ─ belt ─ [Processor A]
 *            -4       -3      -2       0         1       2        4         5       6        8         9      10        12
 *                                                                                           |
 *  z=1:                                                                                   belt
 *  z=2:                                                                            curve → belt east → [Processor B]
 *
 *  [Processor A] → belt ─ belt ─ curve ↓
 *                                        belt ─ belt → [ModularStorage]
 */

/* ── Belt chain definitions ── */
/*
 * INVERTED U LAYOUT — entire factory flows as one U path:
 *
 *                    Smelter ─── Splitter ─── Processor
 *                       ↑                        ↓
 *        [left leg]     │                        │    [right leg]
 *                       │                        │
 *                    Miner                    Storage
 *                 (bottom left)            (bottom right)
 *
 * Flow: Miner → UP left leg → across top → DOWN right leg → Storage
 */

/*
 * FULL INVERTED U — one continuous belt chain with curves at corners:
 *
 * Miner(0,8) → UP left leg → CURVE at top-left → across top bar →
 * CURVE at top-right → DOWN right leg → Storage(10,8)
 *
 * Both corners are RIGHT turns (clockwise when viewed from above).
 */
const FC_INVERTED_U: ChainSegment[] = [
  // LEFT LEG - going north (up) from Miner at (0, 8)
  // rotationY = π/2 means: input at south (z+0.5), output at north (z-0.5)
  { key: "u-0", type: "straight", position: [0, 0, 7], rotationY: Math.PI / 2, pathLength: 1 },
  { key: "u-1", type: "straight", position: [0, 0, 6], rotationY: Math.PI / 2, pathLength: 1 },
  { key: "u-2", type: "straight", position: [0, 0, 5], rotationY: Math.PI / 2, pathLength: 1 },
  { key: "u-3", type: "straight", position: [0, 0, 4], rotationY: Math.PI / 2, pathLength: 1 },
  { key: "u-4", type: "straight", position: [0, 0, 3], rotationY: Math.PI / 2, pathLength: 1 },
  { key: "u-5", type: "straight", position: [0, 0, 2], rotationY: Math.PI / 2, pathLength: 1 },
  { key: "u-6", type: "straight", position: [0, 0, 1], rotationY: Math.PI / 2, pathLength: 1 },

  // TOP-LEFT CURVE - input from south (left leg), output to east (top bar)
  // turn=right with rotationY=π/2: south→east
  { key: "u-7", type: "curve", position: [0, 0, 0], rotationY: Math.PI / 2, pathLength: CURVE_ARC_LENGTH, turn: "right" },

  // TOP BAR - going east across the top
  { key: "u-8", type: "straight", position: [1, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "u-9", type: "straight", position: [2, 0, 0], rotationY: 0, pathLength: 1 },
  // Smelter at x=3
  { key: "u-10", type: "straight", position: [4, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "u-11", type: "straight", position: [5, 0, 0], rotationY: 0, pathLength: 1 },
  // Continue across to curve (Processor at x=6)
  { key: "u-12", type: "straight", position: [7, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "u-13", type: "straight", position: [8, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "u-14", type: "straight", position: [9, 0, 0], rotationY: 0, pathLength: 1 },

  // TOP-RIGHT CURVE - input from west, output south (right turn)
  // turn=right with rotationY=0: west→south
  { key: "u-15", type: "curve", position: [10, 0, 0], rotationY: 0, pathLength: CURVE_ARC_LENGTH, turn: "right" },

  // RIGHT LEG - going south (down) to Storage at (10, 8)
  // rotationY = -π/2 means: input at north (z-0.5), output at south (z+0.5)
  { key: "u-16", type: "straight", position: [10, 0, 1], rotationY: -Math.PI / 2, pathLength: 1 },
  { key: "u-17", type: "straight", position: [10, 0, 2], rotationY: -Math.PI / 2, pathLength: 1 },
  { key: "u-18", type: "straight", position: [10, 0, 3], rotationY: -Math.PI / 2, pathLength: 1 },
  { key: "u-19", type: "straight", position: [10, 0, 4], rotationY: -Math.PI / 2, pathLength: 1 },
  { key: "u-20", type: "straight", position: [10, 0, 5], rotationY: -Math.PI / 2, pathLength: 1 },
  { key: "u-21", type: "straight", position: [10, 0, 6], rotationY: -Math.PI / 2, pathLength: 1 },
  { key: "u-22", type: "straight", position: [10, 0, 7], rotationY: -Math.PI / 2, pathLength: 1 },
];

const FC_INVERTED_U_ITEMS: ChainItem[] = [
  // Left leg - ore going up
  { id: "u-0", progress: 0.2, node: <FactoryOreCargo />, heightOffset: 0.08 },
  { id: "u-2", progress: 0.5, node: <FactoryOreCargo />, heightOffset: 0.08 },
  { id: "u-4", progress: 0.8, node: <FactoryOreCargo />, heightOffset: 0.08 },
  // Top bar - ingots going across (after smelter)
  { id: "u-9", progress: 0.3, node: <FactoryIngotCargo />, heightOffset: 0.08 },
  { id: "u-11", progress: 0.6, node: <FactoryIngotCargo />, heightOffset: 0.08 },
  { id: "u-13", progress: 0.4, node: <FactoryIngotCargo />, heightOffset: 0.08 },
  // Right leg - processed going down (after processor)
  { id: "u-17", progress: 0.3, node: <FactoryProcessedCargo />, heightOffset: 0.08 },
  { id: "u-19", progress: 0.6, node: <FactoryProcessedCargo />, heightOffset: 0.08 },
  { id: "u-21", progress: 0.9, node: <FactoryProcessedCargo />, heightOffset: 0.08 },
];

/**
 * Connected factory demo — optimized Tier 1 production line:
 *
 * 2 Miners → Merger → Smelter → Splitter → 2 Processors → ModularStorage
 *
 * Shows every new building type (Splitter, Merger) with belt-width
 * port docks, belt end-caps, and animated item flow.
 */
/*
 * Building scale factors — buildings were designed at decorative scale,
 * need 2× to be clearly larger than belt width (0.85).
 *
 *   Smelter:   ø0.62 → ×2.0 = ø1.24 (wider than belt ✓)
 *   Processor: ø0.72 → ×1.8 = ø1.30 (wider than belt ✓)
 *   Burner:    ø0.66 → ×2.0 = ø1.32 (wider than belt ✓)
 *   Miner:     ø0.70 → ×1.8 = ø1.26 (wider than belt ✓)
 *   Splitter:  ø0.96 → ×1.3 = ø1.25 (wider than belt ✓)
 *   Merger:    ø0.96 → ×1.3 = ø1.25 (wider than belt ✓)
 *   Storage:   ø2.10 → ×0.7 = ø1.47 (reasonable footprint)
 */
const S_SMELTER = 2.0;
const S_PROCESSOR = 1.8;
const S_BURNER = 2.0;
const S_MINER = 1.8;
const S_SPLITTER = 1.3;
const S_MERGER = 1.3;
const S_STORAGE = 0.7;

function ConnectedFactory(props: ModelProps) {
  return (
    <group {...props}>
      {/* ═══════════════════════════════════════════
          BUILDINGS — Full Inverted U Layout

          Miner(0,8) → UP → Smelter(3,0) → Splitter(6,0) → Processor(9,0) → DOWN → Storage(10,8)

          Flow follows the inverted U path with curved corners.
          ═══════════════════════════════════════════ */}

      {/* ─── LEFT LEG (bottom) ─── */}

      {/* Miner at bottom-left of U (0, 8) */}
      <group position={[0, 0, 8]} scale={S_MINER}>
        <ResourceNode resource="iron" purity="impure" />
        <Miner status="green" nodeHeight={NODE_MINER_OFFSET.impure} />
      </group>

      {/* ─── TOP BAR ─── */}

      {/* Smelter at x=3 (in the flow) */}
      <group position={[3, 0, 0]} scale={S_SMELTER}>
        <OreSmelter status="green" />
      </group>

      {/* Processor at x=6 (in the flow) */}
      <group position={[6, 0, 0]} scale={S_PROCESSOR}>
        <ProcessorUnit status="green" />
      </group>

      {/* ─── RIGHT LEG (bottom) ─── */}

      {/* Storage at bottom-right of U (10, 8) */}
      <group position={[10, 0, 8]} scale={S_STORAGE}>
        <ModularStorage status="green" />
      </group>

      {/* ═══════════════════════════════════════════
          BELT CHAIN — One continuous inverted U with curves
          ═══════════════════════════════════════════ */}

      <BeltChain
        segments={FC_INVERTED_U}
        items={FC_INVERTED_U_ITEMS}
        power="running" content="filled" ratePerMinute={60} endCaps loop
      />

      {/* ═══════════════════════════════════════════
          SCENERY / POWER — inside the U
          ═══════════════════════════════════════════ */}

      <group position={[5, 0, 4]} scale={S_BURNER}>
        <BiomassBurner status="green" />
      </group>
      <WindTurbine position={[5, 0, 6]} status="green" />
      <PowerPole position={[2, 0, 4]} />
      <PowerPole position={[5, 0, -1.5]} />
      <PowerPole position={[8, 0, 4]} />
    </group>
  );
}

/* ── Data ──────────────────────────────────────────────────── */

const SECTIONS: Section[] = [
  {
    label: "Ultimate Space Kit",
    entries: [
      {
        kind: "character",
        name: "Barbara (Bee) — Run",
        characterName: "Barbara",
        targetHeight: 0.45,
        animate: "Run",
        roam: true,
      },
      {
        kind: "character",
        name: "Fernando (Flamingo) — Idle",
        characterName: "Fernando",
        targetHeight: 0.45,
        animate: "Idle",
      },
      {
        kind: "character",
        name: "Finn (Frog) — Wave",
        characterName: "Finn",
        targetHeight: 0.45,
        animate: "Wave",
      },
      {
        kind: "character",
        name: "Rae (Red Panda) — Idle",
        characterName: "Rae",
        targetHeight: 0.45,
        animate: "Idle",
      },
    ],
  },
  {
    label: "Resource Nodes",
    entries: [
      {
        kind: "component",
        name: "Iron Impure",
        component: IronImpure,
        scale: 2.5,
      },
      {
        kind: "component",
        name: "Iron Normal",
        component: IronNormal,
        scale: 2.5,
      },
      { kind: "component", name: "Iron Pure", component: IronPure, scale: 2 },
      {
        kind: "component",
        name: "Copper Impure",
        component: CopperImpure,
        scale: 2.5,
      },
      {
        kind: "component",
        name: "Copper Normal",
        component: CopperNormal,
        scale: 2.5,
      },
      {
        kind: "component",
        name: "Copper Pure",
        component: CopperPure,
        scale: 2,
      },
      {
        kind: "component",
        name: "Miner + Impure",
        component: MinerOnImpure,
        scale: 0.85,
      },
      {
        kind: "component",
        name: "Miner + Normal",
        component: MinerOnNormal,
        scale: 0.85,
      },
      {
        kind: "component",
        name: "Miner + Pure",
        component: MinerOnPure,
        scale: 0.85,
      },
    ],
  },
  {
    label: "Game Models",
    entries: [
      {
        kind: "component",
        name: "Director Voss",
        component: () => <DirectorVoss />,
        scale: 1.5,
      },
      {
        kind: "component",
        name: "Smelter POC",
        component: () => <IndustrialSmelter status="green" />,
        scale: 1.3,
      },
      {
        kind: "component",
        name: "Smelter",
        component: () => <OreSmelter status="green" />,
        scale: 1.3,
      },
      {
        kind: "component",
        name: "Processor",
        component: () => <ProcessorUnit status="green" />,
        scale: 1.3,
      },
      {
        kind: "component",
        name: "Burner",
        component: () => <BiomassBurner status="green" />,
        scale: 1.3,
      },
      {
        kind: "component",
        name: "Portal Entry",
        component: () => <Portal type="entry" active />,
        scale: 1,
      },
      {
        kind: "component",
        name: "Portal Exit",
        component: () => <Portal type="exit" active />,
        scale: 1,
      },
      {
        kind: "component",
        name: "Belt Running",
        component: BeltStraightRunning,
      },
      {
        kind: "component",
        name: "Belt Stopped",
        component: BeltStraightStopped,
      },
      { kind: "component", name: "Belt Curve", component: BeltCurveDemo },
      {
        kind: "component",
        name: "Belt Chain 60/min",
        component: BeltChain60Demo,
      },
      {
        kind: "component",
        name: "Belt Chain 120/min",
        component: BeltChain120Demo,
      },
      {
        kind: "component",
        name: "Belt Chain 240/min",
        component: BeltChain240Demo,
      },
      {
        kind: "component",
        name: "Storage",
        component: ModularStorage,
        scale: 0.8,
      },
      { kind: "component", name: "Wind Turbine", component: WindTurbine },
      { kind: "component", name: "Rocket", component: Rocket, scale: 0.6 },
      {
        kind: "component",
        name: "Power Pole",
        component: PowerPole,
        scale: 0.7,
      },
      { kind: "component", name: "Miner", component: Miner, scale: 1.0 },
      {
        kind: "component",
        name: "Splitter",
        component: () => <Splitter status="green" />,
        scale: 1.3,
      },
      {
        kind: "component",
        name: "Merger",
        component: () => <Merger status="green" />,
        scale: 1.3,
      },
      {
        kind: "component",
        name: "Container",
        component: () => <ContainerStorage />,
        scale: 1.3,
      },
      { kind: "component", name: "MechLeg md", component: MechLegMd, scale: 2 },
      { kind: "component", name: "WIP Sign", component: WIPSign, scale: 2.5 },
    ],
  },
  /* Connected Factory is rendered separately — not in slots */
  {
    label: "Modular Building — Parts",
    entries: [
      {
        kind: "component",
        name: "Foundation (sm)",
        component: FoundationSmDemo,
        scale: 2.5,
      },
      {
        kind: "component",
        name: "Foundation (md)",
        component: FoundationMdDemo,
        scale: 2,
      },
      {
        kind: "component",
        name: "Body (short)",
        component: BodyShortDemo,
        scale: 2.5,
      },
      {
        kind: "component",
        name: "Body (standard)",
        component: BodyDemo,
        scale: 2.5,
      },
      {
        kind: "component",
        name: "Body (tall)",
        component: BodyTallDemo,
        scale: 2,
      },
      {
        kind: "component",
        name: "Power Unit",
        component: PowerUnitDemo,
        scale: 4,
      },
      {
        kind: "component",
        name: "Antenna Module",
        component: AntennaModuleDemo,
        scale: 4,
      },
      {
        kind: "component",
        name: "Chimney Stack",
        component: ChimneyStackDemo,
        scale: 4,
      },
      {
        kind: "component",
        name: "Turbine Plate",
        component: TurbinePlateDemo,
        scale: 4,
      },
      {
        kind: "component",
        name: "Drill Head",
        component: DrillHeadDemo,
        scale: 3.5,
      },
      {
        kind: "component",
        name: "Tank Cluster",
        component: TankClusterDemo,
        scale: 4,
      },
      {
        kind: "component",
        name: "Heat Sink Array",
        component: HeatSinkArrayDemo,
        scale: 4,
      },
      {
        kind: "component",
        name: "Sorting Frame",
        component: SortingFrameDemo,
        scale: 4,
      },
      {
        kind: "component",
        name: "Side Tank",
        component: SideTankDemo,
        scale: 8,
      },
      {
        kind: "component",
        name: "Side Vent",
        component: SideVentDemo,
        scale: 10,
      },
      {
        kind: "component",
        name: "Side Pipe",
        component: SidePipeDemo,
        scale: 8,
      },
      {
        kind: "component",
        name: "Side Panel",
        component: SidePanelDemo,
        scale: 10,
      },
      {
        kind: "component",
        name: "Side Lamp",
        component: SideLampDemo,
        scale: 12,
      },
    ],
  },
];

const COLS = 5;
const SPACING = 2.8;

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
        <meshStandardMaterial
          color={COLORS.pedestal}
          {...MAT}
          roughness={0.65}
        />
      </mesh>
      <mesh position={[0, 0.1, 0]} geometry={pedestalRing}>
        <meshStandardMaterial
          color={COLORS.pedestalEdge}
          {...MAT}
          roughness={0.6}
        />
      </mesh>

      <Html position={[0, -0.1, 0.95]} center style={labelStyle}>
        {entry.name}
      </Html>

      <group position={[0, 0.15, 0]}>
        <Suspense fallback={null}>
          {entry.kind === "character" ? (
            <Character
              name={entry.characterName}
              targetHeight={entry.targetHeight}
              animation={entry.animate}
              roam={entry.roam}
            />
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
  const visibleSections = SECTIONS.filter(
    (section) => section.label !== "Modular Building — Parts",
  );
  const items: (
    | { type: "section"; label: string; row: number }
    | { type: "entry"; entry: Entry; col: number; row: number }
  )[] = [];
  let currentRow = 0;

  for (const section of visibleSections) {
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
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[
          ((COLS - 1) * SPACING) / 2 + 1,
          -0.01,
          ((totalRows + 4) * SPACING) / 2,
        ]}
      >
        <planeGeometry
          args={[
            COLS * SPACING + 10,
            (totalRows + 4) * SPACING + 4,
          ]}
        />
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

      {/* ── Connected Factory — full-width section at the bottom ── */}
      <group position={[0, 0, (totalRows + 1) * SPACING]}>
        <Html
          position={[((COLS - 1) * SPACING) / 2, 0.3, 0]}
          center
          style={sectionLabelStyle}
        >
          Connected Factory
        </Html>
        <ConnectedFactory position={[0, 0, SPACING * 0.8]} />
      </group>
    </group>
  );
}
