import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  DoubleSide,
} from "three";
import type { ModelProps } from "./colors";
import { BELT_TILE, type BeltState } from "./ConveyorBelt";

/* ── Constants ─────────────────────────────────────────────── */

const BELT_SPEED = 0.8;
const SEGMENTS = 24;

// Pivot at tile corner — belt curves 90° from entry (-X face) to exit (-Z face)
const PIVOT_X = -0.5;
const PIVOT_Z = -0.5;
const CENTER_R = 0.5;
const HALF_W = 0.325; // half of belt width (0.65 total, matching straight belt)

const BELT_INNER = CENTER_R - HALF_W; // 0.175
const BELT_OUTER = CENTER_R + HALF_W; // 0.825
const FRAME_PAD = 0.06;
const FRAME_INNER = BELT_INNER - FRAME_PAD; // 0.115
const FRAME_OUTER = BELT_OUTER + FRAME_PAD; // 0.885

const BELT_H = BELT_TILE.height; // 0.4

// Arc: entry at angle π/2 (-X face center), exit at angle 0 (-Z face center)
const ARC_START = Math.PI / 2;
const ARC_END = 0;

// Chevron repeat scaled to arc length: 8 * (center_radius * π/2) ≈ 6
const OVERLAY_REPEAT = 6;

// Colors matched to Kenney conveyor colormap (bottom-left palette region)
const COLOR_SURFACE = "#33303a";
const COLOR_FRAME = "#4a4658";
const COLOR_BASE = "#7a7690";
const COLOR_CAP = "#222028";

/* ── Animated chevron shader (same as straight belt) ──────── */

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
    float y = abs(vUv.y - 0.5) * 2.0;
    float chevron = fract(x + y * 0.6);
    float line = smoothstep(0.38, 0.45, chevron) * (1.0 - smoothstep(0.55, 0.62, chevron));
    float edgeFade = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
    gl_FragColor = vec4(0.96, 0.78, 0.26, line * edgeFade * 0.35);
  }
