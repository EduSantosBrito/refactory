import { memo } from "react";
import { DodecahedronGeometry, SphereGeometry } from "three";
import { COLORS, STONE_MAT, type ModelProps, type TreeSize } from "../colors";

/* ── Rock geometries — faceted low-poly ─────────────────── */
const rockLg = new DodecahedronGeometry(0.13, 0);
const rockMd = new DodecahedronGeometry(0.09, 0);
const rockSm = new DodecahedronGeometry(0.06, 0);
const pebble = new SphereGeometry(0.03, 5, 4);

/* ── Per-size layout ────────────────────────────────────── */
type StoneDef = {
  geo: DodecahedronGeometry | SphereGeometry;
  pos: [number, number, number];
  scale: [number, number, number];
  rot?: [number, number, number];
  color: string;
};

const layouts: Record<TreeSize, StoneDef[]> = {
  sm: [
    { geo: rockSm, pos: [0, 0.03, 0], scale: [1, 0.6, 0.9], color: COLORS.stone },
    { geo: pebble, pos: [0.06, 0.015, 0.03], scale: [1, 0.65, 1], color: COLORS.stoneDark },
  ],
  md: [
    { geo: rockMd, pos: [0, 0.04, 0], scale: [1, 0.55, 0.9], color: COLORS.stone },
    { geo: rockSm, pos: [0.1, 0.025, 0.06], scale: [1, 0.6, 1], rot: [0, 0.5, 0], color: COLORS.stoneDark },
    { geo: pebble, pos: [-0.06, 0.015, 0.08], scale: [1, 0.6, 1], color: COLORS.stoneLight },
  ],
  lg: [
    { geo: rockLg, pos: [0, 0.05, 0], scale: [1, 0.55, 0.85], color: COLORS.stone },
    { geo: rockMd, pos: [0.12, 0.035, 0.06], scale: [1, 0.6, 1], rot: [0, 0.4, 0], color: COLORS.stoneDark },
    { geo: rockSm, pos: [-0.09, 0.025, 0.09], scale: [1, 0.65, 0.9], rot: [0, -0.3, 0], color: COLORS.stoneLight },
    { geo: pebble, pos: [0.15, 0.015, -0.04], scale: [1, 0.6, 1], color: COLORS.stoneDark },
  ],
};

/**
 * Rock cluster — squashed faceted dodecahedrons with flat shading.
 */
export const Rock = memo(function Rock({
  size = "md",
  ...props
}: ModelProps & { size?: TreeSize }) {
  return (
    <group {...props}>
      {layouts[size].map((s, i) => (
        <mesh key={i} geometry={s.geo} position={s.pos} scale={s.scale} rotation={s.rot}>
          <meshStandardMaterial color={s.color} {...STONE_MAT} />
        </mesh>
      ))}
    </group>
  );
});
