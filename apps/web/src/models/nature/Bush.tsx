import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { SphereGeometry } from "three";
import type { Group } from "three";
import { COLORS, FOLIAGE, type ModelProps, type TreeSize } from "../colors";

/* ── Bush blobs — faceted low-poly ──────────────────────── */
const blobLg = new SphereGeometry(0.11, 6, 5);
const blobMd = new SphereGeometry(0.08, 6, 4);
const blobSm = new SphereGeometry(0.06, 5, 4);

/* ── Per-size layout ────────────────────────────────────── */
type BlobDef = { geo: SphereGeometry; pos: [number, number, number]; color: string };

const layouts: Record<TreeSize, BlobDef[]> = {
  sm: [
    { geo: blobMd, pos: [0, 0.06, 0], color: COLORS.canopy },
    { geo: blobSm, pos: [0.06, 0.04, 0.03], color: COLORS.canopyLight },
  ],
  md: [
    { geo: blobLg, pos: [0, 0.08, 0], color: COLORS.canopy },
    { geo: blobMd, pos: [0.08, 0.06, 0.04], color: COLORS.canopyLight },
    { geo: blobMd, pos: [-0.07, 0.05, -0.04], color: COLORS.canopyDark },
  ],
  lg: [
    { geo: blobLg, pos: [0, 0.08, 0], color: COLORS.canopy },
    { geo: blobLg, pos: [0.08, 0.07, 0.05], color: COLORS.canopyLight },
    { geo: blobMd, pos: [-0.08, 0.06, -0.04], color: COLORS.canopyDark },
    { geo: blobSm, pos: [0.04, 0.1, -0.06], color: COLORS.canopy },
  ],
};

/**
 * Low bush — faceted sphere cluster hugging the ground.
 */
export const Bush = memo(function Bush({
  size = "md",
  ...props
}: ModelProps & { size?: TreeSize }) {
  const ref = useRef<Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.z =
      Math.sin(state.clock.getElapsedTime() * 0.7 + (props.position?.[0] ?? 0)) * 0.02;
  });

  return (
    <group {...props}>
      <group ref={ref}>
        {layouts[size].map((b, i) => (
          <mesh key={i} geometry={b.geo} position={b.pos}>
            <meshStandardMaterial color={b.color} {...FOLIAGE} />
          </mesh>
        ))}
      </group>
    </group>
  );
});
