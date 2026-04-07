import { B, M, BODY_HALF_H_MAP, type BodyHeight } from "./palette";

const S = 8;
const BASE_HALF_H = 0.134;

type BodyProps = { height?: BodyHeight };

export function Body({ height = "standard" }: BodyProps) {
  const halfH = BODY_HALF_H_MAP[height];
  const s = halfH / BASE_HALF_H;

  return (
    <group>
      {/* ── Bottom band — structural transition ────────── */}
      <mesh position={[0, -0.117 * s, 0]}>
        <cylinderGeometry args={[0.27, 0.28, 0.035 * s, S]} />
        <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
      </mesh>

      {/* ── Main central volume ────────────────────────── */}
      <mesh>
        <cylinderGeometry args={[0.255, 0.27, 0.18 * s, S]} />
        <meshStandardMaterial color={B.bright} {...M} />
      </mesh>

      {/* Single horizontal seam */}
      <mesh position={[0, -0.03 * s, 0]}>
        <cylinderGeometry args={[0.268, 0.268, 0.005, S]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
      </mesh>

      {/* 4× Cardinal recessed panels */}
      {Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh
            key={`bp-${i}`}
            position={[Math.sin(a) * 0.26, 0, Math.cos(a) * 0.26]}
            rotation={[0, -a, 0]}
          >
            <boxGeometry args={[0.1, 0.1 * s, 0.012]} />
            <meshStandardMaterial color={B.dark} {...M} roughness={0.7} />
          </mesh>
        );
      })}

      {/* ── Top band — inset step ──────────────────────── */}
      <mesh position={[0, 0.104 * s, 0]}>
        <cylinderGeometry args={[0.24, 0.255, 0.045 * s, S]} />
        <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
      </mesh>

      {/* Top rim */}
      <mesh position={[0, 0.13 * s, 0]}>
        <cylinderGeometry args={[0.245, 0.24, 0.008, S]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
      </mesh>
    </group>
  );
}
