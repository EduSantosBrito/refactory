import { useFrame } from "@react-three/fiber";
import { Duration, Effect, Fiber } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { useCallback, useEffect, useRef } from "react";
import type { Group, Mesh } from "three";
import { MathUtils, MeshStandardMaterial } from "three";
import { runFork } from "../effectRuntime";
import { Antenna } from "./Antenna";
import { MAT, type ModelProps } from "./colors";

// ── Dark industrial palette ─────────────────────────────────
const HULL_DARK = "#2d3550";
const HULL_MID = "#4a4f5a";
const HULL_LIGHT = "#8a8e95";
const HULL_BRIGHT = "#b0b4ba";
const BODY_SHELL = "#d8dce2"; // lighter capsule shell
const ACCENT = "#e8945a";
const TANK_RED = "#c94040";
const TANK_DARK = "#a03030";
const WIN_DARK = "#1a1e2a";
const WIN_GLOW = "#d49040";
const DOOR_PANEL = "#c8ccd2";

// ── Phase & timing ──────────────────────────────────────────
type RocketPhase = "idle" | "launching" | "away" | "landing";

interface RocketMotionState {
  readonly phase: RocketPhase;
  readonly timer: number;
  readonly drop: number;
  readonly deploy: number;
  readonly bounce: number;
}

const rocketMotionAtom = Atom.make<RocketMotionState>({
  phase: "idle",
  timer: 0,
  drop: 0,
  deploy: 1,
  bounce: 2,
}).pipe(Atom.keepAlive, Atom.withLabel("rocket.motion"));

const getBounceDrop = (bounce: number) =>
  bounce < 1.5
    ? BOUNCE_AMP *
      Math.exp(-BOUNCE_DECAY * bounce) *
      Math.sin(BOUNCE_FREQ * bounce)
    : 0;

const getDeployTarget = (phase: RocketPhase, timer: number) => {
  if (phase === "idle") {
    return 1;
  }
  if (phase === "landing") {
    const progress = Math.min(timer / LANDING_DURATION, 1);
    return progress > 0.3 ? Math.min((progress - 0.3) / 0.5, 1) : 0;
  }
  return 0;
};

const LAUNCH_HEIGHT = 30;
const LAUNCH_DURATION = 2.5;
const LANDING_DURATION = 3.0;
const AWAY_DURATION = 5.0;
const SMOKE_COUNT = 6;
const INITIAL_AUTO_LAUNCH_DELAY = Duration.seconds(2);
const RELAUNCH_DELAY = Duration.seconds(3);

// ── Body dimensions (octagonal capsule) ─────────────────────
const BODY_RB = 0.7; // bottom radius
const BODY_RT = 0.66; // top radius
const BODY_H = 0.63; // main cylinder height
const BODY_N = 8; // segments (octagon)
// Rotate octagon so flat faces align with cardinal & diagonal axes
const BODY_ROT: [number, number, number] = [0, -Math.PI / BODY_N, 0];
// ── Skirt stacking (gap-free bottom → top) ──────────────────
const SKIRT_BEVEL_H = 0.015;
const SKIRT_MAIN_H = 0.04;
const SKIRT_TRANS_H = 0.015;
const SKIRT_R_OUT = BODY_RB + 0.04;
const SKIRT_R_MID = BODY_RB + 0.02;
const SKIRT_Y0 = -0.0125;
const SKIRT_Y1 = SKIRT_Y0 + SKIRT_BEVEL_H;
const SKIRT_Y2 = SKIRT_Y1 + SKIRT_MAIN_H;
const SKIRT_Y3 = SKIRT_Y2 + SKIRT_TRANS_H;

// ── Body taper (linear BODY_RB → BODY_RT) ───────────────────
const BODY_BOT = SKIRT_Y3;
const BODY_TOP = BODY_BOT + BODY_H;
const hullR = (y: number) =>
  BODY_RB +
  (BODY_RT - BODY_RB) * MathUtils.clamp((y - BODY_BOT) / BODY_H, 0, 1);

// Seam at body midpoint
const SEAM_H = 0.02;
const SEAM_INSET = 0.015;
const SEAM_Y = (BODY_BOT + BODY_TOP) / 2;
const SEAM_LO = SEAM_Y - SEAM_H / 2;
const SEAM_HI = SEAM_Y + SEAM_H / 2;
const LOWER_H = SEAM_LO - BODY_BOT;
const LOWER_Y = (BODY_BOT + SEAM_LO) / 2;
const UPPER_H = BODY_TOP - SEAM_HI;
const UPPER_Y = (SEAM_HI + BODY_TOP) / 2;
const BODY_APO = hullR(SEAM_Y) * Math.cos(Math.PI / BODY_N);

