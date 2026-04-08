import { useFrame } from "@react-three/fiber";
import { AtomRef } from "effect/unstable/reactivity";
import { useMemo, useRef } from "react";
import type { MeshStandardMaterial } from "three";
import { Color } from "three";
import type { ModelProps } from "./colors";

export type StatusPoleStatus = "green" | "yellow" | "red";

type StatusPoleProps = ModelProps & {
  status?: StatusPoleStatus;
};

const SHAFT_RADIUS = 0.048;
const SHAFT_HEIGHT = 0.46;
const SHAFT_Y = -0.32;

const COLLAR_RADIUS = 0.074;
const COLLAR_HEIGHT = 0.08;
const COLLAR_Y = -0.05;

const LIGHT_BODY_TOP_RADIUS = 0.054;
const LIGHT_BODY_BOTTOM_RADIUS = 0.058;
const LIGHT_BODY_HEIGHT = 0.125;

const LIGHT_DOME_RADIUS = LIGHT_BODY_TOP_RADIUS;
const LIGHT_DOME_Y = LIGHT_BODY_HEIGHT / 2;

const SHAFT_COLOR = "#6f727b";
const COLLAR_COLOR = "#8f929b";

const STATUS_COLORS: Record<
  StatusPoleStatus,
  { dark: string; bright: string }
> = {
  green: { dark: "#0f4d1e", bright: "#31ff61" },
  yellow: { dark: "#6a4b00", bright: "#ffd84a" },
  red: { dark: "#5c0000", bright: "#ff0000" },
};

export function StatusPole({ status = "red", ...props }: StatusPoleProps) {
  const bodyMaterialRef = useRef<MeshStandardMaterial>(null);
  const domeMaterialRef = useRef<MeshStandardMaterial>(null);
  const elapsedTimeRef = useRef<AtomRef.AtomRef<number> | null>(null);
  const pulseRef = useRef<AtomRef.ReadonlyRef<number> | null>(null);

  const animationState = (() => {
    if (elapsedTimeRef.current !== null && pulseRef.current !== null) {
      return {
        elapsedTime: elapsedTimeRef.current,
        pulse: pulseRef.current,
      };
    }

    const elapsedTime = AtomRef.make(0);
    const pulse = elapsedTime.map(
      (time) => 0.35 + ((Math.sin(time * 3) + 1) / 2) * 0.65,
    );

    elapsedTimeRef.current = elapsedTime;
    pulseRef.current = pulse;

    return { elapsedTime, pulse };
  })();

  const colors = useMemo(() => STATUS_COLORS[status], [status]);
  const darkColor = useMemo(() => new Color(colors.dark), [colors.dark]);
  const brightColor = useMemo(() => new Color(colors.bright), [colors.bright]);
  const animatedColor = useMemo(() => new Color(colors.dark), [colors.dark]);

  useFrame(({ clock }) => {
    animationState.elapsedTime.set(clock.elapsedTime);
    const pulse = animationState.pulse.value;
    animatedColor.lerpColors(darkColor, brightColor, pulse);

    if (bodyMaterialRef.current) {
      bodyMaterialRef.current.color.copy(animatedColor);
      bodyMaterialRef.current.emissive.copy(animatedColor);
      bodyMaterialRef.current.emissiveIntensity = 0.2 + pulse * 1.4;
    }

    if (domeMaterialRef.current) {
      domeMaterialRef.current.color.copy(animatedColor);
      domeMaterialRef.current.emissive.copy(animatedColor);
      domeMaterialRef.current.emissiveIntensity = 0.2 + pulse * 1.4;
    }
  });

  return (
    <group {...props}>
      <mesh position={[0, SHAFT_Y, 0]}>
        <cylinderGeometry
          args={[SHAFT_RADIUS, SHAFT_RADIUS, SHAFT_HEIGHT, 12]}
        />
        <meshStandardMaterial
          color={SHAFT_COLOR}
          roughness={0.65}
          metalness={0.05}
        />
      </mesh>

      <mesh position={[0, COLLAR_Y, 0]}>
        <cylinderGeometry
          args={[COLLAR_RADIUS, COLLAR_RADIUS, COLLAR_HEIGHT, 12]}
        />
        <meshStandardMaterial
          color={COLLAR_COLOR}
          roughness={0.6}
          metalness={0.06}
        />
      </mesh>

      <mesh position={[0, 0, 0]}>
        <cylinderGeometry
          args={[
            LIGHT_BODY_TOP_RADIUS,
            LIGHT_BODY_BOTTOM_RADIUS,
            LIGHT_BODY_HEIGHT,
            12,
          ]}
        />
        <meshStandardMaterial
          ref={bodyMaterialRef}
          color={colors.bright}
          emissive={colors.bright}
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[0, LIGHT_DOME_Y, 0]}>
        <sphereGeometry args={[LIGHT_DOME_RADIUS, 12, 10]} />
        <meshStandardMaterial
          ref={domeMaterialRef}
          color={colors.bright}
          emissive={colors.bright}
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
