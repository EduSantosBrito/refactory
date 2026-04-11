import { useFrame } from "@react-three/fiber";
import { AtomRef } from "effect/unstable/reactivity";
import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import type {
  Mesh,
  MeshStandardMaterial,
  PointLight,
  BufferGeometry,
} from "three";
import { ExtrudeGeometry, IcosahedronGeometry, Shape } from "three";
import {
  BELT_COLORS,
  BELT_MAT,
  DEFAULT_BELT_RATE_PER_MINUTE,
  resolveBeltSpeed,
} from "../belt/constants";
import { useGrooveMaterial } from "../belt/useGrooveMaterial";
import { PortDock } from "../belt/PortDock";
import { SMELTER_PORTS } from "../belt/ports";
import type { ModelProps } from "../colors";
import type { StatusPoleStatus } from "../StatusPole";

type IndustrialSmelterProps = ModelProps & {
  status?: StatusPoleStatus;
};

type StaticMeshProps = ModelProps & {
  castShadow?: boolean;
  receiveShadow?: boolean;
  children: ReactNode;
};

type BevelBoxProps = StaticMeshProps & {
  size: [number, number, number];
  bevel?: number;
};

const BODY_MAT = { roughness: 0.75, metalness: 0.25 } as const;
const BODY_LIGHT_MAT = { roughness: 0.7, metalness: 0.2 } as const;
const STRUCT_MAT = { roughness: 0.8, metalness: 0.4 } as const;
const STRUCT_MID_MAT = { roughness: 0.75, metalness: 0.35 } as const;
const ACCENT_MAT = { roughness: 0.55, metalness: 0.45 } as const;
const ACCENT_DARK_MAT = { roughness: 0.65, metalness: 0.4 } as const;
const METAL_MAT = { roughness: 0.4, metalness: 0.75 } as const;
const GLOW_MAT = { roughness: 0.15, metalness: 0.05 } as const;
const RECESS_MAT = { roughness: 0.95, metalness: 0.1 } as const;
const SCREEN_MAT = { roughness: 0.1, metalness: 0.02 } as const;

const C = {
  body: "#b8b4aa",
  bodyLight: "#ccc8bc",
  structure: "#3e3d42",
  structureMid: "#55545a",
  accent: "#d47a1a",
  accentDark: "#a35c0e",
  metal: "#7a7980",
  glow: "#ff7733",
  recess: "#222228",
  gaugeFace: "#eee8d8",
  smoke: "#667788",
} as const;

const STATUS_SCREEN: Record<StatusPoleStatus, string> = {
  green: "#44dd88",
  yellow: "#ffaa22",
  red: "#ff5555",
};

const HOT_EMISSIVE = "#ff3300";
const SCREEN_EMISSIVE: Record<StatusPoleStatus, string> = {
  green: "#22aa55",
  yellow: "#cc7700",
  red: "#aa2222",
};

const MODEL_SCALE = 1 / 6.15;
const RAW_PORT_MID_X = 0.475;
const RAW_PORT_Y = 1.08;
const BELT_PORT_Y = 0.2;
const MODEL_Y_OFFSET = BELT_PORT_Y - RAW_PORT_Y * MODEL_SCALE;

const BELT_BASE_H = 0.05;
const BELT_FRAME_H = 0.2;
const BELT_SURFACE_W = 0.7;
const BELT_FRAME_W = 0.82;
const BELT_BASE_W = 0.9;
const BELT_RAIL_W = 0.06;
const BELT_RAIL_H = 0.03;
const BELT_ACCENT_Y = BELT_BASE_H + 0.01;
const BELT_GROOVE_REPEAT = 8;

function createBevelBoxGeometry(
  width: number,
  height: number,
  depth: number,
  bevel: number = 0.04,
) {
  const hw = width / 2 - bevel;
  const hh = height / 2 - bevel;
  const shape = new Shape();
  shape.moveTo(-hw, -hh);
  shape.lineTo(-hw, hh);
  shape.lineTo(-hw + bevel, hh + bevel);
  shape.lineTo(hw - bevel, hh + bevel);
  shape.lineTo(hw, hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw - bevel, -hh - bevel);
  shape.lineTo(-hw + bevel, -hh - bevel);
  shape.closePath();

  const geometry = new ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, -(depth - bevel * 2) / 2);
  return geometry;
}

function createExtrudedPolygonGeometry(
  points: ReadonlyArray<readonly [number, number]>,
  depth: number,
  bevel: number,
) {
  const shape = new Shape();
  const [firstX, firstY] = points[0]!;
  shape.moveTo(firstX, firstY);
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i]!;
    shape.lineTo(x, y);
  }
  shape.closePath();

  const geometry = new ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, -(depth - bevel * 2) / 2);
  return geometry;
}

function BevelBox({
  size,
  bevel = 0.04,
  children,
  ...props
}: BevelBoxProps) {
  const geometry = useMemo(
    () => createBevelBoxGeometry(size[0], size[1], size[2], bevel),
    [size, bevel],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <mesh geometry={geometry} {...props}>
      {children}
    </mesh>
  );
}