// ── Accent bands (tapered to hull profile) ──────────────────
const ACCENT_Y = 0.1;
const ACCENT_H = 0.03;
const ACCENT_R_TOP = hullR(ACCENT_Y + ACCENT_H / 2) + 0.005;
const ACCENT_R_BOT = hullR(ACCENT_Y - ACCENT_H / 2) + 0.005;
const UACCENT_Y = 0.55;
const UACCENT_H = 0.01;
const UACCENT_R_TOP = hullR(UACCENT_Y + UACCENT_H / 2) + 0.004;
const UACCENT_R_BOT = hullR(UACCENT_Y - UACCENT_H / 2) + 0.004;

// ── Top section (contiguous stack above body) ────────────────
const RIM_H = 0.015;
const RIM_R = BODY_RT + 0.04;
const BEVEL_H = 0.012;
const STEP1_H = 0.02;
const STEP1_R = BODY_RT + 0.02;
const STEP2_H = 0.018;
const STEP2_R = BODY_RT - 0.08;
const STEP3_H = 0.015;
const STEP3_R = BODY_RT - 0.16;
const BEVEL_CY = BODY_TOP + BEVEL_H / 2;
const STEP1_CY = BODY_TOP + BEVEL_H + STEP1_H / 2;
const STEP2_CY = BODY_TOP + BEVEL_H + STEP1_H + STEP2_H / 2;
const STEP3_CY = BODY_TOP + BEVEL_H + STEP1_H + STEP2_H + STEP3_H / 2;
const ANTENNA_CY = BODY_TOP + BEVEL_H + STEP1_H + STEP2_H + STEP3_H + 0.02;

// ── Landing base ────────────────────────────────────────────
const BASE_R = 1.05;

// ── Leg geometry (MechLeg md fork) ──────────────────────────
const LEG_EX = 0.1;
const LEG_EY = -0.06;
const LEG_FX = 0.15;
const LEG_FY = -0.18;
const LEG_GAP = 0.03;

const LEG_UL = Math.sqrt(LEG_EX ** 2 + LEG_EY ** 2);
const LEG_UA = Math.atan2(LEG_EY, LEG_EX);
const LEG_LDX = LEG_FX - LEG_EX;
const LEG_LDY = LEG_FY - LEG_EY;
const LEG_LL = Math.sqrt(LEG_LDX ** 2 + LEG_LDY ** 2);
const LEG_LA = Math.atan2(LEG_LDY, LEG_LDX);

// ── Landing bounce (one-shot suspension) ────────────────────
const BOUNCE_AMP = 0.06;
const BOUNCE_DECAY = 4;
const BOUNCE_FREQ = 15;
const LANDING_Y = Math.abs(LEG_FY);
const EFFECT_Y = 0.05;

// ── Detail placement angles (octagon faces after -π/8 rotation) ─
// Face normals: 0, π/4, π/2, 3π/4, π, 5π/4, 3π/2, 7π/4
const WIN_ANGLES = [
  Math.PI / 4,
  (3 * Math.PI) / 4,
  (5 * Math.PI) / 4,
  (7 * Math.PI) / 4,
];
const LEG_ANGLES = [
  Math.PI / 4,
  (3 * Math.PI) / 4,
  (5 * Math.PI) / 4,
  (7 * Math.PI) / 4,
];
const DOOR_ANGLE = Math.PI;
const TANK_ANGLES = [0, Math.PI / 2, (3 * Math.PI) / 2];

// ═════════════════════════════════════════════════════════════
// RocketLeg — MechLeg md fork with IK squat
// ═════════════════════════════════════════════════════════════

