import { memo } from "react";
import { DodecahedronGeometry } from "three";
import { COLORS, type ModelProps, STONE_MAT, type TreeSize } from "../colors";

/**
 * Rock formation — stacked faceted dodecahedrons forming a mountain/cliff.
 *
 * SM: 3 rocks, small cliff.
 * MD: 5 rocks, medium mountain.
 * LG: 7 rocks, imposing formation with wide base.
 */

const formXl = new DodecahedronGeometry(0.2, 0);
const formLg = new DodecahedronGeometry(0.16, 0);
const formMd = new DodecahedronGeometry(0.12, 0);
const formSm = new DodecahedronGeometry(0.08, 0);
const formXs = new DodecahedronGeometry(0.05, 0);

type RockDef = {
  geo: DodecahedronGeometry;
  pos: [number, number, number];
  scale: [number, number, number];
  rot?: [number, number, number];
  color: string;
};

const layouts: Record<TreeSize, RockDef[]> = {
  sm: [
    {
      geo: formMd,
      pos: [0, 0.05, 0],
      scale: [1.1, 0.55, 0.95],
      color: COLORS.stoneDark,
    },
    {
      geo: formSm,
      pos: [-0.04, 0.14, 0.02],
      scale: [0.95, 0.55, 0.85],
      color: COLORS.stone,
    },
    {
      geo: formXs,
      pos: [0.03, 0.2, -0.01],
      scale: [0.9, 0.5, 0.8],
      color: COLORS.stoneLight,
    },
  ],
  md: [
    {
      geo: formLg,
      pos: [0, 0.06, 0],
      scale: [1.15, 0.5, 1.0],
      color: COLORS.stoneDark,
    },
    {
      geo: formMd,
      pos: [-0.05, 0.16, 0.03],
      scale: [1.0, 0.55, 0.9],
      color: COLORS.stone,
    },
    {
      geo: formSm,
      pos: [0.04, 0.25, -0.02],
      scale: [0.95, 0.5, 0.85],
      color: COLORS.stoneLight,
    },
    {
      geo: formSm,
      pos: [-0.03, 0.33, 0.01],
      scale: [0.85, 0.55, 0.8],
      color: COLORS.stone,
    },
    {
      geo: formXs,
      pos: [0.01, 0.4, -0.01],
      scale: [0.8, 0.5, 0.75],
      color: COLORS.stoneDark,
    },
  ],
  lg: [
    {
      geo: formXl,
      pos: [0, 0.07, 0],
      scale: [1.3, 0.5, 1.1],
      color: COLORS.stoneDark,
    },
    {
      geo: formLg,
      pos: [0.1, 0.06, -0.08],
      scale: [0.9, 0.45, 0.85],
      rot: [0, 0.5, 0],
      color: COLORS.stone,
    },
    {
      geo: formMd,
      pos: [-0.06, 0.18, 0.04],
      scale: [1.1, 0.55, 0.95],
      rot: [0, -0.3, 0],
      color: COLORS.stone,
    },
    {
      geo: formMd,
      pos: [0.06, 0.28, -0.03],
      scale: [0.95, 0.5, 0.85],
      rot: [0, 0.4, 0],
      color: COLORS.stoneLight,
    },
    {
      geo: formSm,
      pos: [-0.04, 0.37, 0.02],
      scale: [0.9, 0.55, 0.85],
      color: COLORS.stone,
    },
    {
      geo: formSm,
      pos: [0.03, 0.44, -0.01],
      scale: [0.85, 0.5, 0.8],
      color: COLORS.stoneDark,
    },
    {
      geo: formXs,
      pos: [-0.01, 0.51, 0],
      scale: [0.8, 0.5, 0.75],
      color: COLORS.stoneLight,
    },
  ],
};

export const RockFormation = memo(function RockFormation({
  size = "md",
  ...props
}: ModelProps & { size?: TreeSize }) {
  return (
    <group {...props}>
      {layouts[size].map((r) => (
        <mesh
          key={`rf-${r.geo.type}-${r.pos.join("-")}`}
          geometry={r.geo}
          position={r.pos}
          scale={r.scale}
          rotation={r.rot}
        >
          <meshStandardMaterial color={r.color} {...STONE_MAT} />
        </mesh>
      ))}
    </group>
  );
});
