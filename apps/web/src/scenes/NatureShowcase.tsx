import { CylinderGeometry } from "three";
import { Html } from "@react-three/drei";
import { COLORS, MAT, type ModelProps } from "../models/colors";
import {
  OakTree,
  DetailedTree,
  PineTree,
  FlatTopTree,
  DeadTree,
  Flower,
  Bush,
  GrassClump,
  Rock,
  RockFormation,
  Stump,
  Log,
  Mushroom,
} from "../models";

/* ── Sized wrappers ───────────────────────────────────────── */

const OakSm: React.FC<ModelProps> = (p) => <OakTree size="sm" {...p} />;
const OakLg: React.FC<ModelProps> = (p) => <OakTree size="lg" {...p} />;
const DetailedSm: React.FC<ModelProps> = (p) => <DetailedTree size="sm" {...p} />;
const DetailedLg: React.FC<ModelProps> = (p) => <DetailedTree size="lg" {...p} />;
const PineSm: React.FC<ModelProps> = (p) => <PineTree size="sm" {...p} />;
const PineLg: React.FC<ModelProps> = (p) => <PineTree size="lg" {...p} />;
const FlatTopSm: React.FC<ModelProps> = (p) => <FlatTopTree size="sm" {...p} />;
const FlatTopLg: React.FC<ModelProps> = (p) => <FlatTopTree size="lg" {...p} />;
const DeadSm: React.FC<ModelProps> = (p) => <DeadTree size="sm" {...p} />;
const DeadLg: React.FC<ModelProps> = (p) => <DeadTree size="lg" {...p} />;
const BushSm: React.FC<ModelProps> = (p) => <Bush size="sm" {...p} />;
const BushLg: React.FC<ModelProps> = (p) => <Bush size="lg" {...p} />;
const RockSm: React.FC<ModelProps> = (p) => <Rock size="sm" {...p} />;
const RockLg: React.FC<ModelProps> = (p) => <Rock size="lg" {...p} />;
const StumpSm: React.FC<ModelProps> = (p) => <Stump size="sm" {...p} />;
const StumpLg: React.FC<ModelProps> = (p) => <Stump size="lg" {...p} />;
const FormationSm: React.FC<ModelProps> = (p) => <RockFormation size="sm" {...p} />;
const FormationLg: React.FC<ModelProps> = (p) => <RockFormation size="lg" {...p} />;
const FlowerPurple: React.FC<ModelProps> = (p) => <Flower color="purple" {...p} />;
const FlowerRed: React.FC<ModelProps> = (p) => <Flower color="red" {...p} />;
const FlowerYellow: React.FC<ModelProps> = (p) => <Flower color="yellow" {...p} />;

/* ── Types ────────────────────────────────────────────────── */

interface ShowcaseEntry {
  name: string;
  component: React.FC<ModelProps>;
  scale?: number;
}

interface Section {
  label: string;
  entries: ShowcaseEntry[];
}

/* ── Data ─────────────────────────────────────────────────── */

const SECTIONS: Section[] = [
  {
    label: "Trees — Round & Clustered",
    entries: [
      { name: "Oak SM", component: OakSm, scale: 2 },
      { name: "Oak MD", component: OakTree, scale: 1.5 },
      { name: "Oak LG", component: OakLg, scale: 1.2 },
      { name: "Detailed SM", component: DetailedSm, scale: 2 },
      { name: "Detailed MD", component: DetailedTree, scale: 1.5 },
      { name: "Detailed LG", component: DetailedLg, scale: 1.2 },
    ],
  },
  {
    label: "Trees — Conifer & Flat-top",
    entries: [
      { name: "Pine SM", component: PineSm, scale: 2 },
      { name: "Pine MD", component: PineTree, scale: 1.5 },
      { name: "Pine LG", component: PineLg, scale: 1.2 },
      { name: "FlatTop SM", component: FlatTopSm, scale: 2 },
      { name: "FlatTop MD", component: FlatTopTree, scale: 1.5 },
      { name: "FlatTop LG", component: FlatTopLg, scale: 1.2 },
    ],
  },
  {
    label: "Dead Trees & Remnants",
    entries: [
      { name: "Dead SM", component: DeadSm, scale: 2 },
      { name: "Dead MD", component: DeadTree, scale: 1.5 },
      { name: "Dead LG", component: DeadLg, scale: 1.2 },
      { name: "Stump SM", component: StumpSm, scale: 6 },
      { name: "Stump MD", component: Stump, scale: 5 },
      { name: "Stump LG", component: StumpLg, scale: 4 },
    ],
  },
  {
    label: "Rocks & Formations",
    entries: [
      { name: "Rock SM", component: RockSm, scale: 3 },
      { name: "Rock MD", component: Rock, scale: 2.5 },
      { name: "Rock LG", component: RockLg, scale: 2.5 },
      { name: "Formation SM", component: FormationSm, scale: 2 },
      { name: "Formation MD", component: RockFormation, scale: 1.5 },
      { name: "Formation LG", component: FormationLg, scale: 1.2 },
    ],
  },
  {
    label: "Ground Cover",
    entries: [
      { name: "Bush SM", component: BushSm, scale: 3 },
      { name: "Bush MD", component: Bush, scale: 2.5 },
      { name: "Bush LG", component: BushLg, scale: 2.5 },
      { name: "Grass", component: GrassClump, scale: 3.5 },
      { name: "Log", component: Log, scale: 4 },
      { name: "Mushroom", component: Mushroom, scale: 5 },
    ],
  },
  {
    label: "Flowers",
    entries: [
      { name: "Purple", component: FlowerPurple, scale: 4 },
      { name: "Red", component: FlowerRed, scale: 4 },
      { name: "Yellow", component: FlowerYellow, scale: 4 },
    ],
  },
];

