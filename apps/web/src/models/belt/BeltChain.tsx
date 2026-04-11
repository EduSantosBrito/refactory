import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import type { ModelProps } from "../colors";
import { BeltCurve } from "./BeltCurve";
import { BeltSegment } from "./BeltSegment";
import {
  ARC_END,
  ARC_START,
  BELT_SPEED,
  BELT_TILE,
  CURVE_CENTER_R,
  CURVE_PIVOT_X,
  CURVE_PIVOT_Z,
  DEFAULT_BELT_RATE_PER_MINUTE,
  resolveBeltSpeed,
} from "./constants";
import type {
  BeltContentState,
  BeltPowerState,
  BeltSegmentType,
  ChainItem,
  ChainPath,
  ChainPosition,
  ChainSegment,
} from "./types";

/* ── Path math ───────────────────────────────────────────── */

/**
 * Compute local-space position within a single segment at progress t (0..1).
 * Returns position relative to the segment's origin.
 *
 * @param turn - For curves: "left" = CCW (west→north), "right" = CW (west→south)
 */
function getSegmentLocalPosition(
  type: BeltSegmentType,
  t: number,
  turn: "left" | "right" = "left",
): ChainPosition {
  if (type === "straight") {
    // Linear from input (-0.5) to output (+0.5) along X
    return {
      x: -0.5 + t,
      y: BELT_TILE.height,
      z: 0,
      facingY: Math.PI / 2, // facing +X
    };
  }

  // Curve: arc from west face to north face (left) or south face (right)
  const angle = ARC_START + t * (ARC_END - ARC_START);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // Mirror Z for right turns
  const mirrorZ = turn === "right" ? -1 : 1;

  // Tangent direction: for left turn (sin(a), 0, -cos(a)), for right turn (sin(a), 0, cos(a))
  const facingY = Math.atan2(sinA, -cosA * mirrorZ);

  return {
    x: CURVE_PIVOT_X + CURVE_CENTER_R * cosA,
    y: BELT_TILE.height,
    z: (CURVE_PIVOT_Z + CURVE_CENTER_R * sinA) * mirrorZ,
    facingY,
  };
}

/**
 * Transform a segment-local position to world space using the segment's
 * world position and Y-axis rotation.
 *
 * Uses the standard 3D Y-axis rotation matrix (matches Three.js Euler Y):
 *   x' = x·cos(θ) + z·sin(θ)
 *   z' = -x·sin(θ) + z·cos(θ)
 */
function localToWorld(local: ChainPosition, seg: ChainSegment): ChainPosition {
  const cos = Math.cos(seg.rotationY);
  const sin = Math.sin(seg.rotationY);

  return {
    x: seg.position[0] + local.x * cos + local.z * sin,
    y: seg.position[1] + local.y,
    z: seg.position[2] - local.x * sin + local.z * cos,
    facingY: local.facingY + seg.rotationY,
  };
}

/**
 * Compute world-space position for a given progress along the entire chain.
 */
function getChainPosition(
  progress: number,
  segments: ChainSegment[],
  path: ChainPath,
): ChainPosition {
  const distance = progress * path.totalLength;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments.at(i);
    if (!seg) {
      continue;
    }
    const segStart = path.cumulativeLengths[i] ?? 0;
    const segEnd = segStart + seg.pathLength;

    if (distance <= segEnd || i === segments.length - 1) {
      const localT =
        seg.pathLength > 0
          ? Math.max(0, Math.min(1, (distance - segStart) / seg.pathLength))
          : 0;
      const localPos = getSegmentLocalPosition(seg.type, localT, seg.turn);
      return localToWorld(localPos, seg);
    }
  }

  // Fallback — shouldn't reach
  return { x: 0, y: BELT_TILE.height, z: 0, facingY: 0 };
}

/**
 * Build the chain path from segment descriptors.
 */
function computeChainPath(segments: ChainSegment[]): ChainPath {
  let total = 0;
  const cumulative: number[] = [];
  for (const seg of segments) {
    cumulative.push(total);
    total += seg.pathLength;
  }
  return { totalLength: total, cumulativeLengths: cumulative };
}

/* ── Chain item renderer ─────────────────────────────────── */

interface ChainItemRendererProps {
  item: ChainItem;
  segments: ChainSegment[];
  path: ChainPath;
  power: BeltPowerState;
  speed: number;
  loop: boolean;
}

