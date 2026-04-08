import { MechLeg } from "../MechLeg";
import { B, M } from "./palette";

const S = 8;
const LEGS = 4;
const LEG_R = 0.22;

type FoundationProps = {
  legSize?: "sm" | "md";
};

export function Foundation({ legSize = "sm" }: FoundationProps) {
  return (
    <group>
      {/* Main octagonal plate — slightly flared */}
      <mesh>
        <cylinderGeometry args={[0.28, 0.32, 0.06, S]} />
        <meshStandardMaterial color={B.bright} {...M} />
      </mesh>

      {/* Top rim — transition edge to body */}
      <mesh position={[0, 0.036, 0]}>
        <cylinderGeometry args={[0.29, 0.285, 0.012, S]} />
        <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
      </mesh>

      {/* Bottom lip — wider dark base */}
      <mesh position={[0, -0.036, 0]}>
        <cylinderGeometry args={[0.325, 0.335, 0.012, S]} />
        <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
      </mesh>

      {/* 4× Legs */}
      {Array.from({ length: LEGS }, (_, i) => {
        const a = (i / LEGS) * Math.PI * 2 + Math.PI / 4;
        return (
          <group
            key={`lg-${a.toFixed(3)}`}
            position={[Math.sin(a) * LEG_R, 0, Math.cos(a) * LEG_R]}
          >
            <MechLeg direction={a} size={legSize} variant="rounded" />
          </group>
        );
      })}
    </group>
  );
}
