import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AtomRef } from "effect/unstable/reactivity";
import type { AtomRegistry } from "effect/unstable/reactivity";
import { MeshStandardMaterial } from "three";
import type { Group, Mesh } from "three";
import { MAT } from "./colors";
import {
  type GrinderSmokeSpawn,
  type GrinderSmokeState,
  syncMinerMotion,
} from "./Miner.state";
import { MinerLeg } from "./MinerLeg";

// Shared industrial palette (same as MinerLeg)
const HULL_DARK = "#2d3550";
const HULL_MID = "#4a4f5a";
const HULL_LIGHT = "#8a8e95";
const HULL_BRIGHT = "#b0b4ba";
const ACCENT = "#e8945a";
const ACCENT_DARK = "#c4633a";

const LEG_COUNT = 4;
const LEG_RADIUS = 0.2;
const SPIKE_R = 0.032;

function GrindingBall({
  position,
  registry,
  spinOffset = 0,
}: {
  position: [number, number, number];
  registry: AtomRegistry.AtomRegistry;
  spinOffset?: number;
}) {
  const ref = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const { elapsedTime } = syncMinerMotion(registry, clock.elapsedTime);
      const t = elapsedTime + spinOffset;
      ref.current.rotation.x = t * 2.5;
      ref.current.rotation.z = t * 1.8;
    }
  });

  return (
    <group position={position}>
      <group ref={ref}>
        {/* Core ball */}
        <mesh>
          <icosahedronGeometry args={[SPIKE_R, 0]} />
          <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.35} />
        </mesh>
        {/* Spike +X */}
        <mesh position={[SPIKE_R, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.01, 0.02, 4]} />
          <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.4} />
        </mesh>
        {/* Spike -X */}
        <mesh position={[-SPIKE_R, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.01, 0.02, 4]} />
          <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.4} />
        </mesh>
        {/* Spike +Z */}
        <mesh position={[0, 0, SPIKE_R]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.01, 0.02, 4]} />
          <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.4} />
        </mesh>
        {/* Spike -Z */}
        <mesh position={[0, 0, -SPIKE_R]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.01, 0.02, 4]} />
          <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

const SMOKE_COUNT = 8;