function RocketLeg({
  direction,
  registry,
}: {
  direction: number;
  registry: AtomRegistry.AtomRegistry;
}) {
  const upperRef = useRef<Group>(null);
  const elbowRef = useRef<Group>(null);
  const lowerRef = useRef<Group>(null);
  const footRef = useRef<Group>(null);

  useFrame(() => {
    const state = registry.get(rocketMotionAtom);
    const deploy = state.deploy;
    const drop = state.drop;

    // IK target — lerp between retracted and deployed, add squat offset
    const fx = MathUtils.lerp(0.04, LEG_FX, deploy);
    const fy = MathUtils.lerp(-0.04, LEG_FY, deploy) + drop;
    const d = Math.sqrt(fx * fx + fy * fy);

    const baseAngle = Math.atan2(fy, fx);
    const cosA = MathUtils.clamp(
      (LEG_UL * LEG_UL + d * d - LEG_LL * LEG_LL) / (2 * LEG_UL * d),
      -1,
      1,
    );
    const upperAngle = baseAngle + Math.acos(cosA);
    const ex = LEG_UL * Math.cos(upperAngle);
    const ey = LEG_UL * Math.sin(upperAngle);
    const lowerAngle = Math.atan2(fy - ey, fx - ex);

    if (upperRef.current) upperRef.current.rotation.z = upperAngle;
    if (elbowRef.current) elbowRef.current.position.set(ex, ey, 0);
    if (lowerRef.current) {
      lowerRef.current.position.set(ex, ey, 0);
      lowerRef.current.rotation.z = lowerAngle;
    }
    if (footRef.current) footRef.current.position.set(fx, fy, 0);
  });

  return (
    <group rotation={[0, direction - Math.PI / 2, 0]}>
      {/* ── Shoulder mount ── */}
      <mesh>
        <boxGeometry args={[0.06, 0.065, 0.08]} />
        <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.65} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.1, 8]} />
        <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.053]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.027, 0.012, 8]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0, -0.053]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.027, 0.012, 8]} />
        <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
      </mesh>
      <mesh position={[0.025, -0.015, 0.038]}>
        <boxGeometry args={[0.015, 0.03, 0.015]} />
        <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
      </mesh>
      <mesh position={[0.025, -0.015, -0.038]}>
        <boxGeometry args={[0.015, 0.03, 0.015]} />
        <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
      </mesh>

      {/* ── Upper arm (yoke) ── */}
      <group ref={upperRef} rotation={[0, 0, LEG_UA]}>
        <mesh position={[LEG_UL / 2, 0, LEG_GAP]}>
          <boxGeometry args={[LEG_UL, 0.04, 0.025]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
        <mesh position={[LEG_UL / 2, 0, -LEG_GAP]}>
          <boxGeometry args={[LEG_UL, 0.04, 0.025]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
        <mesh position={[LEG_UL * 0.5, 0, 0]}>
          <boxGeometry args={[0.025, 0.028, LEG_GAP * 2 - 0.002]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
        </mesh>
        <mesh position={[LEG_UL * 0.5, -0.026, 0]}>
          <boxGeometry args={[0.02, 0.01, LEG_GAP * 2 + 0.025]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
      </group>

      {/* ── Elbow joint ── */}
      <group ref={elbowRef} position={[LEG_EX, LEG_EY, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.07, 8]} />
          <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.033, 0.012, 8]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.033, 0.012, 8]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
        </mesh>
      </group>

      {/* ── Lower arm (yoke) ── */}
      <group
        ref={lowerRef}
        position={[LEG_EX, LEG_EY, 0]}
        rotation={[0, 0, LEG_LA]}
      >
        <mesh position={[LEG_LL / 2, 0, LEG_GAP]}>
          <boxGeometry args={[LEG_LL, 0.035, 0.022]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
        <mesh position={[LEG_LL / 2, 0, -LEG_GAP]}>
          <boxGeometry args={[LEG_LL, 0.035, 0.022]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
      </group>

      {/* ── Foot ── */}
      <group ref={footRef} position={[LEG_FX, LEG_FY, 0]}>
        <mesh position={[0.008, 0, 0]}>
          <boxGeometry args={[0.09, 0.04, 0.08]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.65} />
        </mesh>
        <mesh position={[0.008, -0.025, 0]}>
          <boxGeometry args={[0.095, 0.012, 0.085]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.6} />
        </mesh>
        <mesh position={[0.04, 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.07, 8]} />
          <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.35} />
        </mesh>
        <mesh position={[0.04, 0.005, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.037, 0.034, 0.012, 8]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.55} />
        </mesh>
        <mesh position={[0.04, 0.005, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.037, 0.034, 0.012, 8]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.55} />
        </mesh>
        <mesh position={[-0.02, 0.005, 0.045]}>
          <boxGeometry args={[0.025, 0.025, 0.012]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
        <mesh position={[-0.02, 0.005, -0.045]}>
          <boxGeometry args={[0.025, 0.025, 0.012]} />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

// ═════════════════════════════════════════════════════════════
// Rocket — lander with landing base, body, legs, flame
// ═════════════════════════════════════════════════════════════

export interface RocketApi {
  launch: () => void;
  phase: RocketPhase;
}

interface RocketProps extends ModelProps {
  onPhaseChange?: (phase: RocketPhase) => void;
  apiRef?: React.MutableRefObject<RocketApi | null>;
}

export function Rocket({ onPhaseChange, apiRef, ...props }: RocketProps) {
  const rocketRef = useRef<Group>(null);
  const flameRef = useRef<Group>(null);
  const smokeRefs = useRef<Mesh[]>([]);
  const registryRef = useRef<AtomRegistry.AtomRegistry | null>(null);
  const autoLaunchFiberRef = useRef<Fiber.Fiber<void, never> | null>(null);
  const launchRef = useRef<() => void>(() => {});

  if (registryRef.current === null) {
    registryRef.current = AtomRegistry.make();
  }

  const registry = registryRef.current;

  const clearAutoLaunch = useCallback(() => {
    const fiber = autoLaunchFiberRef.current;
    if (fiber !== null) {
      autoLaunchFiberRef.current = null;
      runFork(Fiber.interrupt(fiber));
    }
  }, []);

  const setPhase = useCallback(
    (phase: RocketPhase) => {
      registry.update(rocketMotionAtom, (state: RocketMotionState) => ({
        ...state,
        phase,
        timer: 0,
      }));
      onPhaseChange?.(phase);
    },
    [onPhaseChange, registry],
  );

  const launch = useCallback(() => {
    clearAutoLaunch();
    if (registry.get(rocketMotionAtom).phase === "idle") {
      setPhase("launching");
    }
  }, [clearAutoLaunch, registry, setPhase]);

  const scheduleLaunch = useCallback(
    (delay: Duration.Input) => {
      clearAutoLaunch();
      autoLaunchFiberRef.current = runFork(
        Effect.gen(function* () {
          yield* Effect.sleep(delay);
          yield* Effect.sync(() => {
            autoLaunchFiberRef.current = null;
            launchRef.current();
          });
        }),
      );
    },
    [clearAutoLaunch],
  );

  useEffect(() => {
    launchRef.current = launch;
  }, [launch]);

  useEffect(() => {
    if (!apiRef) return;

    const updateApi = (state: RocketMotionState) => {
      apiRef.current = { launch, phase: state.phase };
    };

    updateApi(registry.get(rocketMotionAtom));
    const cancel = registry.subscribe(rocketMotionAtom, updateApi);

    return () => {
      cancel();
      if (apiRef.current?.launch === launch) {
        apiRef.current = null;
      }
    };
  }, [apiRef, launch, registry]);

  // Auto-launch after 2s, then re-launch each landing
  useEffect(() => {
    scheduleLaunch(INITIAL_AUTO_LAUNCH_DELAY);
    return () => {
      clearAutoLaunch();
    };
  }, [clearAutoLaunch, scheduleLaunch]);

  useEffect(
    () => () => {
      clearAutoLaunch();
    },
    [clearAutoLaunch],
  );

  useFrame((_, delta) => {
    if (!rocketRef.current || !flameRef.current) return;

    const state = registry.get(rocketMotionAtom);
    const phase = state.phase;
    const t = state.timer + delta;
    let nextPhase = phase;
    let nextTimer = t;
    let nextDrop = state.drop;
    let nextDeploy = state.deploy;
    let nextBounce = state.bounce;
    let relaunchDelay: Duration.Input | null = null;

    // ── Smoke fade ──
    for (const smoke of smokeRefs.current) {
      if (!smoke.visible) continue;
      const s = smoke.scale.x + delta * 2;
      smoke.scale.setScalar(s);
      if (smoke.material instanceof MeshStandardMaterial) {
        smoke.material.opacity = Math.max(
          0,
          smoke.material.opacity - delta * 0.8,
        );
        if (smoke.material.opacity <= 0) {
          smoke.visible = false;
        }
      }
    }

    // ── Phase animation ──
    switch (phase) {
      case "idle": {
        nextBounce = state.bounce + delta;
        nextDrop = getBounceDrop(nextBounce);
        rocketRef.current.position.y = LANDING_Y - nextDrop;
        flameRef.current.visible = false;
        break;
      }

      case "launching": {
        const progress = Math.min(t / LAUNCH_DURATION, 1);
        const eased = progress * progress * progress;
        rocketRef.current.position.y = LANDING_Y + eased * LAUNCH_HEIGHT;
        nextDrop = 0;

        flameRef.current.visible = true;
        const fs = 0.5 + progress * 2;
        const flicker = 0.85 + Math.random() * 0.3;
        flameRef.current.scale.set(
          fs * flicker,
          fs * (1 + progress * 1.5),
          fs * flicker,
        );

        if (progress < 0.4 && Math.random() < 0.3) {
          for (const smoke of smokeRefs.current) {
            if (!smoke.visible) {
              smoke.visible = true;
              smoke.scale.setScalar(0.1 + Math.random() * 0.2);
              smoke.position.set(
                (Math.random() - 0.5) * 0.4,
                EFFECT_Y,
                (Math.random() - 0.5) * 0.4,
              );
              if (smoke.material instanceof MeshStandardMaterial)
                smoke.material.opacity = 0.6;
              break;
            }
          }
        }

        rocketRef.current.rotation.z = Math.sin(t * 12) * 0.01 * (1 - progress);

        if (progress >= 1) {
          rocketRef.current.visible = false;
          nextPhase = "away";
          nextTimer = 0;
        }
        break;
      }

      case "away": {
        flameRef.current.visible = false;
        nextDrop = 0;
        if (t >= AWAY_DURATION) {
          rocketRef.current.visible = true;
          rocketRef.current.position.y = LANDING_Y + LAUNCH_HEIGHT;
          nextPhase = "landing";
          nextTimer = 0;
        }
        break;
      }

      case "landing": {
        const progress = Math.min(t / LANDING_DURATION, 1);
        const eased = 1 - (1 - progress) * (1 - progress);
        rocketRef.current.position.y = MathUtils.lerp(
          LANDING_Y + LAUNCH_HEIGHT,
          LANDING_Y,
          eased,
        );
        nextDrop = 0;

        flameRef.current.visible = true;
        const fs = 1.8 * (1 - progress * 0.85);
        const flicker = 0.85 + Math.random() * 0.3;
        flameRef.current.scale.set(fs * flicker, fs, fs * flicker);

        if (progress > 0.7 && Math.random() < 0.4) {
          for (const smoke of smokeRefs.current) {
            if (!smoke.visible) {
              smoke.visible = true;
              smoke.scale.setScalar(0.15);
              const a = Math.random() * Math.PI * 2;
              smoke.position.set(
                Math.cos(a) * 0.3,
                EFFECT_Y,
                Math.sin(a) * 0.3,
              );
              if (smoke.material instanceof MeshStandardMaterial)
                smoke.material.opacity = 0.5;
              break;
            }
          }
        }

        rocketRef.current.rotation.z = Math.sin(t * 8) * 0.015 * (1 - progress);

        if (progress >= 1) {
          rocketRef.current.position.y = LANDING_Y;
          rocketRef.current.rotation.z = 0;
          nextBounce = 0; // trigger suspension bounce
          nextPhase = "idle";
          nextTimer = 0;
          relaunchDelay = RELAUNCH_DELAY;
        }
        break;
      }
    }

    // ── Leg deploy ──
    const deployTarget = getDeployTarget(phase, t);
    nextDeploy += (deployTarget - nextDeploy) * Math.min(1, delta * 5);

    registry.set(rocketMotionAtom, {
      phase: nextPhase,
      timer: nextTimer,
      drop: nextDrop,
      deploy: nextDeploy,
      bounce: nextBounce,
    });

    if (nextPhase !== phase) {
      onPhaseChange?.(nextPhase);
    }

    if (relaunchDelay !== null) {
      scheduleLaunch(relaunchDelay);
    }
  });

  return (
    <group {...props} onClick={launch} rotation={[0, Math.PI, 0]}>
      {/* ═══ Landing Base ════════════════════════════════ */}
      {/* Main pad */}
      <mesh position={[0, 0.006, 0]}>
        <cylinderGeometry args={[BASE_R - 0.05, BASE_R, 0.012, 16]} />
        <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.7} />
      </mesh>
      {/* Orange accent ring — openEnded to avoid cap z-fight */}
      <mesh position={[0, 0.006, 0]}>
        <cylinderGeometry
          args={[BASE_R + 0.01, BASE_R + 0.05, 0.012, 16, 1, true]}
        />
        <meshStandardMaterial
          color={ACCENT}
          {...MAT}
          roughness={0.5}
          side={2}
        />
      </mesh>
      {/* Landing cross markers — clearly above pad surface */}
      <mesh position={[0, 0.016, 0]}>
        <boxGeometry args={[0.8, 0.008, 0.04]} />
        <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.016, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.8, 0.008, 0.04]} />
        <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.6} />
      </mesh>

      {/* ═══ Lander ══════════════════════════════════════ */}
      <group ref={rocketRef}>
        {/* ── 4 × RocketLeg (at diagonal faces) ── */}
        {LEG_ANGLES.map((angle) => (
          <group
            key={`leg-${angle.toFixed(3)}`}
            position={[Math.sin(angle) * BODY_RB, 0, Math.cos(angle) * BODY_RB]}
          >
            <RocketLeg direction={angle} registry={registry} />
          </group>
        ))}

        {/* ── Bottom skirt ── */}
        <mesh position={[0, (SKIRT_Y1 + SKIRT_Y2) / 2, 0]} rotation={BODY_ROT}>
          <cylinderGeometry
            args={[SKIRT_R_MID, SKIRT_R_OUT, SKIRT_MAIN_H, BODY_N]}
          />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.65} />
        </mesh>
        {/* Skirt bottom bevel */}
        <mesh position={[0, (SKIRT_Y0 + SKIRT_Y1) / 2, 0]} rotation={BODY_ROT}>
          <cylinderGeometry
            args={[SKIRT_R_OUT, SKIRT_R_MID, SKIRT_BEVEL_H, BODY_N]}
          />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>
        {/* Skirt-to-body bevel */}
        <mesh position={[0, (SKIRT_Y2 + SKIRT_Y3) / 2, 0]} rotation={BODY_ROT}>
          <cylinderGeometry
            args={[BODY_RB, SKIRT_R_MID, SKIRT_TRANS_H, BODY_N]}
          />
          <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.45} />
        </mesh>

        {/* ── Lower body half ── */}
        <mesh position={[0, LOWER_Y, 0]} rotation={BODY_ROT}>
          <cylinderGeometry args={[hullR(SEAM_LO), BODY_RB, LOWER_H, BODY_N]} />
          <meshStandardMaterial color={BODY_SHELL} {...MAT} roughness={0.5} />
        </mesh>

        {/* ── Horizontal seam groove ── */}
        <mesh position={[0, SEAM_Y, 0]} rotation={BODY_ROT}>
          <cylinderGeometry
            args={[
              hullR(SEAM_HI) - SEAM_INSET,
              hullR(SEAM_LO) - SEAM_INSET,
              SEAM_H,
              BODY_N,
            ]}
          />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
        </mesh>

        {/* ── Upper body half ── */}
        <mesh position={[0, UPPER_Y, 0]} rotation={BODY_ROT}>
          <cylinderGeometry args={[BODY_RT, hullR(SEAM_HI), UPPER_H, BODY_N]} />
          <meshStandardMaterial color={BODY_SHELL} {...MAT} roughness={0.5} />
        </mesh>

        {/* ── Bottom accent band ── */}
        <mesh position={[0, ACCENT_Y, 0]} rotation={BODY_ROT}>
          <cylinderGeometry
            args={[ACCENT_R_TOP, ACCENT_R_BOT, ACCENT_H, BODY_N]}
          />
          <meshStandardMaterial color={ACCENT} {...MAT} roughness={0.5} />
        </mesh>

        {/* ── Upper accent line ── */}
        <mesh position={[0, UACCENT_Y, 0]} rotation={BODY_ROT}>
          <cylinderGeometry
            args={[UACCENT_R_TOP, UACCENT_R_BOT, UACCENT_H, BODY_N]}
          />
          <meshStandardMaterial color={HULL_LIGHT} {...MAT} roughness={0.5} />
        </mesh>

        {/* ── Top outer rim lip ── */}
        <mesh position={[0, BODY_TOP, 0]} rotation={BODY_ROT}>
          <cylinderGeometry args={[RIM_R, RIM_R, RIM_H, BODY_N]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>

        {/* ── Body-to-top bevel ── */}
        <mesh position={[0, BEVEL_CY, 0]} rotation={BODY_ROT}>
          <cylinderGeometry args={[STEP1_R, BODY_RT, BEVEL_H, BODY_N]} />
          <meshStandardMaterial color={HULL_BRIGHT} {...MAT} roughness={0.45} />
        </mesh>

        {/* ── Flat stepped top ── */}
        {/* Step 1: wide tier */}
        <mesh position={[0, STEP1_CY, 0]} rotation={BODY_ROT}>
          <cylinderGeometry args={[BODY_RT, STEP1_R, STEP1_H, BODY_N]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.6} />
        </mesh>
        {/* Step 2: inset tier */}
        <mesh position={[0, STEP2_CY, 0]} rotation={BODY_ROT}>
          <cylinderGeometry args={[STEP2_R, STEP2_R, STEP2_H, BODY_N]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.65} />
        </mesh>
        {/* Step 3: inner platform */}
        <mesh position={[0, STEP3_CY, 0]} rotation={BODY_ROT}>
          <cylinderGeometry args={[STEP3_R, STEP3_R, STEP3_H, BODY_N]} />
          <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.55} />
        </mesh>

        {/* ── Windows (thin, deeply recessed, subtle frame, glowing glass) ── */}
        {WIN_ANGLES.map((a, i) => {
          const apo = BODY_APO + 0.005;
          return (
            <group
              key={`win-${a.toFixed(3)}`}
              position={[Math.sin(a) * apo, 0.36, Math.cos(a) * apo]}
              rotation={[0, a, 0]}
            >
              {/* Subtle outer frame — thin border flush with hull */}
              <mesh position={[0, 0, 0.001]}>
                <boxGeometry args={[0.14, 0.14, 0.006]} />
                <meshStandardMaterial
                  color={HULL_MID}
                  {...MAT}
                  roughness={0.55}
                />
              </mesh>
              {/* Deep recess cavity */}
              <mesh position={[0, 0, -0.004]}>
                <boxGeometry args={[0.11, 0.11, 0.012]} />
                <meshStandardMaterial
                  color={HULL_DARK}
                  {...MAT}
                  roughness={0.75}
                />
              </mesh>
              {/* Glass — thin, recessed inside cavity */}
              <mesh position={[0, 0, -0.002]}>
                <boxGeometry args={[0.085, 0.085, 0.004]} />
                <meshStandardMaterial
                  color={WIN_DARK}
                  emissive={WIN_GLOW}
                  emissiveIntensity={0.15}
                  {...MAT}
                  roughness={0.9}
                />
              </mesh>
              {/* Inner glow accent — warm light visible through glass */}
              <mesh position={[0, -0.006, 0.0]}>
                <boxGeometry args={[0.055, 0.03, 0.002]} />
                <meshStandardMaterial
                  color={WIN_GLOW}
                  emissive={WIN_GLOW}
                  emissiveIntensity={0.6}
                  {...MAT}
                  roughness={0.4}
                />
              </mesh>
              {/* Vent grille below window (on 2 faces) */}
              {i < 2 && (
                <group position={[0, -0.11, 0.002]}>
                  <mesh>
                    <boxGeometry args={[0.08, 0.03, 0.008]} />
                    <meshStandardMaterial
                      color={HULL_DARK}
                      {...MAT}
                      roughness={0.7}
                    />
                  </mesh>
                  {[-0.007, 0, 0.007].map((y) => (
                    <mesh key={`vent-${y.toFixed(3)}`} position={[0, y, 0.005]}>
                      <boxGeometry args={[0.06, 0.003, 0.004]} />
                      <meshStandardMaterial
                        color={HULL_MID}
                        {...MAT}
                        roughness={0.5}
                      />
                    </mesh>
                  ))}
                </group>
              )}
            </group>
          );
        })}

        {/* ── Door (layered depth: raised frame → recessed panel → inset detail) ── */}
        {(() => {
          const apo = BODY_APO + 0.005;
          return (
            <group
              position={[
                Math.sin(DOOR_ANGLE) * apo,
                0.3,
                Math.cos(DOOR_ANGLE) * apo,
              ]}
              rotation={[0, DOOR_ANGLE, 0]}
            >
              {/* L1: Outer frame — slightly raised from hull */}
              <mesh position={[0, 0, 0.008]}>
                <boxGeometry args={[0.34, 0.44, 0.026]} />
                <meshStandardMaterial
                  color={HULL_MID}
                  {...MAT}
                  roughness={0.6}
                />
              </mesh>
              {/* L2: Deep recess — dark gap behind panel */}
              <mesh position={[0, 0, 0.001]}>
                <boxGeometry args={[0.29, 0.39, 0.012]} />
                <meshStandardMaterial
                  color={HULL_DARK}
                  {...MAT}
                  roughness={0.7}
                />
              </mesh>
              {/* L3: Inner panel — recessed door surface */}
              <mesh position={[0, 0, 0.01]}>
                <boxGeometry args={[0.24, 0.33, 0.012]} />
                <meshStandardMaterial
                  color={DOOR_PANEL}
                  {...MAT}
                  roughness={0.45}
                />
              </mesh>
              {/* L4: Inset border — raised frame within panel */}
              <mesh position={[0, -0.04, 0.017]}>
                <boxGeometry args={[0.17, 0.16, 0.006]} />
                <meshStandardMaterial
                  color={HULL_LIGHT}
                  {...MAT}
                  roughness={0.5}
                />
              </mesh>
              {/* L5: Inset recess — dark detail inside border */}
              <mesh position={[0, -0.04, 0.018]}>
                <boxGeometry args={[0.13, 0.12, 0.004]} />
                <meshStandardMaterial
                  color={HULL_DARK}
                  {...MAT}
                  roughness={0.65}
                />
              </mesh>
              {/* Window frame (upper portion) */}
              <mesh position={[0, 0.06, 0.017]}>
                <boxGeometry args={[0.14, 0.14, 0.008]} />
                <meshStandardMaterial
                  color={HULL_MID}
                  {...MAT}
                  roughness={0.6}
                />
              </mesh>
              {/* Window glass */}
              <mesh position={[0, 0.06, 0.02]}>
                <boxGeometry args={[0.1, 0.1, 0.006]} />
                <meshStandardMaterial
                  color={WIN_DARK}
                  {...MAT}
                  roughness={0.8}
                />
              </mesh>
              {/* Window glow */}
              <mesh position={[0, 0.055, 0.026]}>
                <boxGeometry args={[0.06, 0.04, 0.004]} />
                <meshStandardMaterial
                  color={WIN_GLOW}
                  emissive={WIN_GLOW}
                  emissiveIntensity={0.4}
                  {...MAT}
                  roughness={0.5}
                />
              </mesh>
              {/* Chevron marks above door */}
              <mesh position={[-0.03, 0.19, 0.012]} rotation={[0, 0, 0.4]}>
                <boxGeometry args={[0.04, 0.008, 0.006]} />
                <meshStandardMaterial
                  color={HULL_LIGHT}
                  {...MAT}
                  roughness={0.55}
                />
              </mesh>
              <mesh position={[0.03, 0.19, 0.012]} rotation={[0, 0, -0.4]}>
                <boxGeometry args={[0.04, 0.008, 0.006]} />
                <meshStandardMaterial
                  color={HULL_LIGHT}
                  {...MAT}
                  roughness={0.55}
                />
              </mesh>
            </group>
          );
        })()}

        {/* ── Fuel tanks ── */}
        {TANK_ANGLES.map((a) => (
          <group
            key={`tank-${a.toFixed(3)}`}
            position={[
              Math.sin(a) * (BODY_APO + 0.06),
              0.36,
              Math.cos(a) * (BODY_APO + 0.06),
            ]}
            rotation={[0, a, 0]}
          >
            {/* Main cylinder */}
            <mesh>
              <cylinderGeometry args={[0.06, 0.06, 0.26, 10]} />
              <meshStandardMaterial
                color={TANK_RED}
                {...MAT}
                roughness={0.45}
              />
            </mesh>
            {/* Top cap */}
            <mesh position={[0, 0.14, 0]}>
              <cylinderGeometry args={[0.025, 0.06, 0.035, 10]} />
              <meshStandardMaterial
                color={TANK_DARK}
                {...MAT}
                roughness={0.5}
              />
            </mesh>
            {/* Bottom cap */}
            <mesh position={[0, -0.14, 0]}>
              <cylinderGeometry args={[0.06, 0.025, 0.035, 10]} />
              <meshStandardMaterial
                color={TANK_DARK}
                {...MAT}
                roughness={0.5}
              />
            </mesh>
            {/* Mounting band */}
            <mesh position={[0, 0.04, 0]}>
              <cylinderGeometry args={[0.065, 0.065, 0.018, 10]} />
              <meshStandardMaterial color={HULL_MID} {...MAT} roughness={0.5} />
            </mesh>
          </group>
        ))}

        {/* ── Antenna mount ── */}
        <mesh position={[0, ANTENNA_CY, 0]}>
          <cylinderGeometry args={[0.1, 0.14, 0.04, 8]} />
          <meshStandardMaterial color={HULL_DARK} {...MAT} roughness={0.6} />
        </mesh>

        {/* ── Rotating antenna ── */}
        <Antenna position={[0, ANTENNA_CY, 0]} />

        {/* ── Thruster flame ── */}
        <group ref={flameRef} position={[0, -0.1, 0]} visible={false}>
          {/* Outer flame */}
          <mesh position={[0, -0.2, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.12, 0.6, 8]} />
            <meshStandardMaterial
              color="#f5a030"
              emissive="#f07830"
              emissiveIntensity={2}
              transparent
              opacity={0.75}
            />
          </mesh>
          {/* Inner hot core */}
          <mesh position={[0, -0.15, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.05, 0.4, 8]} />
            <meshStandardMaterial
              color="#ffe8a0"
              emissive="#ffffff"
              emissiveIntensity={3}
              transparent
              opacity={0.9}
            />
          </mesh>
        </group>
      </group>

      {/* ═══ Smoke puffs ═════════════════════════════════ */}
      {Array.from({ length: SMOKE_COUNT }, (_, i) => (
        <mesh
          key={`smoke-${(i / Math.max(1, SMOKE_COUNT)).toFixed(3)}`}
          ref={(el) => {
            if (el) smokeRefs.current[i] = el;
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