function StaticGeometryMesh({
  geometry,
  children,
  ...props
}: StaticMeshProps & { geometry: BufferGeometry }) {
  return (
    <mesh geometry={geometry} {...props}>
      {children}
    </mesh>
  );
}

type NarrowBeltRunProps = ModelProps & {
  length: number;
  ratePerMinute?: number;
  endCap?: "start" | "end" | "both";
};

function NarrowBeltRun({
  length,
  ratePerMinute = DEFAULT_BELT_RATE_PER_MINUTE,
  endCap,
  ...props
}: NarrowBeltRunProps) {
  const overlayRef = useRef<Mesh>(null);
  const beltSpeed = resolveBeltSpeed({ ratePerMinute });
  const repeat = length * BELT_GROOVE_REPEAT;

  // Dual-mode groove material (GLSL for WebGL, TSL for WebGPU)
  const { material: grooveMaterial } = useGrooveMaterial({
    repeat,
    running: true,
    speed: beltSpeed,
  });

  return (
    <group {...props}>
      <mesh position={[0, BELT_BASE_H / 2, 0]}>
        <boxGeometry args={[length, BELT_BASE_H, BELT_BASE_W]} />
        <meshStandardMaterial color={BELT_COLORS.base} {...BELT_MAT.base} />
      </mesh>

      <mesh position={[0, BELT_ACCENT_Y, 0]}>
        <boxGeometry args={[length, 0.015, BELT_FRAME_W + 0.01]} />
        <meshStandardMaterial
          color={BELT_COLORS.accent}
          {...BELT_MAT.accent}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      <mesh position={[0, BELT_BASE_H + (BELT_FRAME_H - BELT_BASE_H) / 2, 0]}>
        <boxGeometry args={[length, BELT_FRAME_H - BELT_BASE_H, BELT_FRAME_W]} />
        <meshStandardMaterial color={BELT_COLORS.frame} {...BELT_MAT.frame} />
      </mesh>

      <mesh
        position={[0, BELT_FRAME_H + 0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[length, BELT_SURFACE_W]} />
        <meshStandardMaterial
          color={BELT_COLORS.surface}
          {...BELT_MAT.surface}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[
            0,
            BELT_FRAME_H + BELT_RAIL_H / 2,
            side * (BELT_SURFACE_W / 2 + BELT_RAIL_W / 2),
          ]}
        >
          <boxGeometry args={[length, BELT_RAIL_H, BELT_RAIL_W]} />
          <meshStandardMaterial color={BELT_COLORS.rail} {...BELT_MAT.rail} />
        </mesh>
      ))}

      {/* ── Groove overlay — TSL scrolling motion lines ── */}
      <mesh
        ref={overlayRef}
        position={[0, BELT_FRAME_H + 0.003, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={grooveMaterial}
      >
        <planeGeometry args={[length, BELT_SURFACE_W]} />
      </mesh>

      {(endCap === "start" || endCap === "both") && (
        <mesh position={[-length / 2, BELT_FRAME_H / 2, 0]}>
          <boxGeometry
            args={[0.02, BELT_FRAME_H * 0.7, BELT_SURFACE_W + 0.02]}
          />
          <meshStandardMaterial color={BELT_COLORS.cap} {...BELT_MAT.cap} />
        </mesh>
      )}
      {(endCap === "end" || endCap === "both") && (
        <mesh position={[length / 2, BELT_FRAME_H / 2, 0]}>
          <boxGeometry
            args={[0.02, BELT_FRAME_H * 0.7, BELT_SURFACE_W + 0.02]}
          />
          <meshStandardMaterial color={BELT_COLORS.cap} {...BELT_MAT.cap} />
        </mesh>
      )}
    </group>
  );
}

type SmokeSeed = {
  speed: number;
  driftX: number;
  driftZ: number;
  baseX: number;
  baseZ: number;
  maxY: number;
  phase: number;
  radius: number;
};

type EmberSeed = {
  speed: number;
  baseY: number;
  maxY: number;
  phase: number;
  driftX: number;
};

