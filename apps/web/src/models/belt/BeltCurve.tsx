import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { FrontSide, type ShaderMaterial, Vector3 } from "three";
import {
  ACCENT_Y,
  ARC_END,
  ARC_EXT,
  ARC_START,
  BASE_EXTEND,
  BASE_H,
  BELT_COLORS,
  BELT_MAT,
  BELT_SPEED,
  BELT_TILE,
  CURVE_ARC_LENGTH,
  CURVE_BELT_INNER,
  CURVE_BELT_OUTER,
  CURVE_FRAME_INNER,
  CURVE_FRAME_OUTER,
  DEFAULT_BELT_RATE_PER_MINUTE,
  GROOVE_DENSITY,
  RAIL_H,
  SURFACE_W,
  resolveBeltSpeed,
} from "./constants";
import { buildArcCap, buildArcStrip, buildArcWall } from "./geometry";
import {
  GROOVE_RUNNING,
  GROOVE_STOPPED,
  grooveFrag,
  grooveVert,
} from "./shaders";
import type { BeltPort, BeltSegmentProps } from "./types";

const H = BELT_TILE.height;

/* ── Port definitions for a 90° curve segment ────────────── */

export const CURVE_PORTS: BeltPort[] = [
  { id: "in", role: "input", facing: "west", position: [-0.5, H / 2, 0] },
  { id: "out", role: "output", facing: "north", position: [0, H / 2, -0.5] },
];

/* ── Component ───────────────────────────────────────────── */

/**
 * Procedural 90° curved belt segment — 1×1 tile.
 *
 * Pivots at (-0.5, 0, -0.5), arcing from west face (-X) to north face (-Z).
 * Matches straight belt aesthetic with flat surface, scrolling grooves,
 * orange accent rails, base plate, accent stripe.
 */
