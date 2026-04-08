import { BufferGeometry, Float32BufferAttribute } from "three";
import {
  ARC_END,
  ARC_EXT,
  ARC_START,
  CURVE_PIVOT_X,
  CURVE_PIVOT_Z,
  CURVE_SEGMENTS,
} from "./constants";

/* ── Helpers ─────────────────────────────────────────────── */

/** Extended arc range — geometry overshoots tile boundary for seamless joints */
const EXT_START = ARC_START + ARC_EXT;
const EXT_END = ARC_END - ARC_EXT;

function angleAt(t: number) {
  return EXT_START + t * (EXT_END - EXT_START);
}

/* ── Arc geometry builders ───────────────────────────────── */

/**
 * Flat ring-segment strip for top / bottom faces of a curved belt.
 * Generates a horizontal annular strip between innerR and outerR at height y.
 */
export function buildArcStrip(
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

  for (let i = 0; i <= CURVE_SEGMENTS; i++) {
    const t = i / CURVE_SEGMENTS;
    const a = angleAt(t);
    const c = Math.cos(a);
    const s = Math.sin(a);

    // inner vertex
    pos.push(CURVE_PIVOT_X + innerR * c, y, CURVE_PIVOT_Z + innerR * s);
    nrm.push(0, ny, 0);
    uv.push(t, 0);

    // outer vertex
    pos.push(CURVE_PIVOT_X + outerR * c, y, CURVE_PIVOT_Z + outerR * s);
    nrm.push(0, ny, 0);
    uv.push(t, 1);
  }

  for (let i = 0; i < CURVE_SEGMENTS; i++) {
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

/**
 * Curved wall along the arc for inner / outer side faces.
 * Generates a vertical strip following the arc at the given radius.
 */
export function buildArcWall(
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

  for (let i = 0; i <= CURVE_SEGMENTS; i++) {
    const t = i / CURVE_SEGMENTS;
    const a = angleAt(t);
    const c = Math.cos(a);
    const s = Math.sin(a);

    // bottom vertex
    pos.push(CURVE_PIVOT_X + radius * c, yBot, CURVE_PIVOT_Z + radius * s);
    nrm.push(sign * c, 0, sign * s);
    uv.push(t, 0);

    // top vertex
    pos.push(CURVE_PIVOT_X + radius * c, yTop, CURVE_PIVOT_Z + radius * s);
    nrm.push(sign * c, 0, sign * s);
    uv.push(t, 1);
  }

  for (let i = 0; i < CURVE_SEGMENTS; i++) {
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

/**
 * Flat quad cap at an arc endpoint (start or end face).
 */
export function buildArcCap(
  angle: number,
  innerR: number,
  outerR: number,
  yBot: number,
  yTop: number,
  isStart: boolean,
): BufferGeometry {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  // Normal faces away from the belt body along the tangent
  const nx = isStart ? -s : s;
  const nz = isStart ? c : -c;

  const ix = CURVE_PIVOT_X + innerR * c;
  const iz = CURVE_PIVOT_Z + innerR * s;
  const ox = CURVE_PIVOT_X + outerR * c;
  const oz = CURVE_PIVOT_Z + outerR * s;

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
