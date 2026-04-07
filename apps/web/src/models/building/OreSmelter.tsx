import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshStandardMaterial } from "three";
import type { Group, Mesh } from "three";
import { B, M } from "./palette";
import type { ModelProps } from "../colors";
import { COLORS } from "../colors";
import { StatusPole, type StatusPoleStatus } from "../StatusPole";
import { Antenna } from "../Antenna";

/* ── Chimney smoke — wispy rising plume (same as BiomassBurner) ── */
const SMOKE_COUNT = 12;

/** Per-puff random drift stored at spawn time */
type PuffState = { driftX: number; driftZ: number; riseSpeed: number };

function ChimneySmoke() {
  const refs = useRef<Mesh[]>([]);
  const puffs = useRef<Map<number, PuffState>>(new Map());
  const nextSpawn = useRef(0);
  const nextIdx = useRef(0);

  useFrame(({ clock }, delta) => {
    for (let i = 0; i < refs.current.length; i++) {
      const smoke = refs.current[i]!;
      if (!smoke.visible) continue;
      const p = puffs.current.get(i);
      if (!p) continue;

      smoke.scale.setScalar(smoke.scale.x + delta * 0.12);
      smoke.position.y += delta * p.riseSpeed;
      smoke.position.x += delta * p.driftX;
      smoke.position.z += delta * p.driftZ + Math.sin(clock.elapsedTime * 0.6 + i) * delta * 0.003;

      if (smoke.material instanceof MeshStandardMaterial) {
        smoke.material.opacity = Math.max(0, smoke.material.opacity - delta * 0.07);
        if (smoke.material.opacity <= 0) {
          smoke.visible = false;
        }
      }
    }

    if (clock.elapsedTime >= nextSpawn.current) {
      const idx = nextIdx.current % SMOKE_COUNT;
      const smoke = refs.current[idx];
      if (smoke) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.025;
        smoke.visible = true;
        smoke.scale.setScalar(0.8 + Math.random() * 0.6);
        smoke.position.set(
          Math.cos(angle) * r,
          0,
          Math.sin(angle) * r,
        );
        puffs.current.set(idx, {
          driftX: (Math.random() - 0.3) * 0.012,
          driftZ: (Math.random() - 0.5) * 0.008,
          riseSpeed: 0.025 + Math.random() * 0.02,
        });
        if (smoke.material instanceof MeshStandardMaterial) {
          smoke.material.opacity = 0.3 + Math.random() * 0.15;
        }
      }
      nextIdx.current = idx + 1;
      nextSpawn.current = clock.elapsedTime + 0.3 + Math.random() * 0.4;
    }
  });

  return (
    <group>
      {Array.from({ length: SMOKE_COUNT }, (_, i) => (
        <mesh
          key={`sm-${i}`}
          ref={(el) => {
            if (el) refs.current[i] = el;
          }}
          visible={false}
        >
          <sphereGeometry args={[0.03, 10, 8]} />
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

/**
 * Ore Smelter — "The Cauldron"
 *
 * COMPLETE REDESIGN: Spherical cauldron belly (not a cylinder!)
 * with neck constriction and flared mouth. Drenched in warm colors.
 * Oversized bellows on left, dramatic front furnace door,
 * prominent pour spout with molten stream.
 *
 * FORM: squat sphere belly + narrow neck + flared mouth = cauldron
 * FLOW: ore hopper (+X) → cauldron belly → pour spout (front)
 *       air → bellows (-X) | exhaust → chimney (back-right)
 */

/* ── Warm palette — uses established smelter + structural colors ── */
const WARM_FRAME = COLORS.smelterDark; // #c4633a — recessed panels, frames
const WARM_COLLAR = B.mid;             // #4a4f5a — structural collars, brackets

/* ── Dimensions ── */
const SIDES = 8;

const FOUND_H = 0.05;
const FOUND_Y = FOUND_H / 2;

const COLLAR_H = 0.04;
const COLLAR_TOP = FOUND_H + COLLAR_H;

/* Belly — squat wide sphere, cauldron shape */
const BELLY_R = 0.15;
const BELLY_SX = 1.35;
const BELLY_SY = 0.80;
const BELLY_EFF_R = BELLY_R * BELLY_SX; // ~0.20
const BELLY_HH = BELLY_R * BELLY_SY; // ~0.105
const BELLY_Y = COLLAR_TOP + BELLY_HH; // ~0.325
const BELLY_TOP = BELLY_Y + BELLY_HH; // ~0.43

/* Neck — constriction above belly */
const NECK_H = 0.055;
const NECK_BOT_R = 0.16;
const NECK_TOP_R = 0.12;
const NECK_Y = BELLY_TOP + NECK_H / 2;

/* Mouth — flares outward, open top with molten pool */
const MOUTH_H = 0.03;
const MOUTH_TOP_R = 0.19;
const MOUTH_Y = BELLY_TOP + NECK_H + MOUTH_H / 2;
const BODY_TOP = BELLY_TOP + NECK_H + MOUTH_H;

const CHIMNEY_R = 0.04;
const CHIMNEY_H = 0.34;

type OreSmelterProps = ModelProps & {
  status?: StatusPoleStatus;
};

export function OreSmelter({ status = "green", ...props }: OreSmelterProps) {
  const glowActive = status === "green" || status === "yellow";
  const smokeActive = status === "green";

  const glowRef1 = useRef<Mesh>(null);
  const glowRef2 = useRef<Mesh>(null);
  const glowRef3 = useRef<Mesh>(null);
  const seamRefs = useRef<Mesh[]>([]);
  const bellowsRef = useRef<Group>(null);
  const poolRef = useRef<Mesh>(null);

  useFrame(() => {
    if (!glowActive) {
      for (const ref of [glowRef1, glowRef2, glowRef3]) {
        if (ref.current) {
          (ref.current.material as MeshStandardMaterial).emissiveIntensity = 0;
        }
      }
      for (const seam of seamRefs.current) {
        if (seam) (seam.material as MeshStandardMaterial).emissiveIntensity = 0;
      }
      if (poolRef.current) {
        (poolRef.current.material as MeshStandardMaterial).emissiveIntensity = 0;
      }
      return;
    }

    const t = Date.now() * 0.004;

    // Furnace door glow — main fire pulse
    if (glowRef1.current) {
      const mat = glowRef1.current.material as MeshStandardMaterial;
      mat.emissiveIntensity = 0.6 + Math.sin(t) * 0.35;
    }
    // Side viewport glows
    if (glowRef2.current) {
      const mat = glowRef2.current.material as MeshStandardMaterial;
      mat.emissiveIntensity = 0.45 + Math.sin(t * 1.3 + 1) * 0.3;
    }
    if (glowRef3.current) {
      const mat = glowRef3.current.material as MeshStandardMaterial;
      mat.emissiveIntensity = 0.4 + Math.sin(t * 0.9 + 2) * 0.25;
    }

    // Emissive seam lines — breathing
    for (const seam of seamRefs.current) {
      if (!seam) continue;
      const mat = seam.material as MeshStandardMaterial;
      mat.emissiveIntensity = 0.3 + Math.sin(t * 0.7) * 0.15;
    }

    // Bellows — breathing pump
    if (bellowsRef.current) {
      bellowsRef.current.scale.y = 1 + Math.sin(t * 0.8) * 0.1;
    }

    // Molten pool — slow throb
    if (poolRef.current) {
      const mat = poolRef.current.material as MeshStandardMaterial;
      mat.emissiveIntensity = 1.0 + Math.sin(t * 0.5) * 0.4;
    }
  });

  return (
    <group {...props}>
      {/* ═══════════════════════════════════════════
          1. FOUNDATION — cold structural base
          ═══════════════════════════════════════════ */}
      <group position={[0, FOUND_Y, 0]}>
        <mesh>
          <cylinderGeometry args={[0.26, 0.29, FOUND_H, SIDES]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
        <mesh position={[0, -FOUND_H / 2 + 0.005, 0]}>
          <cylinderGeometry args={[0.30, 0.31, 0.012, SIDES]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════════
          2. WARM COLLAR — transition to hot zone
          ═══════════════════════════════════════════ */}
      <group position={[0, FOUND_H + COLLAR_H / 2, 0]}>
        <mesh>
          <cylinderGeometry args={[0.20, 0.24, COLLAR_H, SIDES]} />
          <meshStandardMaterial color={WARM_COLLAR} {...M} roughness={0.6} />
        </mesh>
        {/* Warm accent ring at top */}
        <mesh position={[0, COLLAR_H / 2 - 0.005, 0]}>
          <cylinderGeometry args={[0.205, 0.21, 0.008, SIDES]} />
          <meshStandardMaterial color={COLORS.smelterDark} {...M} roughness={0.55} />
        </mesh>
        {Array.from({ length: SIDES }, (_, i) => {
          const a = (i / SIDES) * Math.PI * 2;
          return (
            <mesh
              key={`cb-${i}`}
              position={[Math.sin(a) * 0.215, 0, Math.cos(a) * 0.215]}
            >
              <cylinderGeometry args={[0.008, 0.008, 0.01, 6]} />
              <meshStandardMaterial color={COLORS.smelterDark} {...M} roughness={0.55} />
            </mesh>
          );
        })}
      </group>

      {/* ═══════════════════════════════════════════
          3. CAULDRON BELLY — THE defining form
          Squat wide sphere with flat shading.
          Everything warm. This IS the smelter.
          ═══════════════════════════════════════════ */}
      {/* Main belly sphere */}
      <mesh position={[0, BELLY_Y, 0]} scale={[BELLY_SX, BELLY_SY, BELLY_SX]}>
        <sphereGeometry args={[BELLY_R, 10, 8]} />
        <meshStandardMaterial
          color={COLORS.smelter}
          {...M}
          roughness={0.5}
          flatShading
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>

      {/* Belly band — dark industrial strap at equator */}
      <mesh position={[0, BELLY_Y - 0.015, 0]}>
        <torusGeometry args={[BELLY_EFF_R + 0.005, 0.012, 6, 12]} />
        <meshStandardMaterial
          color={WARM_FRAME}
          {...M}
          roughness={0.6}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* Lower belly collar — transition from collar to sphere */}
      <mesh position={[0, COLLAR_TOP + 0.015, 0]}>
        <cylinderGeometry args={[BELLY_EFF_R - 0.02, 0.20, 0.03, SIDES]} />
        <meshStandardMaterial color={WARM_FRAME} {...M} roughness={0.6} />
      </mesh>

      {/* 2× Emissive seam lines — thick, bright heat cracks */}
      {[-0.04, 0.04].map((dy, i) => (
        <mesh
          key={`seam-${dy}`}
          ref={(el) => {
            if (el) seamRefs.current[i] = el;
          }}
          position={[0, BELLY_Y + dy, 0]}
        >
          <torusGeometry args={[BELLY_EFF_R - 0.01, 0.005, 6, 12]} />
          <meshStandardMaterial
            color={COLORS.smelterDark}
            emissive={COLORS.smelter}
            emissiveIntensity={0.3}
            {...M}
            roughness={0.4}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ))}

      {/* ═══════════════════════════════════════════
          3b. FURNACE DOOR — front face, large
          THE primary visual cue: "this is a furnace"
          ═══════════════════════════════════════════ */}
      <group position={[0, BELLY_Y, BELLY_EFF_R - 0.005]}>
        {/* Door frame — thick warm surround */}
        <mesh>
          <boxGeometry args={[0.16, 0.13, 0.022]} />
          <meshStandardMaterial color={WARM_FRAME} {...M} roughness={0.65} />
        </mesh>
        {/* Fire glow — large and bright */}
        <mesh ref={glowRef1} position={[0, 0, 0.01]}>
          <boxGeometry args={[0.12, 0.10, 0.008]} />
          <meshStandardMaterial
            color={COLORS.smelter}
            emissive={COLORS.smelter}
            emissiveIntensity={0.6}
            {...M}
            roughness={0.25}
          />
        </mesh>
        {/* 3× Heavy grate bars */}
        {[-1, 0, 1].map((row) => (
          <mesh key={`gbar-${row}`} position={[0, row * 0.03, 0.016]}>
            <boxGeometry args={[0.13, 0.008, 0.006]} />
            <meshStandardMaterial color={WARM_FRAME} {...M} roughness={0.6} />
          </mesh>
        ))}
        {/* Door hinges — left and right */}
        {[-1, 1].map((side) => (
          <mesh key={`hinge-${side}`} position={[side * 0.07, 0, 0.006]}>
            <cylinderGeometry args={[0.009, 0.009, 0.12, 6]} />
            <meshStandardMaterial color={WARM_COLLAR} {...M} roughness={0.55} />
          </mesh>
        ))}
        {/* Door handle */}
        <mesh position={[0.04, 0, 0.02]}>
          <boxGeometry args={[0.015, 0.04, 0.012]} />
          <meshStandardMaterial color={WARM_COLLAR} {...M} roughness={0.55} />
        </mesh>
      </group>

      {/* 2× Side viewport slits — flanking the furnace door */}
      {[55, -55].map((deg, idx) => {
        const a = (deg * Math.PI) / 180;
        return (
          <group
            key={`sv-${idx}`}
            position={[
              Math.sin(a) * (BELLY_EFF_R - 0.005),
              BELLY_Y,
              Math.cos(a) * (BELLY_EFF_R - 0.005),
            ]}
            rotation={[0, -a, 0]}
          >
            <mesh>
              <boxGeometry args={[0.10, 0.08, 0.018]} />
              <meshStandardMaterial color={WARM_FRAME} {...M} roughness={0.65} />
            </mesh>
            <mesh
              ref={idx === 0 ? glowRef2 : glowRef3}
              position={[0, 0, 0.008]}
            >
              <boxGeometry args={[0.075, 0.06, 0.008]} />
              <meshStandardMaterial
                color={COLORS.smelter}
                emissive={COLORS.smelter}
                emissiveIntensity={0.45}
                {...M}
                roughness={0.3}
              />
            </mesh>
            {[-1, 1].map((row) => (
              <mesh key={`sg-${idx}-${row}`} position={[0, row * 0.02, 0.013]}>
                <boxGeometry args={[0.08, 0.006, 0.005]} />
                <meshStandardMaterial color={WARM_FRAME} {...M} roughness={0.6} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* 3× Back panels — recessed dark panels on rear faces */}
      {[140, 180, 220].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return (
          <group
            key={`bp-${deg}`}
            position={[
              Math.sin(a) * (BELLY_EFF_R - 0.005),
              BELLY_Y,
              Math.cos(a) * (BELLY_EFF_R - 0.005),
            ]}
            rotation={[0, -a, 0]}
          >
            <mesh>
              <boxGeometry args={[0.06, 0.07, 0.015]} />
              <meshStandardMaterial color={WARM_FRAME} {...M} roughness={0.7} />
            </mesh>
            <mesh position={[0, 0, 0.003]}>
              <boxGeometry args={[0.045, 0.05, 0.008]} />
              <meshStandardMaterial color={WARM_COLLAR} {...M} roughness={0.6} />
            </mesh>
          </group>
        );
      })}

      {/* ═══════════════════════════════════════════
          4. NECK — constriction above belly
          ═══════════════════════════════════════════ */}
      <mesh position={[0, NECK_Y, 0]}>
        <cylinderGeometry args={[NECK_TOP_R, NECK_BOT_R, NECK_H, SIDES]} />
        <meshStandardMaterial color={WARM_FRAME} {...M} roughness={0.6} />
      </mesh>
      {/* Neck accent ring */}
      <mesh position={[0, NECK_Y, 0]}>
        <torusGeometry args={[(NECK_BOT_R + NECK_TOP_R) / 2, 0.006, 6, SIDES]} />
        <meshStandardMaterial
          color={COLORS.smelterDark}
          {...M}
          roughness={0.55}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* ═══════════════════════════════════════════
          5. MOUTH — flared rim, open top with molten pool
          ═══════════════════════════════════════════ */}
      <group position={[0, MOUTH_Y, 0]}>
        {/* Mouth flare */}
        <mesh>
          <cylinderGeometry
            args={[MOUTH_TOP_R, NECK_TOP_R, MOUTH_H, SIDES, 1, true]}
          />
          <meshStandardMaterial color={WARM_FRAME} {...M} roughness={0.6} />
        </mesh>
        {/* Bright rim lip */}
        <mesh position={[0, MOUTH_H / 2 - 0.003, 0]}>
          <cylinderGeometry
            args={[MOUTH_TOP_R + 0.015, MOUTH_TOP_R + 0.012, 0.008, SIDES]}
          />
          <meshStandardMaterial color={COLORS.smelterDark} {...M} roughness={0.5} />
        </mesh>
        {/* 8× Rim bolts */}
        {Array.from({ length: SIDES }, (_, i) => {
          const a = (i / SIDES) * Math.PI * 2;
          const r = MOUTH_TOP_R + 0.008;
          return (
            <mesh
              key={`rb-${i}`}
              position={[Math.sin(a) * r, 0, Math.cos(a) * r]}
            >
              <cylinderGeometry args={[0.006, 0.006, 0.01, 6]} />
              <meshStandardMaterial color={WARM_COLLAR} {...M} roughness={0.55} />
            </mesh>
          );
        })}
      </group>

      {/* Molten pool — large, bright, visible from above */}
      <mesh ref={poolRef} position={[0, BODY_TOP - 0.008, 0]}>
        <cylinderGeometry
          args={[MOUTH_TOP_R - 0.01, MOUTH_TOP_R - 0.015, 0.018, SIDES]}
        />
        <meshStandardMaterial
          color="#ffaa44"
          emissive="#ff6600"
          emissiveIntensity={1.2}
          {...M}
          roughness={0.3}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* ═══════════════════════════════════════════
          6. ORE HOPPER — funnel on right side (+X)
          ═══════════════════════════════════════════ */}
      <group
        position={[BELLY_EFF_R + 0.02, BELLY_Y + 0.02, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <mesh>
          <cylinderGeometry args={[0.065, 0.04, 0.10, 6]} />
          <meshStandardMaterial color={WARM_FRAME} {...M} roughness={0.65} />
        </mesh>
        <mesh position={[0, 0.015, 0]}>
          <cylinderGeometry args={[0.05, 0.03, 0.06, 6]} />
          <meshStandardMaterial color={COLORS.ore} {...M} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.055, 0]}>
          <cylinderGeometry args={[0.075, 0.07, 0.015, 6]} />
          <meshStandardMaterial color={WARM_COLLAR} {...M} roughness={0.55} />
        </mesh>
        {/* Decorative ore chunk */}
        <mesh position={[0.01, 0.04, 0.01]}>
          <icosahedronGeometry args={[0.018, 0]} />
          <meshStandardMaterial
            color={COLORS.ore}
            {...M}
            roughness={0.5}
            flatShading
          />
        </mesh>
        <mesh position={[0, -0.04, 0]}>
          <boxGeometry args={[0.04, 0.03, 0.04]} />
          <meshStandardMaterial color={WARM_COLLAR} {...M} roughness={0.6} />
        </mesh>
      </group>



      {/* ═══════════════════════════════════════════
          8. BELLOWS — THE hero feature, left side
          Large animated accordion that pumps air.
          7 rings, oversized, prominent silhouette.
          ═══════════════════════════════════════════ */}
      {/* Mount plate on belly */}
      <group
        position={[-(BELLY_EFF_R - 0.005), BELLY_Y, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <mesh>
          <boxGeometry args={[0.10, 0.11, 0.018]} />
          <meshStandardMaterial color={WARM_FRAME} {...M} roughness={0.65} />
        </mesh>
        <mesh position={[0, 0, 0.009]}>
          <boxGeometry args={[0.08, 0.09, 0.008]} />
          <meshStandardMaterial color={WARM_COLLAR} {...M} roughness={0.6} />
        </mesh>
      </group>

      {/* Nozzle pipe */}
      <mesh
        position={[-(BELLY_EFF_R + 0.02), BELLY_Y, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <cylinderGeometry args={[0.028, 0.035, 0.06, 6]} />
        <meshStandardMaterial color={WARM_FRAME} {...M} roughness={0.6} />
      </mesh>

      {/* Bellows accordion — animated breathing */}
      <group
        ref={bellowsRef}
        position={[-(BELLY_EFF_R + 0.07), BELLY_Y, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        {/* 7 accordion rings */}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const wide = i % 2 === 0;
          return (
            <mesh key={`bel-${i}`} position={[0, i * 0.02, 0]}>
              <cylinderGeometry
                args={[
                  wide ? 0.10 : 0.065,
                  wide ? 0.10 : 0.065,
                  wide ? 0.016 : 0.012,
                  SIDES,
                ]}
              />
              <meshStandardMaterial
                color={wide ? WARM_COLLAR : WARM_FRAME}
                {...M}
                roughness={0.6}
              />
            </mesh>
          );
        })}

        {/* End cap */}
        <mesh position={[0, 0.135, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.018, SIDES]} />
          <meshStandardMaterial color={WARM_COLLAR} {...M} roughness={0.55} />
        </mesh>

        {/* Handle knob */}
        <mesh position={[0, 0.155, 0]}>
          <sphereGeometry args={[0.028, 8, 6]} />
          <meshStandardMaterial color={COLORS.smelterLight} emissive={COLORS.smelter} emissiveIntensity={0.15} {...M} roughness={0.5} />
        </mesh>

        {/* Accent ring at base */}
        <mesh position={[0, -0.005, 0]}>
          <torusGeometry args={[0.105, 0.006, 6, SIDES]} />
          <meshStandardMaterial color={COLORS.smelter} {...M} roughness={0.5} />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════════
          9. CHIMNEY — back-right, warm base
          ═══════════════════════════════════════════ */}
      <group position={[0.09, BODY_TOP, -0.09]} rotation={[0, 0, -0.08]}>
        {/* Base collar — warm, hottest point */}
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry
            args={[CHIMNEY_R + 0.015, CHIMNEY_R + 0.025, 0.04, SIDES]}
          />
          <meshStandardMaterial
            color={COLORS.smelterDark}
            {...M}
            roughness={0.55}
          />
        </mesh>
        <mesh position={[0, 0.045, 0]}>
          <torusGeometry args={[CHIMNEY_R + 0.012, 0.006, 6, SIDES]} />
          <meshStandardMaterial
            color={COLORS.smelter}
            emissive={COLORS.smelter}
            emissiveIntensity={0.2}
            {...M}
            roughness={0.45}
          />
        </mesh>

        {/* Main pipe */}
        <mesh position={[0, CHIMNEY_H / 2 + 0.04, 0]}>
          <cylinderGeometry
            args={[CHIMNEY_R, CHIMNEY_R + 0.005, CHIMNEY_H, SIDES]}
          />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
        </mesh>

        {/* Heat bands */}
        <mesh position={[0, CHIMNEY_H * 0.3 + 0.04, 0]}>
          <torusGeometry args={[CHIMNEY_R + 0.007, 0.007, 6, SIDES]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.5} />
        </mesh>
        <mesh position={[0, CHIMNEY_H * 0.65 + 0.04, 0]}>
          <torusGeometry args={[CHIMNEY_R + 0.005, 0.006, 6, SIDES]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.5} />
        </mesh>

        {/* Lip + cap */}
        <mesh position={[0, CHIMNEY_H + 0.04, 0]}>
          <cylinderGeometry
            args={[CHIMNEY_R + 0.016, CHIMNEY_R, 0.022, SIDES]}
          />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
        </mesh>
        <mesh position={[0, CHIMNEY_H + 0.058, 0]}>
          <cylinderGeometry
            args={[CHIMNEY_R + 0.022, CHIMNEY_R + 0.022, 0.008, SIDES]}
          />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.6} />
        </mesh>

        {smokeActive && (
          <group position={[0, CHIMNEY_H + 0.065, 0]}>
            <ChimneySmoke />
          </group>
        )}
      </group>

      {/* ═══════════════════════════════════════════
          10. ACCESSORIES
          ═══════════════════════════════════════════ */}
      <StatusPole
        position={[BELLY_EFF_R + 0.02, BELLY_Y + 0.09, 0]}
        scale={0.25}
        status={status}
      />
      <Antenna position={[-0.10, BODY_TOP + 0.005, -0.06]} scale={0.22} speed={0.4} />
    </group>
  );
}