function SmokeParticles({ active }: { active: boolean }) {
  const refs = useRef<Mesh[]>([]);
  const geometry = useMemo(() => new IcosahedronGeometry(0.08, 0), []);
  const seeds = useMemo<SmokeSeed[]>(
    () =>
      Array.from({ length: 20 }, () => ({
        speed: 0.25 + Math.random() * 0.4,
        driftX: (Math.random() - 0.5) * 0.2,
        driftZ: (Math.random() - 0.5) * 0.15,
        baseX: 0.6 + (Math.random() - 0.5) * 0.1,
        baseZ: -0.85 + (Math.random() - 0.5) * 0.1,
        maxY: 6.5 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        radius: 0.06 + Math.random() * 0.1,
      })),
    [],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame(({ clock }, delta) => {
    for (let i = 0; i < refs.current.length; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;

      const material = mesh.material as MeshStandardMaterial;
      if (!active) {
        mesh.visible = false;
        material.opacity = 0;
        continue;
      }

      mesh.visible = true;
      const seed = seeds[i];
      if (!seed) continue;
      mesh.position.y += seed.speed * delta;
      mesh.position.x += seed.driftX * delta * 0.3;
      mesh.position.x += Math.sin(clock.elapsedTime * 0.4 + seed.phase) * delta * 0.12;
      mesh.position.z += seed.driftZ * delta * 0.3;

      const life = (mesh.position.y - 3.8) / (seed.maxY - 3.8);
      material.opacity = Math.max(0, 0.2 * (1 - life));
      mesh.scale.setScalar(1 + life * 0.5);

      if (mesh.position.y > seed.maxY) {
        mesh.position.set(
          seed.baseX + (Math.random() - 0.5) * 0.1,
          3.8,
          seed.baseZ + (Math.random() - 0.5) * 0.1,
        );
        mesh.scale.setScalar(seed.radius / 0.08);
      }
    }
  });

  return (
    <group>
      {seeds.map((seed, index) => (
        <mesh
          key={`smoke-${index}`}
          geometry={geometry}
          ref={(mesh) => {
            if (mesh) {
              refs.current[index] = mesh;
              mesh.position.set(
                seed.baseX,
                3.8 + Math.random() * 2.5,
                seed.baseZ,
              );
              mesh.scale.setScalar(seed.radius / 0.08);
            }
          }}
          castShadow={false}
        >
          <meshStandardMaterial
            color={C.smoke}
            transparent
            opacity={active ? 0.2 : 0}
            roughness={1}
            metalness={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function EmberParticles({ active }: { active: boolean }) {
  const refs = useRef<Mesh[]>([]);
  const geometry = useMemo(() => new IcosahedronGeometry(0.018, 0), []);
  const seeds = useMemo<EmberSeed[]>(
    () =>
      Array.from({ length: 10 }, () => ({
        speed: 0.4 + Math.random() * 0.8,
        baseY: 0.5,
        maxY: 1.8 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        driftX: (Math.random() - 0.5) * 0.4,
      })),
    [],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame(({ clock }, delta) => {
    for (let i = 0; i < refs.current.length; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;

      const material = mesh.material as MeshStandardMaterial;
      if (!active) {
        mesh.visible = false;
        material.opacity = 0;
        material.emissiveIntensity = 0;
        continue;
      }

      mesh.visible = true;
      const seed = seeds[i];
      if (!seed) continue;
      mesh.position.y += seed.speed * delta * 0.7;
      mesh.position.x += seed.driftX * delta * 0.25;
      mesh.position.x += Math.sin(clock.elapsedTime * 2 + seed.phase) * delta * 0.2;

      const life = (mesh.position.y - seed.baseY) / (seed.maxY - seed.baseY);
      material.opacity = Math.max(0, 1 - life);
      material.emissiveIntensity = Math.max(0, 1.8 * (1 - life));

      if (mesh.position.y > seed.maxY) {
        mesh.position.set(
          2.5 + Math.random() * 1.2,
          0.7 + Math.random() * 0.3,
          (Math.random() - 0.5) * 0.7,
        );
      }
    }
  });

  return (
    <group>
      {seeds.map((_, index) => (
        <mesh
          key={`ember-${index}`}
          geometry={geometry}
          ref={(mesh) => {
            if (mesh) {
              refs.current[index] = mesh;
              mesh.position.set(
                2.5 + Math.random() * 1.2,
                0.7 + Math.random() * 0.3,
                (Math.random() - 0.5) * 0.7,
              );
            }
          }}
        >
          <meshStandardMaterial
            color="#ff6600"
            emissive="#ff4400"
            emissiveIntensity={active ? 1.8 : 0}
            transparent
            opacity={active ? 1 : 0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export function IndustrialSmelter({
  status = "green",
  ...props
}: IndustrialSmelterProps) {
  const glowActive = status === "green" || status === "yellow";
  const smokeActive = status === "green";
  const elapsedTimeRef = useRef<AtomRef.AtomRef<number> | null>(null);
  const glowPulseRef = useRef<AtomRef.ReadonlyRef<number> | null>(null);
  const screenPulseRef = useRef<AtomRef.ReadonlyRef<number> | null>(null);
  const gaugeAngleRef = useRef<AtomRef.ReadonlyRef<number> | null>(null);
  const valveRotationRef = useRef<AtomRef.ReadonlyRef<number> | null>(null);

  if (
    elapsedTimeRef.current === null ||
    glowPulseRef.current === null ||
    screenPulseRef.current === null ||
    gaugeAngleRef.current === null ||
    valveRotationRef.current === null
  ) {
    const elapsedTime = AtomRef.make(0);
    elapsedTimeRef.current = elapsedTime;
    glowPulseRef.current = elapsedTime.map(
      (time) => 0.75 + Math.sin(time * 2) * 0.25,
    );
    screenPulseRef.current = elapsedTime.map(
      (time) => 0.6 + Math.sin(time * 1.2) * 0.15,
    );
    gaugeAngleRef.current = elapsedTime.map(
      (time) => -0.4 + Math.sin(time * 0.6) * 0.12,
    );
    valveRotationRef.current = elapsedTime.map((time) => time * 1.6);
  }

  const animationState = {
    elapsedTime: elapsedTimeRef.current!,
    glowPulse: glowPulseRef.current!,
    screenPulse: screenPulseRef.current!,
    gaugeAngle: gaugeAngleRef.current!,
    valveRotation: valveRotationRef.current!,
  };

  const viewportMaterialRefs = useRef<MeshStandardMaterial[]>([]);
  const ingotMaterialRefs = useRef<MeshStandardMaterial[]>([]);
  const indicatorMaterialRefs = useRef<MeshStandardMaterial[]>([]);
  const screenMaterialRef = useRef<MeshStandardMaterial>(null);
  const gaugeNeedleRef = useRef<Mesh>(null);
  const valveWheelRef = useRef<Mesh>(null);
  const innerGlowRef = useRef<PointLight>(null);
  const heatGlowRef = useRef<PointLight>(null);

  const houseOuterGeometry = useMemo(
    () => createBevelBoxGeometry(3, 2.1, 2.8, 0.06),
    [],
  );
  const chuteBodyGeometry = useMemo(
    () =>
      createExtrudedPolygonGeometry(
        [
          [0, 0.3],
          [0, 0.75],
          [1.5, 0.38],
          [1.5, -0.05],
        ],
        1.1,
        0.03,
      ),
    [],
  );
  const chuteWallGeometry = useMemo(
    () =>
      createExtrudedPolygonGeometry(
        [
          [0, 0.3],
          [0, 0.82],
          [1.5, 0.44],
          [1.5, -0.08],
        ],
        0.05,
        0.015,
      ),
    [],
  );

  useEffect(() => {
    return () => {
      houseOuterGeometry.dispose();
      chuteBodyGeometry.dispose();
      chuteWallGeometry.dispose();
    };
  }, [houseOuterGeometry, chuteBodyGeometry, chuteWallGeometry]);

  useFrame(({ clock }) => {
    animationState.elapsedTime.set(clock.elapsedTime);

    const glowPulse = glowActive ? animationState.glowPulse.value : 0;
    const screenPulse = glowActive ? animationState.screenPulse.value : 0.2;

    for (const material of viewportMaterialRefs.current) {
      if (!material) continue;
      material.emissiveIntensity = glowActive ? 1 + glowPulse * 0.4 : 0;
    }

    for (const material of ingotMaterialRefs.current) {
      if (!material) continue;
      material.emissiveIntensity = glowActive ? 0.9 + glowPulse * 0.5 : 0;
    }

    if (screenMaterialRef.current) {
      screenMaterialRef.current.color.set(STATUS_SCREEN[status]);
      screenMaterialRef.current.emissive.set(SCREEN_EMISSIVE[status]);
      screenMaterialRef.current.emissiveIntensity = screenPulse;
    }

    for (let i = 0; i < indicatorMaterialRefs.current.length; i++) {
      const material = indicatorMaterialRefs.current[i];
      if (!material) continue;
      const activeIndex =
        status === "green" ? 1 : status === "yellow" ? 2 : 0;
      material.emissiveIntensity = i === activeIndex ? 0.8 : 0.2;
    }

    if (gaugeNeedleRef.current) {
      gaugeNeedleRef.current.rotation.z = animationState.gaugeAngle.value;
    }

    if (valveWheelRef.current) {
      valveWheelRef.current.rotation.z = animationState.valveRotation.value;
    }

    if (innerGlowRef.current) {
      innerGlowRef.current.intensity = glowActive ? 2.5 * glowPulse : 0;
    }

    if (heatGlowRef.current) {
      const shiftedPulse =
        glowActive ? 0.75 + Math.sin(clock.elapsedTime * 2.3 + 1) * 0.25 : 0;
      heatGlowRef.current.intensity = 1.5 * shiftedPulse;
    }
  });

  return (
    <group {...props}>
      {SMELTER_PORTS.inputs.map((port) => (
        <PortDock key={port.id} port={port} />
      ))}
      {SMELTER_PORTS.outputs.map((port) => (
        <PortDock key={port.id} port={port} />
      ))}

      <pointLight
        ref={innerGlowRef}
        color="#ff5500"
        intensity={glowActive ? 1.8 : 0}
        distance={0.8}
        position={[-0.053, 0.252, 0]}
      />
      <pointLight
        ref={heatGlowRef}
        color="#ff4400"
        intensity={glowActive ? 1.2 : 0}
        distance={0.7}
        position={[0.297, 0.162, 0]}
      />

      <group scale={MODEL_SCALE} position={[0, MODEL_Y_OFFSET, 0]}>
        <group position={[-RAW_PORT_MID_X, 0, 0]}>
          <group position={[0.15, 0.22 + 2.1 / 2, 0]}>
            <StaticGeometryMesh
              geometry={houseOuterGeometry}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color={C.body} {...BODY_MAT} />
            </StaticGeometryMesh>
          </group>

          <BevelBox
            size={[2.8, 0.16, 2.6]}
            bevel={0.04}
            position={[0.15, 0.22 + 2.1 + 0.08, 0]}
            castShadow
          >
            <meshStandardMaterial color={C.bodyLight} {...BODY_LIGHT_MAT} />
          </BevelBox>

          <BevelBox
            size={[3.06, 0.06, 2.86]}
            bevel={0.02}
            position={[0.15, 0.22 + 2.1 + 0.03, 0]}
          >
            <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
          </BevelBox>

          <BevelBox
            size={[3.08, 0.14, 2.88]}
            bevel={0.03}
            position={[0.15, 0.29, 0]}
            castShadow
          >
            <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
          </BevelBox>

          <BevelBox
            size={[2, 1.3, 0.06]}
            bevel={0.03}
            position={[0.15, 1.45, 1.401]}
          >
            <meshStandardMaterial color={C.recess} {...RECESS_MAT} />
          </BevelBox>

          <BevelBox
            size={[2.2, 1.5, 0.03]}
            bevel={0.02}
            position={[0.15, 1.45, 1.391]}
          >
            <meshStandardMaterial color={C.structureMid} {...STRUCT_MID_MAT} />
          </BevelBox>

          {[-0.2, 0.5].map((x, index) => (
            <group key={`viewport-${x}`}>
              <BevelBox
                size={[0.4, 0.28, 0.05]}
                bevel={0.02}
                position={[x, 1.55, 1.43]}
              >
                <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
              </BevelBox>
              <mesh position={[x, 1.55, 1.46]}>
                <planeGeometry args={[0.28, 0.16]} />
                <meshStandardMaterial
                  ref={(material) => {
                    if (material) {
                      viewportMaterialRefs.current[index] = material;
                    }
                  }}
                  color={C.glow}
                  emissive={HOT_EMISSIVE}
                  emissiveIntensity={1.3}
                  roughness={0.05}
                  transparent
                  opacity={0.85}
                />
              </mesh>
            </group>
          ))}

          <BevelBox
            size={[0.7, 0.9, 0.05]}
            bevel={0.02}
            position={[0.15, 1.1, 1.416]}
          >
            <meshStandardMaterial color={C.recess} {...RECESS_MAT} />
          </BevelBox>

          <BevelBox
            size={[0.6, 0.8, 0.04]}
            bevel={0.02}
            position={[0.15, 1.1, 1.44]}
            castShadow
          >
            <meshStandardMaterial color={C.structureMid} {...STRUCT_MID_MAT} />
          </BevelBox>

          <BevelBox
            size={[0.06, 0.25, 0.08]}
            bevel={0.015}
            position={[0.4, 1.15, 1.48]}
          >
            <meshStandardMaterial color={C.metal} {...METAL_MAT} />
          </BevelBox>

          {[-0.25, 0.25].map((y) => (
            <BevelBox
              key={`hinge-${y}`}
              size={[0.1, 0.08, 0.1]}
              bevel={0.015}
              position={[-0.12, 1.1 + y, 1.46]}
            >
              <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
            </BevelBox>
          ))}

          {[
            { z: 1.401, rotationY: 0 },
            { z: -1.401, rotationY: Math.PI },
          ].map(({ z, rotationY }, sideIndex) => (
            <group key={`face-band-${z}`}>
              <BevelBox
                size={[2.2, 1.1, 0.05]}
                bevel={0.025}
                position={[0.15, 1.5, z]}
                rotation={[0, rotationY, 0]}
              >
                <meshStandardMaterial color={C.recess} {...RECESS_MAT} />
              </BevelBox>
              {[1, 1.9].map((y) => (
                <BevelBox
                  key={`seam-${y}`}
                  size={[2.6, 0.03, 0.02]}
                  bevel={0.005}
                  position={[0.15, y, z + (sideIndex === 0 ? 0.01 : -0.01)]}
                >
                  <meshStandardMaterial
                    color={C.structure}
                    {...STRUCT_MAT}
                    emissive={C.structure}
                    emissiveIntensity={0}
                  />
                </BevelBox>
              ))}
            </group>
          ))}

          <BevelBox
            size={[1.2, 1.8, 0.05]}
            bevel={0.025}
            position={[-1.351, 1.4, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <meshStandardMaterial color={C.recess} {...RECESS_MAT} />
          </BevelBox>

          <BevelBox
            size={[1.2, 1.8, 0.05]}
            bevel={0.025}
            position={[1.651, 1.4, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <meshStandardMaterial color={C.recess} {...RECESS_MAT} />
          </BevelBox>

          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <BevelBox
                key={`pillar-${x}-${z}`}
                size={[0.14, 2.14, 0.14]}
                bevel={0.02}
                position={[0.15 + x * 1.45, 1.27, z * 1.35]}
                castShadow
              >
                <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
              </BevelBox>
            )),
          )}

          <group position={[-1.85, 0.98, 0]}>
            <mesh position={[0, 0.75, 0]} castShadow>
              <cylinderGeometry args={[0.75, 0.55, 1.5, 8]} />
              <meshStandardMaterial color={C.accent} {...ACCENT_MAT} />
            </mesh>
            <mesh position={[0, 1.55, 0]} castShadow>
              <cylinderGeometry args={[0.85, 0.82, 0.1, 8]} />
              <meshStandardMaterial
                color={C.accentDark}
                {...ACCENT_DARK_MAT}
              />
            </mesh>
            <mesh position={[0, 1.5, 0]}>
              <cylinderGeometry args={[0.68, 0.68, 0.08, 8]} />
              <meshStandardMaterial color={C.recess} {...RECESS_MAT} />
            </mesh>
            <mesh position={[0, -0.05, 0]}>
              <cylinderGeometry args={[0.4, 0.35, 0.2, 8]} />
              <meshStandardMaterial
                color={C.accentDark}
                {...ACCENT_DARK_MAT}
              />
            </mesh>

            {[0.35, 0.75, 1.15].map((y) => (
              <mesh key={`hopper-ring-${y}`} position={[0, y, 0]}>
                <cylinderGeometry
                  args={[0.68 + y * 0.04, 0.56 + y * 0.04, 0.06, 8]}
                />
                <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
              </mesh>
            ))}

            {[-0.5, 0.5].map((z) => (
              <group key={`hopper-bracket-${z}`}>
                <BevelBox
                  size={[0.12, 0.6, 0.12]}
                  bevel={0.02}
                  position={[0.5, 0.3, z]}
                  castShadow
                >
                  <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
                </BevelBox>
                <BevelBox
                  size={[0.2, 0.08, 0.1]}
                  bevel={0.015}
                  position={[0.5, 0.6, z]}
                >
                  <meshStandardMaterial
                    color={C.structureMid}
                    {...STRUCT_MID_MAT}
                  />
                </BevelBox>
              </group>
            ))}

            <BevelBox
              size={[1.6, 0.45, 0.8]}
              bevel={0.04}
              position={[1.1, 0.1, 0]}
              castShadow
            >
              <meshStandardMaterial
                color={C.structureMid}
                {...STRUCT_MID_MAT}
              />
            </BevelBox>
            <BevelBox
              size={[1.3, 0.25, 0.55]}
              bevel={0.02}
              position={[1.1, 0.15, 0]}
            >
              <meshStandardMaterial color={C.recess} {...RECESS_MAT} />
            </BevelBox>
            <BevelBox
              size={[0.2, 0.65, 1]}
              bevel={0.03}
              position={[1.85, 0.1, 0]}
              castShadow
            >
              <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
            </BevelBox>

            {[-0.3, 0.3].flatMap((z) =>
              [-0.15, 0.15].map((y) => (
                <mesh
                  key={`feed-bolt-${z}-${y}`}
                  rotation={[0, 0, Math.PI / 2]}
                  position={[1.95, 0.1 + y, z]}
                >
                  <cylinderGeometry args={[0.025, 0.025, 0.04, 6]} />
                  <meshStandardMaterial color={C.metal} {...METAL_MAT} />
                </mesh>
              )),
            )}
          </group>

          <group position={[1.7, 0.55, 0]}>
            <StaticGeometryMesh geometry={chuteBodyGeometry} castShadow>
              <meshStandardMaterial color={C.metal} {...METAL_MAT} />
            </StaticGeometryMesh>

            {[-0.52, 0.52].map((z) => (
              <StaticGeometryMesh
                key={`chute-wall-${z}`}
                geometry={chuteWallGeometry}
                position={[0, 0, z]}
                castShadow
              >
                <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
              </StaticGeometryMesh>
            ))}

            <BevelBox
              size={[0.16, 0.55, 0.16]}
              bevel={0.025}
              position={[1.35, -0.22, 0]}
              castShadow
            >
              <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
            </BevelBox>

            <BevelBox
              size={[0.24, 0.05, 0.24]}
              bevel={0.015}
              position={[1.35, -0.47, 0]}
            >
              <meshStandardMaterial
                color={C.structureMid}
                {...STRUCT_MID_MAT}
              />
            </BevelBox>

            <BevelBox
              size={[0.7, 0.45, 0.9]}
              bevel={0.04}
              position={[1.7, -0.2, 0]}
              castShadow
            >
              <meshStandardMaterial color={C.accent} {...ACCENT_MAT} />
            </BevelBox>
            <BevelBox
              size={[0.5, 0.12, 0.7]}
              bevel={0.02}
              position={[1.7, 0.02, 0]}
            >
              <meshStandardMaterial color={C.recess} {...RECESS_MAT} />
            </BevelBox>
            <BevelBox
              size={[0.76, 0.05, 0.96]}
              bevel={0.02}
              position={[1.7, 0.05, 0]}
            >
              <meshStandardMaterial
                color={C.accentDark}
                {...ACCENT_DARK_MAT}
              />
            </BevelBox>

            {[0, 1, 2].map((index) => (
              <BevelBox
                key={`ingot-${index}`}
                size={[0.28, 0.06, 0.14]}
                bevel={0.01}
                position={[
                  1.7 + (index - 1) * 0.04,
                  -0.03 + index * 0.065,
                  (index - 1) * 0.12,
                ]}
                rotation={[0, (index - 1) * 0.25, 0]}
                castShadow
              >
                <meshStandardMaterial
                  ref={(material) => {
                    if (material) {
                      ingotMaterialRefs.current[index] = material;
                    }
                  }}
                  color={C.glow}
                  emissive={HOT_EMISSIVE}
                  emissiveIntensity={1.4}
                  {...GLOW_MAT}
                />
              </BevelBox>
            ))}
          </group>

          <group position={[0.6, 2.38, -0.85]}>
            <mesh position={[0, 0.05, 0]} castShadow>
              <cylinderGeometry args={[0.38, 0.38, 0.1, 8]} />
              <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
            </mesh>
            <mesh position={[0, 0.7, 0]} castShadow>
              <cylinderGeometry args={[0.22, 0.3, 1.2, 8]} />
              <meshStandardMaterial color={C.body} {...BODY_MAT} />
            </mesh>
            <mesh position={[0, 0.55, 0]}>
              <cylinderGeometry args={[0.21, 0.27, 0.08, 8]} />
              <meshStandardMaterial color={C.recess} {...RECESS_MAT} />
            </mesh>
            {[0.3, 0.7, 1.05].map((y) => {
              const radius = 0.3 - y * 0.05 + 0.03;
              return (
                <mesh key={`exhaust-ring-${y}`} position={[0, y, 0]}>
                  <cylinderGeometry args={[radius, radius, 0.04, 8]} />
                  <meshStandardMaterial
                    color={C.structure}
                    {...STRUCT_MAT}
                  />
                </mesh>
              );
            })}
            <mesh position={[0, 1.45, 0]} castShadow>
              <cylinderGeometry args={[0.3, 0.28, 0.06, 8]} />
              <meshStandardMaterial color={C.metal} {...METAL_MAT} />
            </mesh>
            {Array.from({ length: 4 }, (_, index) => {
              const angle = (index / 4) * Math.PI * 2;
              return (
                <BevelBox
                  key={`cap-post-${index}`}
                  size={[0.04, 0.12, 0.04]}
                  bevel={0.008}
                  position={[
                    Math.cos(angle) * 0.15,
                    1.36,
                    Math.sin(angle) * 0.15,
                  ]}
                >
                  <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
                </BevelBox>
              );
            })}
            <BevelBox
              size={[0.08, 0.6, 0.08]}
              bevel={0.015}
              position={[0.25, 0.35, 0]}
              rotation={[0, 0, -0.45]}
              castShadow
            >
              <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
            </BevelBox>
          </group>

          <group position={[-0.5, 2.38, -0.95]}>
            <mesh position={[0, 0.03, 0]}>
              <cylinderGeometry args={[0.18, 0.18, 0.06, 6]} />
              <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
            </mesh>
            <mesh position={[0, 0.36, 0]} castShadow>
              <cylinderGeometry args={[0.1, 0.14, 0.6, 6]} />
              <meshStandardMaterial color={C.body} {...BODY_MAT} />
            </mesh>
            <mesh position={[0, 0.7, 0]}>
              <cylinderGeometry args={[0.15, 0.12, 0.04, 6]} />
              <meshStandardMaterial color={C.metal} {...METAL_MAT} />
            </mesh>
          </group>

          <group>
            <mesh position={[-1.1, 1.175, 1.52]}>
              <cylinderGeometry args={[0.055, 0.055, 1.05, 6]} />
              <meshStandardMaterial color={C.metal} {...METAL_MAT} />
            </mesh>
            <mesh
              position={[-0.4, 1.9, 1.52]}
              rotation={[0, 0, -Math.atan2(1.4, 0.4)]}
            >
              <cylinderGeometry args={[0.055, 0.055, 1.456, 6]} />
              <meshStandardMaterial color={C.metal} {...METAL_MAT} />
            </mesh>
            <mesh position={[-1.1, 1.7, 1.52]}>
              <cylinderGeometry args={[0.08, 0.08, 0.08, 8]} />
              <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
            </mesh>
            <mesh
              position={[-1.1, 1.1, 1.52]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.09, 0.09, 0.16, 8]} />
              <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
            </mesh>
            <mesh ref={valveWheelRef} position={[-1.1, 1.1, 1.67]}>
              <torusGeometry args={[0.1, 0.025, 6, 8]} />
              <meshStandardMaterial color={C.accent} {...ACCENT_MAT} />
            </mesh>
            <BevelBox
              size={[0.02, 0.16, 0.02]}
              bevel={0.005}
              position={[-1.1, 1.1, 1.67]}
            >
              <meshStandardMaterial
                color={C.accentDark}
                {...ACCENT_DARK_MAT}
              />
            </BevelBox>
          </group>

          <group position={[1.2, 1.65, 1.43]}>
            <BevelBox size={[0.55, 0.65, 0.06]} bevel={0.02}>
              <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
            </BevelBox>
            <BevelBox
              size={[0.35, 0.2, 0.04]}
              bevel={0.015}
              position={[0, 0.12, 0.03]}
            >
              <meshStandardMaterial color={C.recess} {...RECESS_MAT} />
            </BevelBox>
            <mesh position={[0, 0.12, 0.055]}>
              <planeGeometry args={[0.26, 0.13]} />
              <meshStandardMaterial
                ref={screenMaterialRef}
                color={STATUS_SCREEN[status]}
                emissive={SCREEN_EMISSIVE[status]}
                emissiveIntensity={0.7}
                {...SCREEN_MAT}
              />
            </mesh>

            {[
              { color: "#ff3333", x: -0.12 },
              { color: "#33dd55", x: 0 },
              { color: "#ffaa22", x: 0.12 },
            ].map(({ color, x }, index) => (
              <group key={`indicator-${color}`}>
                <mesh
                  rotation={[Math.PI / 2, 0, 0]}
                  position={[x, -0.1, 0.03]}
                >
                  <cylinderGeometry args={[0.03, 0.03, 0.02, 8]} />
                  <meshStandardMaterial color={C.recess} {...RECESS_MAT} />
                </mesh>
                <mesh
                  rotation={[Math.PI / 2, 0, 0]}
                  position={[x, -0.1, 0.045]}
                >
                  <cylinderGeometry args={[0.02, 0.02, 0.015, 8]} />
                  <meshStandardMaterial
                    ref={(material) => {
                      if (material) {
                        indicatorMaterialRefs.current[index] = material;
                      }
                    }}
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.6}
                    roughness={0.2}
                    metalness={0}
                  />
                </mesh>
              </group>
            ))}

            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.22, 0.04]}>
              <cylinderGeometry args={[0.04, 0.04, 0.03, 8]} />
              <meshStandardMaterial color={C.accent} {...ACCENT_MAT} />
            </mesh>
          </group>

          <group position={[-0.55, 2.05, 1.41]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.17, 0.17, 0.04, 12]} />
              <meshStandardMaterial color={C.recess} {...RECESS_MAT} />
            </mesh>
            <mesh
              rotation={[Math.PI / 2, 0, 0]}
              position={[0, 0, 0.005]}
            >
              <cylinderGeometry args={[0.18, 0.18, 0.025, 12]} />
              <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
            </mesh>
            <mesh position={[0, 0, 0.025]}>
              <circleGeometry args={[0.13, 12]} />
              <meshStandardMaterial
                color={C.gaugeFace}
                roughness={0.6}
                emissive="#221100"
                emissiveIntensity={0.05}
              />
            </mesh>
            <mesh ref={gaugeNeedleRef} position={[0, 0.01, 0.028]}>
              <planeGeometry args={[0.01, 0.09]} />
              <meshStandardMaterial color="#dd2200" />
            </mesh>
          </group>

          <group position={[-2.95, 1.08, 0]}>
            <NarrowBeltRun length={0.7} endCap="start" />
          </group>

          <group position={[-2.075, 1.08, 0]}>
            <NarrowBeltRun length={1.15} />

            {[-0.54, 0.54].map((x) => (
              <BevelBox
                key={`bridge-flange-${x}`}
                size={[0.12, 0.35, 0.95]}
                bevel={0.02}
                position={[x, 0.02, 0]}
                castShadow
              >
                <meshStandardMaterial
                  color={C.structureMid}
                  {...STRUCT_MID_MAT}
                />
              </BevelBox>
            ))}

            {[-0.54, 0.54].flatMap((x) =>
              [-0.3, 0, 0.3].flatMap((z) =>
                [-0.08, 0.08].map((y) => (
                  <mesh
                    key={`bridge-bolt-${x}-${z}-${y}`}
                    rotation={[0, 0, Math.PI / 2]}
                    position={[x + (x < 0 ? -0.06 : 0.06), 0.02 + y, z]}
                  >
                    <cylinderGeometry args={[0.022, 0.022, 0.04, 6]} />
                    <meshStandardMaterial color={C.metal} {...METAL_MAT} />
                  </mesh>
                )),
              ),
            )}

            {[-0.3, 0.3].map((x) => (
              <group key={`bridge-leg-${x}`}>
                <BevelBox
                  size={[0.1, 0.75, 0.1]}
                  bevel={0.02}
                  position={[x, -0.47, 0]}
                  castShadow
                >
                  <meshStandardMaterial color={C.structure} {...STRUCT_MAT} />
                </BevelBox>
                <BevelBox
                  size={[0.18, 0.04, 0.18]}
                  bevel={0.01}
                  position={[x, -0.83, 0]}
                >
                  <meshStandardMaterial
                    color={C.structureMid}
                    {...STRUCT_MID_MAT}
                  />
                </BevelBox>
                <BevelBox
                  size={[0.06, 0.45, 0.06]}
                  bevel={0.01}
                  position={[x + (x < 0 ? 0.15 : -0.15), -0.28, 0]}
                  rotation={[0, 0, x < 0 ? 0.5 : -0.5]}
                >
                  <meshStandardMaterial
                    color={C.structureMid}
                    {...STRUCT_MID_MAT}
                  />
                </BevelBox>
              </group>
            ))}
          </group>

          <group position={[3.3, 1.08, 0]}>
            <BevelBox
              size={[0.14, 0.55, 1.15]}
              bevel={0.03}
              castShadow
            >
              <meshStandardMaterial
                color={C.structureMid}
                {...STRUCT_MID_MAT}
              />
            </BevelBox>
            {[-0.35, 0, 0.35].flatMap((z) =>
              [-0.15, 0, 0.15].map((y) => (
                <mesh
                  key={`output-bolt-${z}-${y}`}
                  rotation={[0, 0, Math.PI / 2]}
                  position={[0.08, y, z]}
                >
                  <cylinderGeometry args={[0.02, 0.02, 0.04, 6]} />
                  <meshStandardMaterial color={C.metal} {...METAL_MAT} />
                </mesh>
              )),
            )}
            <NarrowBeltRun
              length={0.5}
              position={[0.32, -0.06, 0]}
              endCap="end"
            />
          </group>

          <SmokeParticles active={smokeActive} />
          <EmberParticles active={glowActive} />
        </group>
      </group>
    </group>
  );
}
