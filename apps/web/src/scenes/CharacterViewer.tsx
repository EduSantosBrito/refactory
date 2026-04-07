import { Suspense } from "react";
import { Html } from "@react-three/drei";
import { CylinderGeometry } from "three";
import { COLORS, MAT, type ModelProps } from "../models/colors";
import { Character, type CharacterName } from "../models/Character";
import {
  ResourceNode,
  NODE_MINER_OFFSET,
  Smelter,
  Processor,
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
  ModularBuilding,
} from "../models";
import {
  Foundation as BuildingFoundation,
  Body as BuildingBody,
  PowerUnit,
  AntennaModule,
  ChimneyStack,
  TurbinePlate,
  DrillHead,
  TankCluster,
  HeatSinkArray,
  SortingFrame,
  SideTank,
  SideVent,
  SidePipe,
  SidePanel,
  SideLamp,
  BiomassBurner,
  OreSmelter,
  ProcessorUnit,
  ContainerStorage,
  PersonalBox,
} from "../models/building";
import type { ChainSegment, ChainItem } from "../models";
import { CURVE_ARC_LENGTH, getBeltLoopItemCount } from "../models/belt";

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

const BeltCurveDemo: React.FC<ModelProps> = (props) => <BeltCurve power="running" {...props} />;

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

const CHAIN_TOTAL_LENGTH = CHAIN_SEGMENTS.reduce((total, segment) => total + segment.pathLength, 0);
const CHAIN_ITEM_COUNT = getBeltLoopItemCount(CHAIN_TOTAL_LENGTH);

const CHAIN_ITEMS: ChainItem[] = Array.from({ length: CHAIN_ITEM_COUNT }, (_, i) => ({
  id: `ore-${i}`,
  progress: i / CHAIN_ITEM_COUNT,
  node: <OreNugget />,
  heightOffset: 0.06,
}));

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
    <group position={[0, 0.10, 0]}>
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
    <group position={[0, 0.20, 0]}>
      <BuildingBody height="tall" />
    </group>
  </group>
);
const PowerUnitDemo: React.FC<ModelProps> = (props) => (
  <group {...props}><PowerUnit /></group>
);
const AntennaModuleDemo: React.FC<ModelProps> = (props) => (
  <group {...props}><AntennaModule /></group>
);
const ChimneyStackDemo: React.FC<ModelProps> = (props) => (
  <group {...props}><ChimneyStack /></group>
);
const TurbinePlateDemo: React.FC<ModelProps> = (props) => (
  <group {...props}><TurbinePlate /></group>
);
const DrillHeadDemo: React.FC<ModelProps> = (props) => (
  <group {...props}><DrillHead /></group>
);
const TankClusterDemo: React.FC<ModelProps> = (props) => (
  <group {...props}><TankCluster /></group>
);
const HeatSinkArrayDemo: React.FC<ModelProps> = (props) => (
  <group {...props}><HeatSinkArray /></group>
);
const SortingFrameDemo: React.FC<ModelProps> = (props) => (
  <group {...props}><SortingFrame /></group>
);
const SideTankDemo: React.FC<ModelProps> = (props) => (
  <group {...props}><SideTank /></group>
);
const SideVentDemo: React.FC<ModelProps> = (props) => (
  <group {...props}><SideVent /></group>
);
const SidePipeDemo: React.FC<ModelProps> = (props) => (
  <group {...props}><SidePipe /></group>
);
const SidePanelDemo: React.FC<ModelProps> = (props) => (
  <group {...props}><SidePanel /></group>
);
const SideLampDemo: React.FC<ModelProps> = (props) => (
  <group {...props}><SideLamp /></group>
);

/* Example buildings */

