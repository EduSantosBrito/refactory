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

/* Miner A(-5) → Merger(0): 4 straight tiles going east */
const FC_MINER_A: ChainSegment[] = [
  { key: "ma-0", type: "straight", position: [-4, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "ma-1", type: "straight", position: [-3, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "ma-2", type: "straight", position: [-2, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "ma-3", type: "straight", position: [-1, 0, 0], rotationY: 0, pathLength: 1 },
];
const FC_MINER_A_ITEMS: ChainItem[] = [
  { id: "ma-0", progress: 0.1, node: <FactoryOreCargo />, heightOffset: 0.08 },
  { id: "ma-1", progress: 0.35, node: <FactoryOreCargo />, heightOffset: 0.08 },
  { id: "ma-2", progress: 0.6, node: <FactoryOreCargo />, heightOffset: 0.08 },
  { id: "ma-3", progress: 0.85, node: <FactoryOreCargo />, heightOffset: 0.08 },
];

/*
 * Miner B → Merger: straight south, then curve east, then straight east.
 *
 * Miner B at (0, -3), output faces south (+Z) after rotation.
 * Belt goes south to (-1, -2), curves east-south at (0, -2)...
 *
 * Actually simpler: Miner B at (-1, -3) facing east (no rotation).
 * Belt goes east: (-1,-2) straight south...
 *
 * Let me use: Miner B at (0, -3), rotated -π/2 so output faces south.
 * Straight belt at (0, -2) going south (rotationY = -π/2).
 * Curve at (0, -1): needs to go from south→east.
 *   Default curve goes west→north (rotationY=0).
 *   To go south→east: input from south (-Z→+Z) = belt arriving from -Z.
 *   Rotate curve by π (180°): west→north becomes east→south... no.
 *
 *   Let me think: curve with rotationY = -π/2:
 *     west(-X) rotates to south(+Z), north(-Z) rotates to west(-X)
 *     So input is from south, output goes west. Wrong direction.
 *
 *   rotationY = π: west(-X) → east(+X), north(-Z) → south(+Z)
 *     Input from east, output goes south. Wrong.
 *
 *   rotationY = π/2: west(-X) → north(-Z), north(-Z) → east(+X)
 *     Input from north, output goes east. Nope...
 *
 *   I need: input from south (belt arrives going south = +Z direction),
 *   output toward east (+X). That means input faces south, output faces east.
 *
 *   Default curve: input faces west, output faces north.
 *   Need to rotate so: west→south, north→east.
 *   That's rotationY = -π/2 (CW 90°):
 *     west(-X) → south(+Z) ✓, north(-Z) → east... wait:
 *     CW 90° from top: +X→+Z, -X→-Z, +Z→-X, -Z→+X
 *     So west(-X) → -Z (north). Wrong.
 *
 *   Let me be more careful. Y rotation matrix (positive = CCW from top):
 *   rotY = θ:
 *     new_X =  cos(θ)·X + sin(θ)·Z
 *     new_Z = -sin(θ)·X + cos(θ)·Z
 *
 *   For rotY = -π/2 (CW 90°): cos=-0, sin=-1
 *     new_X = 0·X + (-1)·Z = -Z
 *     new_Z = -(-1)·X + 0·Z = X
 *   So: X→Z, Z→-X, -X→-Z, -Z→X
 *   west(-X) → -Z (north). north(-Z) → +X (east).
 *   Input from north, output east. I need input from SOUTH.
 *
 *   For rotY = π/2 (CCW 90°): cos=0, sin=1
 *     new_X = 0·X + 1·Z = Z
 *     new_Z = -1·X + 0·Z = -X
 *   So: X→-X... wait: X→Z, Z→-X... no:
 *   new_X = Z, new_Z = -X
 *   So: (1,0)→(0,-1), (0,1)→(1,0), (-1,0)→(0,1), (0,-1)→(-1,0)
 *   west(-X) → south(+Z)! north(-Z) → west(-X).
 *   Input from south, output goes west. Almost! Need output east.
 *
 *   For rotY = π: cos=-1, sin=0
 *     X→-X, Z→-Z
 *   west(-X) → east(+X). north(-Z) → south(+Z).
 *   Input from east, output south. Nope.
 *
 *   For rotY = 0: west input, north output. (default)
 *
 *   Hmm. None of these give south→east. The curve only does
 *   adjacent-face turns (90° between west and north). For south→east
 *   I need to go around the other way.
 *
 * Simplest alternative: just use straight belts for MinerB.
 * MinerB at (0, -2), output faces south. 1 straight belt going south.
 */

/* Miner B(0,-3) → Merger(0,0): 2 straight tiles going south */
const FC_MINER_B: ChainSegment[] = [
  { key: "mb-0", type: "straight", position: [0, 0, -2], rotationY: -Math.PI / 2, pathLength: 1 },
  { key: "mb-1", type: "straight", position: [0, 0, -1], rotationY: -Math.PI / 2, pathLength: 1 },
];
const FC_MINER_B_ITEMS: ChainItem[] = [
  { id: "mb-0", progress: 0.2, node: <FactoryOreCargo />, heightOffset: 0.08 },
  { id: "mb-1", progress: 0.7, node: <FactoryOreCargo />, heightOffset: 0.08 },
];

/* Merger(0) → Smelter(5): 4 straight tiles going east */
const FC_MERGE_SMELT: ChainSegment[] = [
  { key: "ms-0", type: "straight", position: [1, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "ms-1", type: "straight", position: [2, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "ms-2", type: "straight", position: [3, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "ms-3", type: "straight", position: [4, 0, 0], rotationY: 0, pathLength: 1 },
];
const FC_MERGE_SMELT_ITEMS: ChainItem[] = [
  { id: "ms-0", progress: 0.15, node: <FactoryOreCargo />, heightOffset: 0.08 },
  { id: "ms-1", progress: 0.55, node: <FactoryOreCargo />, heightOffset: 0.08 },
  { id: "ms-2", progress: 0.9, node: <FactoryOreCargo />, heightOffset: 0.08 },
];

/* Smelter(5) → Splitter(10): 4 straight tiles going east */
const FC_SMELT_SPLIT: ChainSegment[] = [
  { key: "ss-0", type: "straight", position: [6, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "ss-1", type: "straight", position: [7, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "ss-2", type: "straight", position: [8, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "ss-3", type: "straight", position: [9, 0, 0], rotationY: 0, pathLength: 1 },
];
const FC_SMELT_SPLIT_ITEMS: ChainItem[] = [
  { id: "ss-0", progress: 0.1, node: <FactoryIngotCargo />, heightOffset: 0.08 },
  { id: "ss-1", progress: 0.5, node: <FactoryIngotCargo />, heightOffset: 0.08 },
  { id: "ss-2", progress: 0.9, node: <FactoryIngotCargo />, heightOffset: 0.08 },
];

/* Splitter(10) east → Processor A(15): 4 straight tiles */
const FC_SPLIT_PROC_A: ChainSegment[] = [
  { key: "spa-0", type: "straight", position: [11, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "spa-1", type: "straight", position: [12, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "spa-2", type: "straight", position: [13, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "spa-3", type: "straight", position: [14, 0, 0], rotationY: 0, pathLength: 1 },
];
const FC_SPLIT_PROC_A_ITEMS: ChainItem[] = [
  { id: "spa-0", progress: 0.1, node: <FactoryIngotCargo />, heightOffset: 0.08 },
  { id: "spa-1", progress: 0.4, node: <FactoryIngotCargo />, heightOffset: 0.08 },
  { id: "spa-2", progress: 0.7, node: <FactoryIngotCargo />, heightOffset: 0.08 },
  { id: "spa-3", progress: 0.95, node: <FactoryIngotCargo />, heightOffset: 0.08 },
];

/*
 * Splitter south → curve east → Processor B:
 * Straight south at (8, 1), curve at (8, 2) turning east, straight east at (9, 2).
 *
 * Curve from south to east = input from north(-Z arriving +Z), output east(+X).
 * Default curve: input west(-X), output north(-Z).
 * rotationY = -π/2: west(-X) maps to +Z(south), north(-Z) maps to +X(east)... wait:
 *   CW 90° (rotY=-π/2): X→Z, Z→-X, so -X→-Z and -Z→X
 *   west(-X)→-Z=north. Nope.
 *
 * Actually for this curve I need the belt to come from the north (going south)
 * and exit east. The default curve arcs from west face to north face.
 * To make it arc from north face to east face, I need rotY = -π/2:
 *   Let me recheck: the curve pivot is at (-0.5, 0, -0.5) in local space.
 *   Input at west (-0.5, y, 0), output at north (0, y, -0.5).
 *
 *   With rotY = -π/2:
 *   Input local (-0.5, y, 0) → world: new_X = -Z = 0, new_Z = X = -0.5
 *   So input at (0+cx, y, -0.5+cz). That's on the north face of the tile.
 *
 *   Output local (0, y, -0.5) → world: new_X = -(-0.5) = 0.5, new_Z = 0
 *   So output at (0.5+cx, y, 0+cz). That's on the east face. ✓
 *
 * So curve at (8, 2) with rotY = -π/2: input from north, output east. Perfect.
 * Place it at (8, 2) so north input connects to belt at (8, 1) going south,
 * and east output connects to belt at (9, 2) going east.
 */
const FC_SPLIT_PROC_B: ChainSegment[] = [
  // Straight going south from splitter(10) at z=1
  { key: "spb-0", type: "straight", position: [10, 0, 1], rotationY: -Math.PI / 2, pathLength: 1 },
  // Straight going south at z=2
  { key: "spb-1", type: "straight", position: [10, 0, 2], rotationY: -Math.PI / 2, pathLength: 1 },
  // Curve: input from north, output east at (10, 3)
  { key: "spb-2", type: "curve", position: [10, 0, 3], rotationY: -Math.PI / 2, pathLength: CURVE_ARC_LENGTH },
  // Straight going east at (11, 3)
  { key: "spb-3", type: "straight", position: [11, 0, 3], rotationY: 0, pathLength: 1 },
];
const FC_SPLIT_PROC_B_ITEMS: ChainItem[] = [
  { id: "spb-0", progress: 0.1, node: <FactoryIngotCargo />, heightOffset: 0.08 },
  { id: "spb-1", progress: 0.4, node: <FactoryIngotCargo />, heightOffset: 0.08 },
  { id: "spb-2", progress: 0.7, node: <FactoryIngotCargo />, heightOffset: 0.08 },
  { id: "spb-3", progress: 0.95, node: <FactoryIngotCargo />, heightOffset: 0.08 },
];

/*
 * Processor A → curve south → belt → ModularStorage:
 * Straight east at (13, 0), curve east→south at (14, 0),
 * straight south at (14, 1), straight south at (14, 2).
 *
 * Curve from east to south: input from west(-X), output south(+Z).
 * Default curve: input west, output north.
 * rotY = π/2 (CCW 90°):
 *   -X → +Z(south). ✓  input from south... wait:
 *   Let me recompute:
 *   rotY = π/2: X→-Z, Z→X, -X→Z, -Z→-X
 *   Input local (-0.5,y,0) → (0, y, -0.5). That's the north face.
 *   Hmm that's input from north.
 *
 * Let me try rotY = 0 (default): input west, output north.
 *   Input from west at (-0.5, y, 0), output north at (0, y, -0.5).
 *   I need input from west (belt coming from Processor A going east),
 *   and output going south.
 *
 * I want west→south. Default is west→north.
 * rotY = π: west(-X)→east(+X), north(-Z)→south(+Z)
 *   Input from east, output south. Input wrong.
 *
 * Hmm, none of the 4 rotations give west→south directly because
 * the curve only turns one way (CCW when viewed from above).
 *
 * For west→south I'd need a CW turn. The BeltCurve geometry only
 * does one 90° arc direction. Let's just use all straight belts
 * for this run and save curves for the splitter branch.
 */

/* Processor A(15) → ModularStorage(20): 4 straight tiles east */
const FC_PROC_A_STORAGE: ChainSegment[] = [
  { key: "pas-0", type: "straight", position: [16, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "pas-1", type: "straight", position: [17, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "pas-2", type: "straight", position: [18, 0, 0], rotationY: 0, pathLength: 1 },
  { key: "pas-3", type: "straight", position: [19, 0, 0], rotationY: 0, pathLength: 1 },
];
const FC_PROC_A_STORAGE_ITEMS: ChainItem[] = [
  { id: "pas-0", progress: 0.08, node: <FactoryProcessedCargo />, heightOffset: 0.08 },
  { id: "pas-1", progress: 0.4, node: <FactoryProcessedCargo />, heightOffset: 0.08 },
  { id: "pas-2", progress: 0.72, node: <FactoryProcessedCargo />, heightOffset: 0.08 },
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
          BUILDINGS — scaled so they're bigger than belts
          ═══════════════════════════════════════════ */}

      {/* Miner A at (-5, 0) */}
      <group position={[-5, 0, 0]} scale={S_MINER}>
        <ResourceNode resource="iron" purity="impure" />
        <Miner status="green" nodeHeight={NODE_MINER_OFFSET.impure} />
      </group>

      {/* Miner B at (0, -3) — feeding south into merger */}
      <group position={[0, 0, -3]} scale={S_MINER} rotation={[0, -Math.PI / 2, 0]}>
        <ResourceNode resource="iron" purity="impure" />
        <Miner status="green" nodeHeight={NODE_MINER_OFFSET.impure} />
      </group>

      {/* Merger at (0, 0) */}
      <group position={[0, 0, 0]} scale={S_MERGER}>
        <Merger status="green" />
      </group>

      {/* Smelter at (5, 0) */}
      <group position={[5, 0, 0]} scale={S_SMELTER}>
        <OreSmelter status="green" />
      </group>

      {/* Splitter at (10, 0) */}
      <group position={[10, 0, 0]} scale={S_SPLITTER}>
        <Splitter status="green" />
      </group>

      {/* Processor A at (15, 0) */}
      <group position={[15, 0, 0]} scale={S_PROCESSOR}>
        <ProcessorUnit status="green" />
      </group>

      {/* Processor B at (12, 3) — south branch via curve */}
      <group position={[12, 0, 3]} scale={S_PROCESSOR}>
        <ProcessorUnit status="green" />
      </group>

      {/* Modular Storage at (20, 0) */}
      <group position={[20, 0, 0]} scale={S_STORAGE}>
        <ModularStorage status="green" />
      </group>

      {/* ═══════════════════════════════════════════
          BELT CHAINS (with animated items)
          ═══════════════════════════════════════════ */}

      {/* Miner A → Merger */}
      <BeltChain
        segments={FC_MINER_A}
        items={FC_MINER_A_ITEMS}
        power="running" content="filled" ratePerMinute={60} endCaps loop
      />

      {/* Miner B → Merger (south) */}
      <BeltChain
        segments={FC_MINER_B}
        items={FC_MINER_B_ITEMS}
        power="running" content="filled" ratePerMinute={60} endCaps loop
      />

      {/* Merger → Smelter */}
      <BeltChain
        segments={FC_MERGE_SMELT}
        items={FC_MERGE_SMELT_ITEMS}
        power="running" content="filled" ratePerMinute={60} endCaps loop
      />

      {/* Smelter → Splitter */}
      <BeltChain
        segments={FC_SMELT_SPLIT}
        items={FC_SMELT_SPLIT_ITEMS}
        power="running" content="filled" ratePerMinute={60} endCaps loop
      />

      {/* Splitter → Processor A */}
      <BeltChain
        segments={FC_SPLIT_PROC_A}
        items={FC_SPLIT_PROC_A_ITEMS}
        power="running" content="filled" ratePerMinute={60} endCaps loop
      />

      {/* Splitter → Processor B (south) */}
      <BeltChain
        segments={FC_SPLIT_PROC_B}
        items={FC_SPLIT_PROC_B_ITEMS}
        power="running" content="filled" ratePerMinute={60} endCaps loop
      />

      {/* Processor A → ModularStorage (3-tile belt run) */}
      <BeltChain
        segments={FC_PROC_A_STORAGE}
        items={FC_PROC_A_STORAGE_ITEMS}
        power="running" content="filled" ratePerMinute={60} endCaps loop
      />

      {/* ═══════════════════════════════════════════
          SCENERY / POWER
          ═══════════════════════════════════════════ */}

      <group position={[5, 0, -2]} scale={S_BURNER}>
        <BiomassBurner status="green" />
      </group>
      <WindTurbine position={[15, 0, -2]} status="green" />
      <PowerPole position={[-3, 0, -1.5]} />
      <PowerPole position={[8, 0, -1.5]} />
      <PowerPole position={[18, 0, -1.5]} />
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