export function BeltCurve({
  power = "running",
  content: _content = "empty",
  ratePerMinute = DEFAULT_BELT_RATE_PER_MINUTE,
  speed,
  endCap,
  ...props
}: BeltSegmentProps) {
  const overlayRef = useRef<ShaderMaterial>(null);
  const beltSpeed = resolveBeltSpeed({ ratePerMinute, speed }) ?? BELT_SPEED;

  const running = power === "running";
  const groove = running ? GROOVE_RUNNING : GROOVE_STOPPED;
  const repeat = CURVE_ARC_LENGTH * GROOVE_DENSITY;

  const geo = useMemo(() => {
    const FI = CURVE_FRAME_INNER;
    const FO = CURVE_FRAME_OUTER;
    const BI = CURVE_BELT_INNER;
    const BO = CURVE_BELT_OUTER;

    const BODY_BOT = BASE_H - 0.005;

    return {
      // ── Core body (overlaps into base plate like straight belt) ──
      top: buildArcStrip(FI, FO, H, true),
      bottom: buildArcStrip(FI, FO, BODY_BOT, false),
      innerWall: buildArcWall(FI, BODY_BOT, H, false),
      outerWall: buildArcWall(FO, BODY_BOT, H, true),
      startCap: buildArcCap(ARC_START + ARC_EXT, FI, FO, BODY_BOT, H, true),
      endCap: buildArcCap(ARC_END - ARC_EXT, FI, FO, BODY_BOT, H, false),

      // ── Belt surface (raised above frame top to avoid z-fighting) ──
      surface: buildArcStrip(BI, BO, H + 0.001, true),

      // ── Raised rails ──
      innerRailWall: buildArcWall(BI, H, H + RAIL_H, true),
      innerRailInnerWall: buildArcWall(FI, H, H + RAIL_H, false),
      innerRailTop: buildArcStrip(FI, BI, H + RAIL_H, true),
      innerRailStartCap: buildArcCap(
        ARC_START + ARC_EXT,
        FI,
        BI,
        H,
        H + RAIL_H,
        true,
      ),
      innerRailEndCap: buildArcCap(
        ARC_END - ARC_EXT,
        FI,
        BI,
        H,
        H + RAIL_H,
        false,
      ),
      outerRailWall: buildArcWall(BO, H, H + RAIL_H, false),
      outerRailOuterWall: buildArcWall(FO, H, H + RAIL_H, true),
      outerRailTop: buildArcStrip(BO, FO, H + RAIL_H, true),
      outerRailStartCap: buildArcCap(
        ARC_START + ARC_EXT,
        BO,
        FO,
        H,
        H + RAIL_H,
        true,
      ),
      outerRailEndCap: buildArcCap(
        ARC_END - ARC_EXT,
        BO,
        FO,
        H,
        H + RAIL_H,
        false,
      ),

      // ── Frame extension walls at base plate radii (visible from outside) ──
      outerFrameWall: buildArcWall(FO + BASE_EXTEND, BASE_H, H, true),
      innerFrameWall: buildArcWall(FI - BASE_EXTEND, BASE_H, H, false),
      outerFrameTop: buildArcStrip(FO, FO + BASE_EXTEND, H, true),
      innerFrameTop: buildArcStrip(FI - BASE_EXTEND, FI, H, true),

      // ── Base plate ──
      basePlateTop: buildArcStrip(
        FI - BASE_EXTEND,
        FO + BASE_EXTEND,
        BASE_H,
        true,
      ),
      basePlateBottom: buildArcStrip(
        FI - BASE_EXTEND,
        FO + BASE_EXTEND,
        0,
        false,
      ),
      basePlateInner: buildArcWall(FI - BASE_EXTEND, 0, BASE_H, false),
      basePlateOuter: buildArcWall(FO + BASE_EXTEND, 0, BASE_H, true),
      basePlateStartCap: buildArcCap(
        ARC_START + ARC_EXT,
        FI - BASE_EXTEND,
        FO + BASE_EXTEND,
        0,
        BASE_H,
        true,
      ),
      basePlateEndCap: buildArcCap(
        ARC_END - ARC_EXT,
        FI - BASE_EXTEND,
        FO + BASE_EXTEND,
        0,
        BASE_H,
        false,
      ),

      // ── Accent stripe ──
      accent: buildArcStrip(FI - 0.005, FO + 0.005, ACCENT_Y, true),

      // ── Groove overlay ──
      overlay: buildArcStrip(BI, BO, H + 0.003, true),
    };
  }, []);

  useFrame((_, delta) => {
    const mat = overlayRef.current;
    if (!mat) return;

    const u = mat.uniforms as {
      uTime: { value: number };
      uRepeat: { value: number };
      uOpacity: { value: number };
      uColor: { value: Vector3 };
    };

    if (running) {
      u.uTime.value += delta * beltSpeed;
    }

    u.uOpacity.value += (groove.opacity - u.uOpacity.value) * 0.1;
    u.uColor.value.lerp(
      _lerpTarget.set(groove.color[0], groove.color[1], groove.color[2]),
      0.1,
    );
  });

  return (
    <group {...props}>
      {/* ── Core body ─────────────────────────────────────── */}
      <mesh geometry={geo.top}>
        <meshStandardMaterial
          color={BELT_COLORS.frame}
          {...BELT_MAT.frame}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>
      <mesh geometry={geo.bottom}>
        <meshStandardMaterial color={BELT_COLORS.frame} {...BELT_MAT.frame} />
      </mesh>
      <mesh geometry={geo.innerWall}>
        <meshStandardMaterial color={BELT_COLORS.frame} {...BELT_MAT.frame} />
      </mesh>
      <mesh geometry={geo.outerWall}>
        <meshStandardMaterial color={BELT_COLORS.frame} {...BELT_MAT.frame} />
      </mesh>
      <mesh geometry={geo.startCap}>
        <meshStandardMaterial color={BELT_COLORS.frame} {...BELT_MAT.frame} />
      </mesh>
      <mesh geometry={geo.endCap}>
        <meshStandardMaterial color={BELT_COLORS.frame} {...BELT_MAT.frame} />
      </mesh>
      <mesh geometry={geo.outerFrameWall}>
        <meshStandardMaterial color={BELT_COLORS.frame} {...BELT_MAT.frame} />
      </mesh>
      <mesh geometry={geo.innerFrameWall}>
        <meshStandardMaterial color={BELT_COLORS.frame} {...BELT_MAT.frame} />
      </mesh>
      <mesh geometry={geo.outerFrameTop}>
        <meshStandardMaterial color={BELT_COLORS.frame} {...BELT_MAT.frame} />
      </mesh>
      <mesh geometry={geo.innerFrameTop}>
        <meshStandardMaterial color={BELT_COLORS.frame} {...BELT_MAT.frame} />
      </mesh>

      {/* ── Belt surface ──────────────────────────────────── */}
      <mesh geometry={geo.surface}>
        <meshStandardMaterial
          color={BELT_COLORS.surface}
          {...BELT_MAT.surface}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* ── Raised rails (orange accent) ──────────────────── */}
      <mesh geometry={geo.innerRailWall}>
        <meshStandardMaterial color={BELT_COLORS.rail} {...BELT_MAT.rail} />
      </mesh>
      <mesh geometry={geo.innerRailInnerWall}>
        <meshStandardMaterial color={BELT_COLORS.rail} {...BELT_MAT.rail} />
      </mesh>
      <mesh geometry={geo.innerRailTop}>
        <meshStandardMaterial color={BELT_COLORS.rail} {...BELT_MAT.rail} />
      </mesh>
      <mesh geometry={geo.innerRailStartCap}>
        <meshStandardMaterial color={BELT_COLORS.rail} {...BELT_MAT.rail} />
      </mesh>
      <mesh geometry={geo.innerRailEndCap}>
        <meshStandardMaterial color={BELT_COLORS.rail} {...BELT_MAT.rail} />
      </mesh>
      <mesh geometry={geo.outerRailWall}>
        <meshStandardMaterial color={BELT_COLORS.rail} {...BELT_MAT.rail} />
      </mesh>
      <mesh geometry={geo.outerRailOuterWall}>
        <meshStandardMaterial color={BELT_COLORS.rail} {...BELT_MAT.rail} />
      </mesh>
      <mesh geometry={geo.outerRailTop}>
        <meshStandardMaterial color={BELT_COLORS.rail} {...BELT_MAT.rail} />
      </mesh>
      <mesh geometry={geo.outerRailStartCap}>
        <meshStandardMaterial color={BELT_COLORS.rail} {...BELT_MAT.rail} />
      </mesh>
      <mesh geometry={geo.outerRailEndCap}>
        <meshStandardMaterial color={BELT_COLORS.rail} {...BELT_MAT.rail} />
      </mesh>

      {/* ── Base plate ────────────────────────────────────── */}
      <mesh geometry={geo.basePlateTop}>
        <meshStandardMaterial color={BELT_COLORS.base} {...BELT_MAT.base} />
      </mesh>
      <mesh geometry={geo.basePlateBottom}>
        <meshStandardMaterial color={BELT_COLORS.base} {...BELT_MAT.base} />
      </mesh>
      <mesh geometry={geo.basePlateInner}>
        <meshStandardMaterial color={BELT_COLORS.base} {...BELT_MAT.base} />
      </mesh>
      <mesh geometry={geo.basePlateOuter}>
        <meshStandardMaterial color={BELT_COLORS.base} {...BELT_MAT.base} />
      </mesh>
      <mesh geometry={geo.basePlateStartCap}>
        <meshStandardMaterial color={BELT_COLORS.base} {...BELT_MAT.base} />
      </mesh>
      <mesh geometry={geo.basePlateEndCap}>
        <meshStandardMaterial color={BELT_COLORS.base} {...BELT_MAT.base} />
      </mesh>

      {/* ── Accent stripe ─────────────────────────────────── */}
      <mesh geometry={geo.accent}>
        <meshStandardMaterial
          color={BELT_COLORS.accent}
          {...BELT_MAT.accent}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* ── Groove overlay — scrolling motion lines ───────── */}
      <mesh geometry={geo.overlay}>
        <shaderMaterial
          ref={overlayRef}
          transparent
          depthWrite={false}
          side={FrontSide}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
          vertexShader={grooveVert}
          fragmentShader={grooveFrag}
          uniforms={{
            uTime: { value: 0 },
            uRepeat: { value: repeat },
            uOpacity: { value: groove.opacity },
            uColor: { value: new Vector3(...groove.color) },
          }}
        />
      </mesh>

      {/* ── End-cap brackets — terminus where belt meets building ── */}
      {/* Start cap at west face (-X) */}
      {(endCap === "start" || endCap === "both") && (
        <mesh position={[-0.5, H / 2 + 0.01, 0]}>
          <boxGeometry args={[0.02, H * 0.65, SURFACE_W + 0.02]} />
          <meshStandardMaterial color={BELT_COLORS.cap} {...BELT_MAT.cap} />
        </mesh>
      )}
      {/* End cap at north face (-Z) */}
      {(endCap === "end" || endCap === "both") && (
        <mesh position={[0, H / 2 + 0.01, -0.5]}>
          <boxGeometry args={[SURFACE_W + 0.02, H * 0.65, 0.02]} />
          <meshStandardMaterial color={BELT_COLORS.cap} {...BELT_MAT.cap} />
        </mesh>
      )}
    </group>
  );
}

const _lerpTarget = new Vector3();
