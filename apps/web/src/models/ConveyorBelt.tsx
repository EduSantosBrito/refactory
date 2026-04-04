import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { MeshStandardMaterial, ShaderMaterial, DoubleSide } from "three";
import type { Group, Mesh, Object3D } from "three";
import type { ModelProps } from "./colors";

const BELT_SPEED = 0.8;

const VARIANT_PATHS = {
  straight: "/models/conveyor.glb",
  "straight-long": "/models/conveyor-long.glb",
  sides: "/models/conveyor-sides.glb",
  stripe: "/models/conveyor-stripe.glb",
  "stripe-sides": "/models/conveyor-stripe-sides.glb",
} as const;

const PRELOAD_PATHS = [
  VARIANT_PATHS.straight,
  VARIANT_PATHS["straight-long"],
  VARIANT_PATHS.sides,
  VARIANT_PATHS.stripe,
  VARIANT_PATHS["stripe-sides"],
] as const;

const OVERLAY_WIDTH: Record<BeltVariant, number> = {
  straight: 0.82,
  "straight-long": 1.82,
  sides: 0.82,
  stripe: 0.82,
  "stripe-sides": 0.82,
};

const BELT_LENGTH: Record<BeltVariant, number> = {
  straight: 1,
  "straight-long": 2,
  sides: 1,
  stripe: 1,
  "stripe-sides": 1,
};

/** 1-unit tile on XZ plane, 0.4 tall. Long variant is 2 units on X. */
export const BELT_TILE = { width: 1, depth: 1, height: 0.4 } as const;

export type BeltVariant = keyof typeof VARIANT_PATHS;
export type BeltContent = "empty" | "filled";
export type BeltState = "idle" | "working";

export interface ConveyorBeltProps extends ModelProps {
  content?: BeltContent;
  state?: BeltState;
  variant?: BeltVariant;
  children?: ReactNode;
  speed?: number;
}

export interface ConveyorLaneSegment {
  key?: string;
  variant?: BeltVariant;
}

export interface ConveyorLaneItem {
  key: string;
  node: ReactNode;
  position?: number;
  height?: number;
  zOffset?: number;
}

export interface ConveyorBeltLaneProps extends ModelProps {
  content?: BeltContent;
  state?: BeltState;
  count?: number;
  segments?: readonly ConveyorLaneSegment[];
  items?: readonly ConveyorLaneItem[];
  speed?: number;
}

/* ── Animated stripe overlay shader ─────────────────────────── */

const stripeVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const stripeFrag = /* glsl */ `
  uniform float uTime;
  uniform float uRepeat;
  varying vec2 vUv;
  void main() {
    float x = vUv.x * uRepeat - uTime;
    // Chevron: fold Y at center so stripes form V pointing in travel direction
    float y = abs(vUv.y - 0.5) * 2.0;
    float chevron = fract(x + y * 0.6);
    float line = smoothstep(0.38, 0.45, chevron) * (1.0 - smoothstep(0.55, 0.62, chevron));
    // Fade at lateral edges
    float edgeFade = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
    gl_FragColor = vec4(0.96, 0.78, 0.26, line * edgeFade * 0.35);
  }
`;

/* ── Helpers ────────────────────────────────────────────────── */

function isMesh(child: Object3D): child is Mesh {
  return "isMesh" in child && child.isMesh === true;
}

function useConveyorModel(variant: BeltVariant) {
  const path = VARIANT_PATHS[variant];
  const { scene } = useGLTF(path);

  return useMemo(() => {
    const cloned = scene.clone();
    // Strip baked Kenney grid-tile offset
    cloned.children.forEach((child) => child.position.set(0, 0, 0));
    // Clone materials so instances don't share state
    cloned.traverse((child) => {
      if (isMesh(child) && child.material instanceof MeshStandardMaterial) {
        child.material = child.material.clone();
      }
    });
    return cloned;
  }, [scene]);
}

function normalizeLoopPosition(value: number) {
  return ((value % 1) + 1) % 1;
}

function getDefaultLaneVariant(_index: number, _total: number): BeltVariant {
  return "straight";
}