const BuildingPowerPlant: React.FC<ModelProps> = (props) => (
  <ModularBuilding
    topModule="power"
    sideAttachments={[
      { type: "tank", face: 1 },
      { type: "tank", face: 3 },
      { type: "vent", face: 5 },
    ]}
    legSize="sm"
    {...props}
  />
);
const BuildingCommTower: React.FC<ModelProps> = (props) => (
  <ModularBuilding
    topModule="antenna"
    sideAttachments={[
      { type: "vent", face: 2 },
      { type: "lamp", face: 6 },
    ]}
    legSize="sm"
    {...props}
  />
);
const BuildingFurnace: React.FC<ModelProps> = (props) => (
  <ModularBuilding
    topModule="chimney"
    sideAttachments={[
      { type: "vent", face: 2 },
      { type: "vent", face: 6 },
    ]}
    legSize="sm"
    {...props}
  />
);
const BuildingRefinery: React.FC<ModelProps> = (props) => (
  <ModularBuilding
    topModule="tanks"
    bodyHeight="short"
    sideAttachments={[
      { type: "pipe", face: 1 },
      { type: "pipe", face: 5 },
    ]}
    legSize="sm"
    {...props}
  />
);
const BuildingGenerator: React.FC<ModelProps> = (props) => (
  <ModularBuilding
    topModule="turbine"
    sideAttachments={[
      { type: "vent", face: 0 },
      { type: "vent", face: 4 },
    ]}
    legSize="md"
    {...props}
  />
);
const BuildingDrillStation: React.FC<ModelProps> = (props) => (
  <ModularBuilding
    topModule="drill"
    bodyHeight="tall"
    sideAttachments={[
      { type: "tank", face: 1 },
      { type: "tank", face: 5 },
    ]}
    legSize="md"
    {...props}
  />
);
const BuildingLogisticsHub: React.FC<ModelProps> = (props) => (
  <ModularBuilding
    topModule="sorting"
    sideAttachments={[
      { type: "panel", face: 2 },
      { type: "panel", face: 6 },
    ]}
    legSize="sm"
    {...props}
  />
);
const BuildingCoolingStation: React.FC<ModelProps> = (props) => (
  <ModularBuilding
    topModule="heatsink"
    bodyHeight="short"
    sideAttachments={[
      { type: "pipe", face: 1 },
      { type: "pipe", face: 3 },
      { type: "pipe", face: 5 },
    ]}
    legSize="sm"
    {...props}
  />
);

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
      { kind: "component", name: "Iron Impure", component: IronImpure, scale: 2.5 },
      { kind: "component", name: "Iron Normal", component: IronNormal, scale: 2.5 },
      { kind: "component", name: "Iron Pure", component: IronPure, scale: 2 },
      { kind: "component", name: "Copper Impure", component: CopperImpure, scale: 2.5 },
      { kind: "component", name: "Copper Normal", component: CopperNormal, scale: 2.5 },
      { kind: "component", name: "Copper Pure", component: CopperPure, scale: 2 },
      { kind: "component", name: "Miner + Impure", component: MinerOnImpure, scale: 0.85 },
      { kind: "component", name: "Miner + Normal", component: MinerOnNormal, scale: 0.85 },
      { kind: "component", name: "Miner + Pure", component: MinerOnPure, scale: 0.85 },
    ],
  },
  {
    label: "Game Models",
    entries: [
      { kind: "component", name: "Smelter", component: Smelter },
      { kind: "component", name: "Processor", component: Processor },
      { kind: "component", name: "Burner", component: Burner },
      { kind: "component", name: "Belt Running", component: BeltStraightRunning },
      { kind: "component", name: "Belt Stopped", component: BeltStraightStopped },
      { kind: "component", name: "Belt Curve", component: BeltCurveDemo },
      { kind: "component", name: "Belt Chain 60/min", component: BeltChain60Demo },
      { kind: "component", name: "Belt Chain 120/min", component: BeltChain120Demo },
      { kind: "component", name: "Belt Chain 240/min", component: BeltChain240Demo },
      { kind: "component", name: "Storage", component: ModularStorage, scale: 0.8 },
      { kind: "component", name: "Wind Turbine", component: WindTurbine },
      { kind: "component", name: "Rocket", component: Rocket, scale: 0.6 },
      { kind: "component", name: "Power Pole", component: PowerPole, scale: 0.7 },
      { kind: "component", name: "Miner", component: Miner, scale: 1.0 },
      { kind: "component", name: "MechLeg md", component: MechLegMd, scale: 2 },
    ],
  },
  {
    label: "Modular Building — Parts",
    entries: [
      { kind: "component", name: "Foundation (sm)", component: FoundationSmDemo, scale: 2.5 },
      { kind: "component", name: "Foundation (md)", component: FoundationMdDemo, scale: 2 },
      { kind: "component", name: "Body (short)", component: BodyShortDemo, scale: 2.5 },
      { kind: "component", name: "Body (standard)", component: BodyDemo, scale: 2.5 },
      { kind: "component", name: "Body (tall)", component: BodyTallDemo, scale: 2 },
      { kind: "component", name: "Power Unit", component: PowerUnitDemo, scale: 4 },
      { kind: "component", name: "Antenna Module", component: AntennaModuleDemo, scale: 4 },
      { kind: "component", name: "Chimney Stack", component: ChimneyStackDemo, scale: 4 },
      { kind: "component", name: "Turbine Plate", component: TurbinePlateDemo, scale: 4 },
      { kind: "component", name: "Drill Head", component: DrillHeadDemo, scale: 3.5 },
      { kind: "component", name: "Tank Cluster", component: TankClusterDemo, scale: 4 },
      { kind: "component", name: "Heat Sink Array", component: HeatSinkArrayDemo, scale: 4 },
      { kind: "component", name: "Sorting Frame", component: SortingFrameDemo, scale: 4 },
      { kind: "component", name: "Side Tank", component: SideTankDemo, scale: 8 },
      { kind: "component", name: "Side Vent", component: SideVentDemo, scale: 10 },
      { kind: "component", name: "Side Pipe", component: SidePipeDemo, scale: 8 },
      { kind: "component", name: "Side Panel", component: SidePanelDemo, scale: 10 },
      { kind: "component", name: "Side Lamp", component: SideLampDemo, scale: 12 },
    ],
  },
  {
    label: "Modular Building — Examples",
    entries: [
      { kind: "component", name: "Power Plant", component: BuildingPowerPlant, scale: 1.3 },
      { kind: "component", name: "Comm Tower", component: BuildingCommTower, scale: 1.3 },
      { kind: "component", name: "Furnace", component: BuildingFurnace, scale: 1.3 },
      { kind: "component", name: "Refinery", component: BuildingRefinery, scale: 1.4 },
      { kind: "component", name: "Generator", component: BuildingGenerator, scale: 1.1 },
      { kind: "component", name: "Drill Station", component: BuildingDrillStation, scale: 1.0 },
      { kind: "component", name: "Logistics Hub", component: BuildingLogisticsHub, scale: 1.3 },
      { kind: "component", name: "Cooling Station", component: BuildingCoolingStation, scale: 1.4 },
    ],
  },
  {
    label: "Building Presets",
    entries: [
      { kind: "component", name: "Biomass Burner", component: BiomassBurner, scale: 1.3 },
      { kind: "component", name: "Ore Smelter", component: OreSmelter, scale: 1.1 },
      { kind: "component", name: "Processor Unit", component: ProcessorUnit, scale: 1.3 },
      { kind: "component", name: "Container Storage", component: ContainerStorage, scale: 1.3 },
      { kind: "component", name: "Personal Box", component: PersonalBox, scale: 3 },
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
  const items: (
    | { type: "section"; label: string; row: number }
    | { type: "entry"; entry: Entry; col: number; row: number }
  )[] = [];
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
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[((COLS - 1) * SPACING) / 2, -0.01, (totalRows * SPACING) / 2]}
      >
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
