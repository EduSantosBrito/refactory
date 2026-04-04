import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { FrontSide, ShaderMaterial, Vector3 } from "three";
import {
  BELT_TILE,
  BELT_SPEED,
  RAIL_H,
  BASE_H,
  BASE_EXTEND,
  ACCENT_Y,
  GROOVE_DENSITY,
  CURVE_BELT_INNER,
  CURVE_BELT_OUTER,
  CURVE_FRAME_INNER,
  CURVE_FRAME_OUTER,
  CURVE_ARC_LENGTH,
  ARC_START,
  ARC_END,
  BELT_COLORS,
  BELT_MAT,
} from "./constants";
import { buildArcStrip, buildArcWall, buildArcCap } from "./geometry";
import { grooveVert, grooveFrag, GROOVE_RUNNING, GROOVE_STOPPED } from "./shaders";
import type { BeltSegmentProps, BeltPort } from "./types";

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
  content = "empty",
  speed = BELT_SPEED,
  ...props
}: BeltSegmentProps) {
  const overlayRef = useRef<ShaderMaterial>(null);

  const running = power === "running";
  const groove = running ? GROOVE_RUNNING : GROOVE_STOPPED;
  const repeat = CURVE_ARC_LENGTH * GROOVE_DENSITY;

  const geo = useMemo(() => {
    const FI = CURVE_FRAME_INNER;
    const FO = CURVE_FRAME_OUTER;
    const BI = CURVE_BELT_INNER;
    const BO = CURVE_BELT_OUTER;

    return {
      // ── Core body ──
      top: buildArcStrip(FI, FO, H, true),
      bottom: buildArcStrip(FI, FO, 0, false),
      innerWall: buildArcWall(FI, 0, H, false),
      outerWall: buildArcWall(FO, 0, H, true),
      startCap: buildArcCap(ARC_START, FI, FO, 0, H, true),
      endCap: buildArcCap(ARC_END, FI, FO, 0, H, false),

      // ── Belt surface (slightly raised, dark) ──
      surface: buildArcStrip(BI, BO, H + 0.001, true),

      // ── Raised rails ──
      innerRailWall: buildArcWall(BI, H, H + RAIL_H, false),
      innerRailTop: buildArcStrip(FI, BI, H + RAIL_H, true),
      outerRailWall: buildArcWall(BO, H, H + RAIL_H, true),
      outerRailTop: buildArcStrip(BO, FO, H + RAIL_H, true),

      // ── Base plate ──
      basePlateTop: buildArcStrip(FI - BASE_EXTEND, FO + BASE_EXTEND, BASE_H, true),
      basePlateBottom: buildArcStrip(FI - BASE_EXTEND, FO + BASE_EXTEND, 0, false),
      basePlateInner: buildArcWall(FI - BASE_EXTEND, 0, BASE_H, false),
      basePlateOuter: buildArcWall(FO + BASE_EXTEND, 0, BASE_H, true),

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
      u.uTime.value += delta * speed;
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
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <mesh geometry={geo.bottom}>
        <meshStandardMaterial color={BELT_COLORS.base} {...BELT_MAT.base} />
      </mesh>
      <mesh geometry={geo.innerWall}>
        <meshStandardMaterial color={BELT_COLORS.frame} {...BELT_MAT.frame} />
      </mesh>
      <mesh geometry={geo.outerWall}>
        <meshStandardMaterial color={BELT_COLORS.frame} {...BELT_MAT.frame} />
      </mesh>
      <mesh geometry={geo.startCap}>
        <meshStandardMaterial color={BELT_COLORS.cap} {...BELT_MAT.cap} />
      </mesh>
      <mesh geometry={geo.endCap}>
        <meshStandardMaterial color={BELT_COLORS.cap} {...BELT_MAT.cap} />
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
      <mesh geometry={geo.innerRailTop}>
        <meshStandardMaterial color={BELT_COLORS.rail} {...BELT_MAT.rail} />
      </mesh>
      <mesh geometry={geo.outerRailWall}>
        <meshStandardMaterial color={BELT_COLORS.rail} {...BELT_MAT.rail} />
      </mesh>
      <mesh geometry={geo.outerRailTop}>
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

      {/* ── Accent stripe ─────────────────────────────────── */}
      <mesh geometry={geo.accent}>
        <meshStandardMaterial color={BELT_COLORS.accent} {...BELT_MAT.accent} />
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
    </group>
  );
}

const _lerpTarget = new Vector3();
