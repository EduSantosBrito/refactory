import {
  PlayerAvatar,
  ResourceNode,
  BeltSegment,
  BeltCurve,
  BeltChain,
  ModularStorage,
  Rocket,
  WindTurbine,
} from "../models";
import type { BeltContentState, BeltPowerState, ChainItem, ChainSegment } from "../models";
import { BELT_TILE, DEFAULT_BELT_RATE_PER_MINUTE, getBeltLoopItemCount } from "../models/belt";
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

const LANE_RATE_PER_MINUTE = DEFAULT_BELT_RATE_PER_MINUTE;
const LANE_SEGMENT_COUNT = 4;
const laneItemCount = getBeltLoopItemCount(LANE_SEGMENT_COUNT);

function getLaneItemNode(index: number) {
  const kind = index % 3;

  if (kind === 0) {
    return <SampleBoxCargo color="#e8845a" />;
  }

  if (kind === 1) {
    return <SampleBarrelCargo color="#5ec4b6" />;
  }

  return <SampleOreCargo color="#f5d24a" />;
}

const laneSegments: readonly ChainSegment[] = Array.from({ length: LANE_SEGMENT_COUNT }, (_, index) => ({
  key: `lane-segment-${index}`,
  type: "straight",
  position: [index - (LANE_SEGMENT_COUNT - 1) / 2, 0, 0],
  rotationY: 0,
  pathLength: 1,
}));

const laneItems: readonly ChainItem[] = Array.from(
  { length: laneItemCount },
  (_, index) => ({
    id: `lane-item-${index}`,
    progress: index / laneItemCount,
    node: getLaneItemNode(index),
  }),
);

const makeBelt =
  (power: BeltPowerState, content: BeltContentState): React.FC<ModelProps> =>
  (props) => (
    <group {...props}>
      <BeltSegment power={power} content={content} />
      {content === "filled" && (
        <group position={[0, BELT_TILE.height + 0.12, 0]}>
          <SampleBoxCargo />
        </group>
      )}
    </group>
  );

const makeBeltLine =
  (power: BeltPowerState, content: BeltContentState): React.FC<ModelProps> =>
  (props) => (
    <BeltChain
      {...props}
      segments={[...laneSegments]}
      power={power}
      content={content}
      ratePerMinute={LANE_RATE_PER_MINUTE}
      items={content === "filled" ? [...laneItems] : []}
      loop
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
  {
    name: "Iron Impure",
    component: (props: ModelProps) => <ResourceNode resource="iron" purity="impure" {...props} />,
    yOffset: 0.12,
    scale: 2.5,
  },
  {
    name: "Iron Normal",
    component: (props: ModelProps) => <ResourceNode resource="iron" purity="normal" {...props} />,
    yOffset: 0.12,
    scale: 2.5,
  },
  {
    name: "Iron Pure",
    component: (props: ModelProps) => <ResourceNode resource="iron" purity="pure" {...props} />,
    yOffset: 0.12,
    scale: 2,
  },
  {
    name: "Copper Normal",
    component: (props: ModelProps) => <ResourceNode resource="copper" purity="normal" {...props} />,
    yOffset: 0.12,
    scale: 2.5,
  },
  { name: "Belt: Empty Run", component: makeBelt("running", "empty"), yOffset: 0.12 },
  { name: "Belt: Empty Stop", component: makeBelt("stopped", "empty"), yOffset: 0.12 },
  { name: "Belt: Filled Run", component: makeBelt("running", "filled"), yOffset: 0.12 },
  { name: "Belt: Filled Stop", component: makeBelt("stopped", "filled"), yOffset: 0.12 },
  {
    name: "Lane: Filled Run",
    component: makeBeltLine("running", "filled"),
    yOffset: 0.12,
    scale: 0.5,
  },
  {
    name: "Lane: Filled Stop",
    component: makeBeltLine("stopped", "filled"),
    yOffset: 0.12,
    scale: 0.5,
  },
  {
    name: "Curve: Running",
    component: (props: ModelProps) => <BeltCurve {...props} power="running" />,
    yOffset: 0.12,
  },
  {
    name: "Curve: Stopped",
    component: (props: ModelProps) => <BeltCurve {...props} power="stopped" />,
    yOffset: 0.12,
  },
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
