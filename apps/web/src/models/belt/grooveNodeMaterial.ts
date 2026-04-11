/**
 * TSL-based groove material for WebGPU renderer.
 *
 * Uses Three.js Shading Language (TSL) node-based shaders
 * that compile to WGSL for WebGPU.
 */
import {
  Fn,
  clamp,
  float,
  fract,
  smoothstep,
  uniform,
  uv,
  vec3,
} from "three/tsl";
import { FrontSide, MeshBasicNodeMaterial, Vector3 } from "three/webgpu";
import { GROOVE_RUNNING, GROOVE_STOPPED } from "./shaders";

/* ── TSL Uniform wrapper ─────────────────────────────────────── */

interface TSLUniform<T> {
  value: T;
}

export interface GrooveNodeUniforms {
  uTime: TSLUniform<number>;
  uRepeat: TSLUniform<number>;
  uOpacity: TSLUniform<number>;
  uColor: TSLUniform<Vector3>;
}

export interface GrooveNodeMaterialResult {
  material: MeshBasicNodeMaterial;
  uniforms: GrooveNodeUniforms;
}

/* ── Material factory ────────────────────────────────────────── */

export interface GrooveNodeMaterialOptions {
  repeat: number;
  running?: boolean;
}

/**
 * Creates a TSL-based groove overlay material.
 * Uses MeshBasicNodeMaterial with TSL nodes for WebGPU.
 */
export function createGrooveNodeMaterial({
  repeat,
  running = true,
}: GrooveNodeMaterialOptions): GrooveNodeMaterialResult {
  const groove = running ? GROOVE_RUNNING : GROOVE_STOPPED;

  // Create TSL uniforms
  const uTime = uniform(0);
  const uRepeat = uniform(repeat);
  const uOpacity = uniform(groove.opacity);
  const uColor = uniform(new Vector3(...groove.color));

  // TSL groove pattern function
  const groovePattern = Fn(() => {
    const uvCoord = uv();

    // Scrolling fractional position
    const f = fract(uvCoord.x.mul(uRepeat).sub(uTime));

    // Thin lines at groove boundaries (f near 0 and 1)
    const lineStart = float(1.0).sub(smoothstep(float(0.0), float(0.08), f));
    const lineEnd = smoothstep(float(0.92), float(1.0), f);
    const line = clamp(lineStart.add(lineEnd), float(0.0), float(1.0));

    // Fade at lateral edges for soft blending into rails
    const edgeFadeIn = smoothstep(float(0.0), float(0.15), uvCoord.y);
    const edgeFadeOut = smoothstep(float(1.0), float(0.85), uvCoord.y);
    const edge = edgeFadeIn.mul(edgeFadeOut);

    // Final alpha
    return line.mul(edge).mul(uOpacity);
  })();

  // Create node material
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  // Assign TSL nodes
  material.colorNode = vec3(uColor.x, uColor.y, uColor.z);
  material.opacityNode = groovePattern;

  // Cast uniforms for external access
  const uniforms: GrooveNodeUniforms = {
    uTime: uTime as unknown as TSLUniform<number>,
    uRepeat: uRepeat as unknown as TSLUniform<number>,
    uOpacity: uOpacity as unknown as TSLUniform<number>,
    uColor: uColor as unknown as TSLUniform<Vector3>,
  };

  return { material, uniforms };
}

/* ── Animation helper ────────────────────────────────────────── */

const LERP_THRESHOLD_OPACITY = 0.004;
const LERP_THRESHOLD_COLOR_SQ = 0.00001;

// Reusable vector for lerp calculations
const _lerpTarget = new Vector3();

/**
 * Updates TSL groove uniforms with convergence optimization.
 */
export function updateGrooveNodeUniforms(
  uniforms: GrooveNodeUniforms,
  delta: number,
  speed: number,
  running: boolean,
): void {
  const target = running ? GROOVE_RUNNING : GROOVE_STOPPED;

  // Animate time (scrolling)
  if (running) {
    uniforms.uTime.value += delta * speed;
  }

  // Lerp opacity with convergence check
  const opacityDiff = Math.abs(target.opacity - uniforms.uOpacity.value);
  if (opacityDiff > LERP_THRESHOLD_OPACITY) {
    uniforms.uOpacity.value +=
      (target.opacity - uniforms.uOpacity.value) * 0.1;
  } else if (opacityDiff > 0) {
    uniforms.uOpacity.value = target.opacity;
  }

  // Lerp color with convergence check
  _lerpTarget.set(target.color[0], target.color[1], target.color[2]);
  const colorDiff = uniforms.uColor.value.distanceToSquared(_lerpTarget);
  if (colorDiff > LERP_THRESHOLD_COLOR_SQ) {
    uniforms.uColor.value.lerp(_lerpTarget, 0.1);
  } else if (colorDiff > 0) {
    uniforms.uColor.value.copy(_lerpTarget);
  }
}