/* ── Grid constants ───────────────────────────────────────── */

const COLS = 6;
const SPACING = 2.5;

/* ── Shared geometry ──────────────────────────────────────── */

const pedestalBase = new CylinderGeometry(0.72, 0.78, 0.1, 12);
const pedestalRing = new CylinderGeometry(0.68, 0.72, 0.02, 12);
const dioramaBase = new CylinderGeometry(3.8, 4.2, 0.2, 24);
const dioramaTop = new CylinderGeometry(3.75, 3.8, 0.02, 24);

/* ── Styles ───────────────────────────────────────────────── */

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

/* ── Slot ─────────────────────────────────────────────────── */

function Slot({ x, z, entry }: { x: number; z: number; entry: ShowcaseEntry }) {
  const Component = entry.component;
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
      <group position={[0, 0.15, 0]} scale={entry.scale ?? 1}>
        <Component />
      </group>
    </group>
  );
}

/* ── Nature Diorama ───────────────────────────────────────── */

function NatureDiorama() {
  return (
    <group>
      {/* Island base */}
      <mesh position={[0, 0.1, 0]} geometry={dioramaBase}>
        <meshStandardMaterial color={COLORS.pedestal} {...MAT} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.21, 0]} geometry={dioramaTop}>
        <meshStandardMaterial color={COLORS.groundLight} roughness={0.85} />
      </mesh>

      {/* Nature elements on the island */}
      <group position={[0, 0.22, 0]}>
        {/* Trees — back row */}
        <OakTree size="lg" position={[-1.5, 0, -2.0]} scale={3} />
        <PineTree size="lg" position={[2.0, 0, -2.5]} scale={3} />
        <DetailedTree size="md" position={[-2.8, 0, -0.5]} scale={3.5} />
        <FlatTopTree size="md" position={[1.0, 0, -0.5]} scale={3.5} />
        <PineTree size="sm" position={[0, 0, -1.5]} scale={4.5} />
        <DeadTree size="md" position={[3.0, 0, -1.5]} scale={3.5} />

        {/* Rock formations */}
        <RockFormation size="lg" position={[0.5, 0, -3.0]} scale={2.5} />
        <RockFormation size="sm" position={[-2.5, 0, -2.5]} scale={2} />

        {/* Rocks */}
        <Rock size="lg" position={[2.5, 0, 0.5]} scale={4} />
        <Rock size="md" position={[-1.5, 0, 1.5]} scale={4} />
        <Rock size="sm" position={[0.5, 0, 2.0]} scale={5} />

        {/* Bushes */}
        <Bush size="lg" position={[-0.5, 0, 0]} scale={5} />
        <Bush size="md" position={[1.5, 0, 1.0]} scale={5} />
        <Bush size="sm" position={[-2.0, 0, 0.8]} scale={6} />

        {/* Grass clumps */}
        <GrassClump position={[0.5, 0, 0.5]} scale={6} />
        <GrassClump position={[-1.0, 0, 1.0]} scale={6} />
        <GrassClump position={[2.2, 0, -0.3]} scale={6} />
        <GrassClump position={[-0.5, 0, -1.0]} scale={6.5} />
        <GrassClump position={[1.5, 0, -1.2]} scale={6} />

        {/* Flowers */}
        <Flower color="purple" position={[-1.0, 0, 0.5]} scale={6} />
        <Flower color="red" position={[0.5, 0, 1.5]} scale={6} />
        <Flower color="yellow" position={[-2.0, 0, -0.3]} scale={6} />

        {/* Mushrooms */}
        <Mushroom position={[0, 0, 1.5]} scale={8} />
        <Mushroom position={[-1.5, 0, -1.5]} scale={8} />

        {/* Stump & Log */}
        <Stump size="md" position={[1.0, 0, 1.5]} scale={6} />
        <Log position={[-1.2, 0, 2.0]} rotation={[0, 0.6, 0]} scale={5} />
      </group>
    </group>
  );
}

/* ── Main showcase ────────────────────────────────────────── */

export function NatureShowcase() {
  const items: (
    | { type: "section"; label: string; row: number }
    | { type: "entry"; entry: ShowcaseEntry; col: number; row: number }
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
  const centerX = ((COLS - 1) * SPACING) / 2;

  return (
    <group>
      {/* Ground plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[centerX, -0.01, (totalRows * SPACING) / 2]}
      >
        <planeGeometry args={[COLS * SPACING + 4, totalRows * SPACING + 4]} />
        <meshStandardMaterial color={COLORS.ground} roughness={0.85} />
      </mesh>

      {/* Catalog grid */}
      {items.map((item) => {
        if (item.type === "section") {
          return (
            <group key={item.label} position={[centerX, 0, item.row * SPACING]}>
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

      {/* Diorama section */}
      <group position={[centerX, 0, totalRows * SPACING + 5]}>
        <Html position={[0, 3, 5]} center style={sectionLabelStyle}>
          Composed Nature Scene
        </Html>
        <NatureDiorama />
      </group>
    </group>
  );
}