function ChainItemRenderer({
  item,
  segments,
  path,
  power,
  speed,
  loop,
}: ChainItemRendererProps) {
  const groupRef = useRef<Group>(null);
  const progressRef = useRef(clampProgress(item.progress));
  const heightOffset = item.heightOffset ?? 0.12;

  // Reset progress when item prop changes
  const lastIdRef = useRef(item.id);
  if (lastIdRef.current !== item.id) {
    progressRef.current = clampProgress(item.progress);
    lastIdRef.current = item.id;
  }

  useFrame((_, delta) => {
    if (power === "running" && path.totalLength > 0) {
      let p = progressRef.current + (delta * speed) / path.totalLength;
      if (loop) {
        p = ((p % 1) + 1) % 1;
      } else {
        p = Math.min(p, 1);
      }
      progressRef.current = p;
    }

    const group = groupRef.current;
    if (!group) return;

    const pos = getChainPosition(progressRef.current, segments, path);
    group.position.set(pos.x, pos.y + heightOffset, pos.z);
    group.rotation.y = pos.facingY;
  });

  // Initial position
  const initPos = getChainPosition(progressRef.current, segments, path);

  return (
    <group
      ref={groupRef}
      position={[initPos.x, initPos.y + heightOffset, initPos.z]}
      rotation={[0, initPos.facingY, 0]}
    >
      {item.node}
    </group>
  );
}

function clampProgress(p: number) {
  return Math.max(0, Math.min(1, p));
}

/* ── BeltChain component ─────────────────────────────────── */

export interface BeltChainProps extends ModelProps {
  /** Ordered list of connected belt segments forming the path */
  segments: ChainSegment[];
  /** Items traveling on the belt */
  items?: ChainItem[];
  /** Power state for all segments */
  power?: BeltPowerState;
  /** Content state for all segments */
  content?: BeltContentState;
  /** Target throughput in whole items per minute */
  ratePerMinute?: number;
  /** Belt speed in world-units per second */
  speed?: number;
  /** Wrap items around when they reach the end (demo mode) */
  loop?: boolean;
  /** Render terminus brackets at the start and/or end of the chain */
  endCaps?: boolean;
}

/**
 * A chain of connected belt segments with continuous item transport.
 *
 * Items move smoothly across segment boundaries — their progress is
 * tracked as a single normalized value (0..1) over the entire chain,
 * and the world position is computed by mapping that to the correct
 * segment's local path.
 *
 * ## Usage
 *
 * ```tsx
 * <BeltChain
 *   segments={[
 *     { key: "s1", type: "straight", position: [0, 0, 0], rotationY: 0, pathLength: 1 },
 *     { key: "s2", type: "curve", position: [1, 0, 0], rotationY: 0, pathLength: 0.785 },
 *     { key: "s3", type: "straight", position: [1, 0, -1], rotationY: -Math.PI/2, pathLength: 1 },
 *   ]}
 *   items={[
 *     { id: "ore-1", progress: 0, node: <IronOre /> },
 *     { id: "ore-2", progress: 0.3, node: <IronOre /> },
 *   ]}
 *   power="running"
 *   content="filled"
 *   loop
 * />
 * ```
 */
export function BeltChain({
  segments,
  items = [],
  power = "running",
  content = "empty",
  ratePerMinute = DEFAULT_BELT_RATE_PER_MINUTE,
  speed,
  loop = false,
  endCaps = false,
  ...props
}: BeltChainProps) {
  const path = useMemo(() => computeChainPath(segments), [segments]);
  const beltSpeed = useMemo(
    () =>
      resolveBeltSpeed({
        ratePerMinute,
        speed,
        pathLength: loop ? path.totalLength : undefined,
        itemCount: loop ? items.length : undefined,
      }) ?? BELT_SPEED,
    [items.length, loop, path.totalLength, ratePerMinute, speed],
  );

  return (
    <group {...props}>
      {/* ── Render belt segment geometry ──────────────────── */}
      {segments.map((seg, i) => {
        const SegComponent = seg.type === "straight" ? BeltSegment : BeltCurve;
        const isFirst = i === 0;
        const isLast = i === segments.length - 1;
        let endCap: "start" | "end" | "both" | undefined;
        if (endCaps) {
          if (isFirst && isLast) endCap = "both";
          else if (isFirst) endCap = "start";
          else if (isLast) endCap = "end";
        }
        return (
          <SegComponent
            key={seg.key}
            position={seg.position}
            rotation={[0, seg.rotationY, 0]}
            power={power}
            content={content}
            ratePerMinute={ratePerMinute}
            speed={beltSpeed}
            endCap={endCap}
            turn={seg.turn}
            reverseScroll={seg.reverseScroll}
          />
        );
      })}

      {/* ── Render traveling items ────────────────────────── */}
      {content === "filled" &&
        items.map((item) => (
          <ChainItemRenderer
            key={item.id}
            item={item}
            segments={segments}
            path={path}
            power={power}
            speed={beltSpeed}
            loop={loop}
          />
        ))}
    </group>
  );
}

/* ── Exported utilities ──────────────────────────────────── */

export { computeChainPath, getChainPosition, getSegmentLocalPosition };