`;

/* ── Geometry builders ────────────────────────────────────── */

function angleAt(t: number) {
  return ARC_START + t * (ARC_END - ARC_START);
}

/** Flat ring-segment strip for top / bottom faces */
function buildArcStrip(
  innerR: number,
  outerR: number,
  y: number,
  faceUp: boolean,
): BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const ny = faceUp ? 1 : -1;

  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const a = angleAt(t);
    const c = Math.cos(a);
    const s = Math.sin(a);

    // inner vertex
    pos.push(PIVOT_X + innerR * c, y, PIVOT_Z + innerR * s);
    nrm.push(0, ny, 0);
    uv.push(t, 0);

    // outer vertex
    pos.push(PIVOT_X + outerR * c, y, PIVOT_Z + outerR * s);
    nrm.push(0, ny, 0);
    uv.push(t, 1);
  }

  for (let i = 0; i < SEGMENTS; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    if (faceUp) {
      idx.push(a, b, c, b, d, c);
    } else {
      idx.push(a, c, b, b, c, d);
    }
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geom.setAttribute("normal", new Float32BufferAttribute(nrm, 3));
  geom.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geom.setIndex(idx);
  return geom;
}

/** Curved wall along the arc for inner / outer side faces */
function buildArcWall(
  radius: number,
  yBot: number,
  yTop: number,
  faceOut: boolean,
): BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const sign = faceOut ? 1 : -1;

  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const a = angleAt(t);
    const c = Math.cos(a);
    const s = Math.sin(a);

    // bottom vertex
    pos.push(PIVOT_X + radius * c, yBot, PIVOT_Z + radius * s);
    nrm.push(sign * c, 0, sign * s);
    uv.push(t, 0);

    // top vertex
    pos.push(PIVOT_X + radius * c, yTop, PIVOT_Z + radius * s);
    nrm.push(sign * c, 0, sign * s);
    uv.push(t, 1);
  }

  for (let i = 0; i < SEGMENTS; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    if (faceOut) {
      idx.push(a, d, b, a, c, d);
    } else {
      idx.push(a, b, d, a, d, c);
    }
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geom.setAttribute("normal", new Float32BufferAttribute(nrm, 3));
  geom.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geom.setIndex(idx);
  return geom;
}

/** Flat quad cap at an arc endpoint */
function buildCap(
  angle: number,
  innerR: number,
  outerR: number,
  yBot: number,
  yTop: number,
  isStart: boolean,
): BufferGeometry {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  // Cap normal faces away from the belt body along the tangent
  const nx = isStart ? -s : s;
  const nz = isStart ? c : -c;

  const ix = PIVOT_X + innerR * c;
  const iz = PIVOT_Z + innerR * s;
  const ox = PIVOT_X + outerR * c;
  const oz = PIVOT_Z + outerR * s;

  // v0=inner-bottom, v1=outer-bottom, v2=inner-top, v3=outer-top
  const pos = [ix, yBot, iz, ox, yBot, oz, ix, yTop, iz, ox, yTop, oz];
  const nrm = [nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz];
  const uv = [0, 0, 1, 0, 0, 1, 1, 1];
  const idx = isStart ? [0, 1, 2, 1, 3, 2] : [0, 2, 1, 1, 2, 3];

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geom.setAttribute("normal", new Float32BufferAttribute(nrm, 3));
  geom.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geom.setIndex(idx);
  return geom;
}

/* ── Props ────────────────────────────────────────────────── */

export interface ConveyorBeltCurvedProps extends ModelProps {
  state?: BeltState;
  speed?: number;
}

/* ── Component ────────────────────────────────────────────── */

export function ConveyorBeltCurved({
  state = "working",
  speed = BELT_SPEED,
  ...props
}: ConveyorBeltCurvedProps) {
  const overlayMatRef = useRef<ShaderMaterial>(null);

  const geo = useMemo(
    () => ({
      top: buildArcStrip(FRAME_INNER, FRAME_OUTER, BELT_H, true),
      bottom: buildArcStrip(FRAME_INNER, FRAME_OUTER, 0, false),
      innerWall: buildArcWall(FRAME_INNER, 0, BELT_H, false),
      outerWall: buildArcWall(FRAME_OUTER, 0, BELT_H, true),
      startCap: buildCap(ARC_START, FRAME_INNER, FRAME_OUTER, 0, BELT_H, true),
      endCap: buildCap(ARC_END, FRAME_INNER, FRAME_OUTER, 0, BELT_H, false),
      overlay: buildArcStrip(BELT_INNER, BELT_OUTER, BELT_H + 0.001, true),
    }),
    [],
  );

  useFrame((_, delta) => {
    if (!overlayMatRef.current) return;
    const u = overlayMatRef.current.uniforms.uTime;
    if (state === "working" && u) {
      u.value += delta * speed;
    }
  });

  return (
    <group {...props}>
      {/* Belt surface */}
      <mesh geometry={geo.top}>
        <meshStandardMaterial color={COLOR_SURFACE} roughness={0.6} metalness={0.05} />
      </mesh>
      {/* Bottom */}
      <mesh geometry={geo.bottom}>
        <meshStandardMaterial color={COLOR_BASE} roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Side walls */}
      <mesh geometry={geo.innerWall}>
        <meshStandardMaterial color={COLOR_FRAME} roughness={0.6} metalness={0.05} />
      </mesh>
      <mesh geometry={geo.outerWall}>
        <meshStandardMaterial color={COLOR_FRAME} roughness={0.6} metalness={0.05} />
      </mesh>
      {/* End caps */}
      <mesh geometry={geo.startCap}>
        <meshStandardMaterial color={COLOR_CAP} roughness={0.7} metalness={0} />
      </mesh>
      <mesh geometry={geo.endCap}>
        <meshStandardMaterial color={COLOR_CAP} roughness={0.7} metalness={0} />
      </mesh>

      {/* Animated chevron overlay */}
      <mesh geometry={geo.overlay}>
        <shaderMaterial
          ref={overlayMatRef}
          transparent
          depthWrite={false}
          side={DoubleSide}
          vertexShader={stripeVert}
          fragmentShader={stripeFrag}
          uniforms={{
            uTime: { value: 0 },
            uRepeat: { value: OVERLAY_REPEAT },
          }}
        />
      </mesh>
    </group>
  );
}