function resolveLaneSegments(count: number, segments?: readonly ConveyorLaneSegment[]) {
  const source: readonly ConveyorLaneSegment[] =
    segments && segments.length > 0
      ? segments
      : Array.from({ length: Math.max(1, count) }, (): ConveyorLaneSegment => ({}));

  const resolved = source.map((segment, index) => {
    const variant = segment.variant ?? getDefaultLaneVariant(index, source.length);
    return {
      key: segment.key ?? `${index}-${variant}`,
      variant,
      length: BELT_LENGTH[variant],
    };
  });

  const totalLength = resolved.reduce((sum, segment) => sum + segment.length, 0);
  let cursor = -totalLength / 2;

  return {
    totalLength,
    segments: resolved.map((segment) => {
      const centerX = cursor + segment.length / 2;
      cursor += segment.length;

      return {
        ...segment,
        centerX,
      };
    }),
  };
}

function getLaneItemX(progress: number, totalLength: number) {
  return -totalLength / 2 + progress * totalLength;
}

function ConveyorLaneItem({
  totalLength,
  state,
  content,
  speed,
  item,
}: {
  totalLength: number;
  state: BeltState;
  content: BeltContent;
  speed: number;
  item: ConveyorLaneItem;
}) {
  const groupRef = useRef<Group>(null);
  const progressRef = useRef(normalizeLoopPosition(item.position ?? 0));

  useEffect(() => {
    progressRef.current = normalizeLoopPosition(item.position ?? 0);
  }, [item.position]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || totalLength <= 0) {
      return;
    }

    if (content === "filled" && state === "working") {
      progressRef.current = normalizeLoopPosition(progressRef.current + (delta * speed) / totalLength);
    }

    group.position.x = getLaneItemX(progressRef.current, totalLength);
  });

  return (
    <group
      ref={groupRef}
      position={[
        getLaneItemX(progressRef.current, totalLength),
        BELT_TILE.height + (item.height ?? 0.12),
        item.zOffset ?? 0,
      ]}
      visible={content === "filled"}
    >
      {item.node}
    </group>
  );
}

/* ── Component ──────────────────────────────────────────────── */

export function ConveyorBelt({
  content = "empty",
  state = "working",
  variant = "straight",
  children,
  speed = BELT_SPEED,
  ...props
}: ConveyorBeltProps) {
  const clonedScene = useConveyorModel(variant);
  const overlayMatRef = useRef<ShaderMaterial>(null);

  const running = state === "working";
  const filled = content === "filled";

  useFrame((_, delta) => {
    if (!overlayMatRef.current) return;
    const uTime = overlayMatRef.current.uniforms.uTime;
    if (running && uTime) {
      uTime.value += delta * speed;
    }
  });

  const overlayW = OVERLAY_WIDTH[variant];
  const overlayRepeat = BELT_LENGTH[variant] * 8;

  return (
    <group {...props}>
      <primitive object={clonedScene} />

      {/* Animated chevron overlay on belt surface */}
      <mesh position={[0, BELT_TILE.height + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[overlayW, 0.65]} />
        <shaderMaterial
          ref={overlayMatRef}
          transparent
          depthWrite={false}
          side={DoubleSide}
          vertexShader={stripeVert}
          fragmentShader={stripeFrag}
          uniforms={{ uTime: { value: 0 }, uRepeat: { value: overlayRepeat } }}
        />
      </mesh>

      {filled && children}
    </group>
  );
}

export function ConveyorBeltLane({
  content = "filled",
  state = "working",
  count = 4,
  segments,
  items = [],
  speed = BELT_SPEED,
  ...props
}: ConveyorBeltLaneProps) {
  const lane = useMemo(() => resolveLaneSegments(count, segments), [count, segments]);

  return (
    <group {...props}>
      {lane.segments.map((segment) => (
        <ConveyorBelt
          key={segment.key}
          content={content}
          state={state}
          speed={speed}
          variant={segment.variant}
          position={[segment.centerX, 0, 0]}
        />
      ))}

      {items.map((item) => (
        <ConveyorLaneItem
          key={item.key}
          totalLength={lane.totalLength}
          state={state}
          content={content}
          speed={speed}
          item={item}
        />
      ))}
    </group>
  );
}

// Preload all variants
for (const path of PRELOAD_PATHS) {
  useGLTF.preload(path);
}