function GrinderSmoke({ registry }: { registry: AtomRegistry.AtomRegistry }) {
  const refs = useRef<Mesh[]>([]);
  const smokeStateRef = useRef<AtomRef.AtomRef<GrinderSmokeState> | null>(null);

  const smokeState = (() => {
    if (smokeStateRef.current !== null) {
      return smokeStateRef.current;
    }

    const initialState: GrinderSmokeState = {
      wasAtBottom: false,
      spawnQueue: [],
    };
    const ref = AtomRef.make(initialState);
    smokeStateRef.current = ref;
    return ref;
  })();

  useFrame(({ clock }, delta) => {
    // Expand + fade all active puffs (same as Rocket)
    for (const smoke of refs.current) {
      if (!smoke.visible) continue;
      const s = smoke.scale.x + delta * 1.5;
      smoke.scale.setScalar(s);
      smoke.position.y += delta * 0.04;
      if (smoke.material instanceof MeshStandardMaterial) {
        smoke.material.opacity = Math.max(0, smoke.material.opacity - delta * 0.6);
        if (smoke.material.opacity <= 0) {
          smoke.visible = false;
        }
      }
    }

    const motion = syncMinerMotion(registry, clock.elapsedTime);
    let nextWasAtBottom = smokeState.value.wasAtBottom;
    let nextSpawnQueue = smokeState.value.spawnQueue;
    let smokeStateChanged = false;

    if (motion.nearBottom && !smokeState.value.wasAtBottom) {
      nextWasAtBottom = true;
      nextSpawnQueue = Array.from({ length: SMOKE_COUNT }, (_, i): GrinderSmokeSpawn => ({
        time: motion.elapsedTime + i * 0.06,
        idx: i,
        angle: Math.random() * Math.PI * 2,
        radius: 0.07 + Math.random() * 0.06,
        scale: 0.05 + Math.random() * 0.05,
      }));
      smokeStateChanged = true;
    } else if (!motion.nearBottom && smokeState.value.wasAtBottom) {
      nextWasAtBottom = false;
      smokeStateChanged = true;
    }

    if (nextSpawnQueue.length > 0) {
      const pendingQueue: Array<GrinderSmokeSpawn> = [];

      for (const entry of nextSpawnQueue) {
        if (motion.elapsedTime >= entry.time) {
          const smoke = refs.current[entry.idx];
          if (smoke) {
            smoke.visible = true;
            smoke.scale.setScalar(entry.scale);
            smoke.position.set(
              Math.cos(entry.angle) * entry.radius,
              0,
              Math.sin(entry.angle) * entry.radius,
            );
            if (smoke.material instanceof MeshStandardMaterial) {
              smoke.material.opacity = 0.5;
            }
          }
        } else {
          pendingQueue.push(entry);
        }
      }

      if (pendingQueue.length !== nextSpawnQueue.length) {
        nextSpawnQueue = pendingQueue;
        smokeStateChanged = true;
      }
    }

    if (smokeStateChanged) {
      smokeState.set({
        wasAtBottom: nextWasAtBottom,
        spawnQueue: nextSpawnQueue,
      });
    }
  });

  return (
    <group position={[0, -0.42, 0]}>
      {Array.from({ length: SMOKE_COUNT }, (_, i) => (
        <mesh
          key={`sm-${i}`}
          ref={(el) => {
            if (el) refs.current[i] = el;
          }}
          visible={false}
        >
          <sphereGeometry args={[0.3, 8, 6]} />
          <meshStandardMaterial
            color="#c0b8a8"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export function MinerFoundation({
  registry,
  groundDistance,
}: {
  registry: AtomRegistry.AtomRegistry;
  groundDistance?: number;
}) {
  return (
    <group>
      {/* ── Upper hull ─────────────────────────────── */}

      {/* Main upper octagonal body — tapered, structural */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.175, 0.19, 0.08, 8]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} />
      </mesh>

      {/* Top mounting plate — beveled rim where cabin will sit */}
      <mesh position={[0, 0.085, 0]}>
        <cylinderGeometry args={[0.195, 0.185, 0.02, 8]} />
        <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
      </mesh>

      {/* Recessed inner ring on top face */}
      <mesh position={[0, 0.098, 0]}>
        <cylinderGeometry args={[0.155, 0.16, 0.012, 8]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
      </mesh>

      {/* 4× Recessed panels on cardinal faces */}
      {Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2;
        const r = 0.175;
        return (
          <group
            key={`up-${i}`}
            position={[Math.sin(a) * r, 0.04, Math.cos(a) * r]}
            rotation={[0, -a, 0]}
          >
            {/* Dark inset panel */}
            <mesh>
              <boxGeometry args={[0.09, 0.055, 0.018]} />
              <meshStandardMaterial
                color={HULL_DARK}
                {...MAT}
                roughness={0.65}
              />
            </mesh>
            {/* Frame — top edge */}
            <mesh position={[0, 0.03, 0.002]}>
              <boxGeometry args={[0.1, 0.006, 0.016]} />
              <meshStandardMaterial
                color={HULL_LIGHT}
                {...MAT}
                roughness={0.5}
              />
            </mesh>
            {/* Frame — bottom edge */}
            <mesh position={[0, -0.03, 0.002]}>
              <boxGeometry args={[0.1, 0.006, 0.016]} />
              <meshStandardMaterial
                color={HULL_LIGHT}
                {...MAT}
                roughness={0.5}
              />
            </mesh>
          </group>
        );
      })}

      {/* 4× Small accent brackets between upper panels */}
      {Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh
            key={`ua-${i}`}
            position={[Math.sin(a) * 0.18, 0.055, Math.cos(a) * 0.18]}
            rotation={[0, -a, 0]}
          >
            <boxGeometry args={[0.025, 0.018, 0.022]} />
            <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
          </mesh>
        );
      })}

      {/* ── Center transition band ─────────────────── */}

      <mesh>
        <cylinderGeometry args={[0.195, 0.2, 0.022, 8]} />
        <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
      </mesh>

      {/* ── Lower hull (orange utility section) ────── */}

      {/* Main lower octagonal body — flared base */}
      <mesh position={[0, -0.04, 0]}>
        <cylinderGeometry args={[0.2, 0.225, 0.08, 8]} />
        <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
      </mesh>

      {/* Bottom plate — darker orange rim */}
      <mesh position={[0, -0.085, 0]}>
        <cylinderGeometry args={[0.225, 0.22, 0.02, 8]} />
        <meshStandardMaterial color={ACCENT_DARK} {...MAT} roughness={0.6} />
      </mesh>

      {/* 4× Lower dark inset panels */}
      {Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh
            key={`lp-${i}`}
            position={[Math.sin(a) * 0.205, -0.04, Math.cos(a) * 0.205]}
            rotation={[0, -a, 0]}
          >
            <boxGeometry args={[0.07, 0.045, 0.018]} />
            <meshStandardMaterial
              color={HULL_DARK}
              {...MAT}
              roughness={0.65}
            />
          </mesh>
        );
      })}

      {/* ── Mechanical details ─────────────────────── */}

      {/* 4× Vertical pipe runs along octagon edges */}
      {Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
        return (
          <mesh
            key={`pp-${i}`}
            position={[Math.sin(a) * 0.19, 0, Math.cos(a) * 0.19]}
          >
            <cylinderGeometry args={[0.007, 0.007, 0.14, 6]} />
            <meshStandardMaterial
              color={HULL_LIGHT}
              {...MAT}
              roughness={0.45}
            />
          </mesh>
        );
      })}

      {/* 8× Bottom rim bolts */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh
            key={`bt-${i}`}
            position={[Math.sin(a) * 0.21, -0.098, Math.cos(a) * 0.21]}
          >
            <cylinderGeometry args={[0.01, 0.01, 0.012, 6]} />
            <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
          </mesh>
        );
      })}

      {/* ── Leg mount brackets + legs ──────────────── */}

      {Array.from({ length: LEG_COUNT }, (_, i) => {
        const a = (i / LEG_COUNT) * Math.PI * 2 + Math.PI / 4;
        return (
          <group
            key={`la-${i}`}
            position={[
              Math.sin(a) * LEG_RADIUS,
              0,
              Math.cos(a) * LEG_RADIUS,
            ]}
          >
            {/* Chunky mount bracket — rotated to face outward */}
            <group rotation={[0, -a, 0]}>
              <mesh>
                <boxGeometry args={[0.065, 0.07, 0.09]} />
                <meshStandardMaterial
                  color={HULL_DARK}
                  {...MAT}
                  roughness={0.65}
                />
              </mesh>
              {/* Bracket accent stripe */}
              <mesh position={[0, -0.02, 0.04]}>
                <boxGeometry args={[0.025, 0.028, 0.018]} />
                <meshStandardMaterial
                  color={ACCENT}
                  {...MAT}
                  roughness={0.5}
                />
              </mesh>
              {/* Bracket top lip */}
              <mesh position={[0, 0.038, 0]}>
                <boxGeometry args={[0.07, 0.008, 0.095]} />
                <meshStandardMaterial
                  color={HULL_MID}
                  {...MAT}
                  roughness={0.55}
                />
              </mesh>
            </group>

            <MinerLeg direction={a} registry={registry} groundDistance={groundDistance} />
          </group>
        );
      })}

      {/* ── Rotor assembly (grinder) ───────────────── */}

      {/* Upper housing collar */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.14, 0.12, 0.05, 8]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
      </mesh>

      {/* Housing rim */}
      <mesh position={[0, -0.078, 0]}>
        <cylinderGeometry args={[0.147, 0.14, 0.015, 8]} />
        <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.55} />
      </mesh>

      {/* Main shaft — chunky column to grinder head */}
      <mesh position={[0, -0.24, 0]}>
        <cylinderGeometry args={[0.09, 0.077, 0.26, 8]} />
        <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.55} />
      </mesh>

      {/* Shaft ring — upper */}
      <mesh position={[0, -0.14, 0]}>
        <cylinderGeometry args={[0.105, 0.1, 0.022, 8]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
      </mesh>

      {/* Shaft ring — middle */}
      <mesh position={[0, -0.22, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 8]} />
        <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.45} />
      </mesh>

      {/* Shaft ring — lower */}
      <mesh position={[0, -0.30, 0]}>
        <cylinderGeometry args={[0.095, 0.095, 0.02, 8]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
      </mesh>

      {/* 3× Support struts */}
      {Array.from({ length: 3 }, (_, i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh
            key={`st-${i}`}
            position={[Math.sin(a) * 0.075, -0.12, Math.cos(a) * 0.075]}
            rotation={[0, a, 0]}
          >
            <boxGeometry args={[0.025, 0.06, 0.025]} />
            <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
          </mesh>
        );
      })}

      {/* Lower shaft housing */}
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.112, 0.105, 0.035, 8]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
      </mesh>

      {/* Lower housing rim */}
      <mesh position={[0, -0.335, 0]}>
        <cylinderGeometry args={[0.119, 0.116, 0.012, 8]} />
        <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.55} />
      </mesh>

      {/* Grinder base plate */}
      <mesh position={[0, -0.37, 0]}>
        <cylinderGeometry args={[0.125, 0.125, 0.025, 8]} />
        <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
      </mesh>

      {/* Grinding balls — semicircle dome arrangement */}
      {[
        // Outer ring — 8 balls, tightly packed
        ...Array.from({ length: 8 }, (_, i) => ({
          a: (i / 8) * Math.PI * 2,
          r: 0.1,
          y: -0.405,
        })),
        // Inner ring — 4 balls, offset 45°
        ...Array.from({ length: 4 }, (_, i) => ({
          a: (i / 4) * Math.PI * 2 + Math.PI / 4,
          r: 0.045,
          y: -0.42,
        })),
        // Center ball
        { a: 0, r: 0, y: -0.43 },
      ].map((b, i) => (
        <GrindingBall
          key={`gb-${i}`}
          position={[Math.sin(b.a) * b.r, b.y, Math.cos(b.a) * b.r]}
          registry={registry}
          spinOffset={i * 0.5}
        />
      ))}

      {/* Ground dust from grinder */}
      <GrinderSmoke registry={registry} />
    </group>
  );
}
