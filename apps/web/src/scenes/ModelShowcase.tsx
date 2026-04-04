import {
  PlayerAvatar,
  IronNode,
  CopperNode,
  ConveyorBelt,
  ConveyorBeltLane,
  ConveyorBeltCurved,
  ModularStorage,
  Rocket,
  WindTurbine,
  BELT_TILE,
} from "../models";
import type { BeltContent, BeltState, ConveyorLaneItem } from "../models";
import { COLORS, MAT, type ModelProps } from "../models/colors";

const StorageRed: React.FC<ModelProps> = (props) => <ModularStorage {...props} status="red" />;
const WindTurbineYellow: React.FC<ModelProps> = (props) => (
  <WindTurbine {...props} status="yellow" />
);

const SampleBoxCargo = ({ color = "#e8845a" }: { color?: string }) => (
  <mesh>
    <boxGeometry args={[0.3, 0.3, 0.3]} />
    <meshStandardMaterial color={color} roughness={0.55} metalness={0} />
  </mesh>
);

const SampleBarrelCargo = ({ color = "#5ec4b6" }: { color?: string }) => (
  <mesh>
    <cylinderGeometry args={[0.12, 0.12, 0.32, 12]} />
    <meshStandardMaterial color={color} roughness={0.55} metalness={0} />
  </mesh>
);

const SampleOreCargo = ({ color = "#f5d24a" }: { color?: string }) => (
  <mesh rotation={[0.3, 0.5, 0]}>
    <octahedronGeometry args={[0.17, 0]} />
    <meshStandardMaterial color={color} roughness={0.6} metalness={0} />
  </mesh>
);

const laneItems: readonly ConveyorLaneItem[] = [
  {
    key: "crate",
    position: 0.08,
    node: <SampleBoxCargo color="#e8845a" />,
  },
  {
    key: "barrel",
    position: 0.38,
    node: <SampleBarrelCargo color="#5ec4b6" />,
  },
  {
    key: "ore",
    position: 0.72,
    node: <SampleOreCargo color="#f5d24a" />,
  },
];

const makeBelt =
  (state: BeltState, content: BeltContent): React.FC<ModelProps> =>
  (props) => (
    <ConveyorBelt {...props} state={state} content={content}>
      {content === "filled" && (
        <group position={[0, BELT_TILE.height + 0.12, 0]}>
          <SampleBoxCargo />
        </group>
      )}
    </ConveyorBelt>
  );

const makeBeltLine =
  (state: BeltState, content: BeltContent, count = 4): React.FC<ModelProps> =>
  (props) => (
    <ConveyorBeltLane
      {...props}
      count={count}
      state={state}
      content={content}
      items={content === "filled" ? laneItems : []}
    />
  );

interface ShowcaseEntry {
  name: string;
  component: React.FC<ModelProps>;
  yOffset: number;
  scale?: number;
}

const ENTRIES: ShowcaseEntry[] = [
  { name: "Employee", component: PlayerAvatar, yOffset: 0.12 },
  { name: "Iron Node", component: IronNode, yOffset: 0.12 },
  { name: "Copper Node", component: CopperNode, yOffset: 0.12 },
  { name: "Belt: Empty Work", component: makeBelt("working", "empty"), yOffset: 0.12 },
  { name: "Belt: Empty Idle", component: makeBelt("idle", "empty"), yOffset: 0.12 },
  { name: "Belt: Filled Work", component: makeBelt("working", "filled"), yOffset: 0.12 },
  { name: "Belt: Filled Idle", component: makeBelt("idle", "filled"), yOffset: 0.12 },
  { name: "Lane: Filled Work", component: makeBeltLine("working", "filled"), yOffset: 0.12, scale: 0.5 },
  { name: "Lane: Filled Idle", component: makeBeltLine("idle", "filled"), yOffset: 0.12, scale: 0.5 },
  { name: "Curve: Working", component: (props: ModelProps) => <ConveyorBeltCurved {...props} state="working" />, yOffset: 0.12 },
  { name: "Curve: Idle", component: (props: ModelProps) => <ConveyorBeltCurved {...props} state="idle" />, yOffset: 0.12 },
  { name: "Storage Red", component: StorageRed, yOffset: 0.12, scale: 0.8 },
  { name: "Wind Turbine", component: WindTurbine, yOffset: 0.12 },
  { name: "Wind Turbine Yellow", component: WindTurbineYellow, yOffset: 0.12 },
  { name: "Rocket", component: Rocket, yOffset: 0, scale: 0.6 },
];

const COLS = 3;
const SPACING = 3;

export function ModelShowcase() {
  return (
    <group>
      {/* Ground — warm dark green, like grass at dusk */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[SPACING, -0.01, 0]}>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color={COLORS.ground} roughness={0.85} />
      </mesh>

      {ENTRIES.map((entry, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = col * SPACING;
        const z = row * SPACING;
        const Component = entry.component;
        const scale = entry.scale ?? 1;

        return (
          <group key={entry.name} position={[x, 0, z]}>
            {/* Pedestal — smooth rounded disc, warm dark green */}
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.72, 0.78, 0.1, 24]} />
              <meshStandardMaterial color={COLORS.pedestal} {...MAT} roughness={0.65} />
            </mesh>
            {/* Pedestal top ring for definition */}
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.68, 0.72, 0.02, 24]} />
              <meshStandardMaterial color={COLORS.pedestalEdge} {...MAT} roughness={0.6} />
            </mesh>

            <group position={[0, entry.yOffset, 0]} scale={scale}>
              <Component />
            </group>
          </group>
        );
      })}
    </group>
  );
}
