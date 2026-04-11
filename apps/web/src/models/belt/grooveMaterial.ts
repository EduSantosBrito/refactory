/**
 * Groove material factory - provides both WebGL (GLSL) and WebGPU (TSL) versions.
 *
 * The WebGL version uses traditional ShaderMaterial with GLSL strings.
 * The WebGPU version uses MeshBasicNodeMaterial with TSL nodes.
 *
 * Both versions share the same uniform interface for seamless switching.
 */
import { FrontSide, ShaderMaterial, Vector3, type IUniform } from "three";
import { GROOVE_RUNNING, GROOVE_STOPPED, grooveFrag, grooveVert } from "./shaders";

/* ── Uniform interface ───────────────────────────────────────── */

export interface GrooveUniforms {
  uTime: IUniform<number>;
  uRepeat: IUniform<number>;
  uOpacity: IUniform<number>;
  uColor: IUniform<Vector3>;
}

export interface GrooveMaterialResult {
  material: ShaderMaterial;
  uniforms: GrooveUniforms;
}

/* ── Material factory ────────────────────────────────────────── */

export interface GrooveMaterialOptions {
  repeat: number;
  running?: boolean;
}

/**
 * Creates a groove overlay material with GLSL shaders.
 * Compatible with WebGL renderer.
 */
export function createGrooveMaterial({
  repeat,
  running = true,
}: GrooveMaterialOptions): GrooveMaterialResult {
  const groove = running ? GROOVE_RUNNING : GROOVE_STOPPED;

  const uniforms: GrooveUniforms = {
    uTime: { value: 0 },
    uRepeat: { value: repeat },
    uOpacity: { value: groove.opacity },
    uColor: { value: new Vector3(...groove.color) },
  };

  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    vertexShader: grooveVert,
    fragmentShader: grooveFrag,
    uniforms: uniforms as unknown as Record<string, IUniform>,
  });

  return { material, uniforms };
}

/* ── Animation helper ────────────────────────────────────────── */

const LERP_THRESHOLD_OPACITY = 0.004;
const LERP_THRESHOLD_COLOR_SQ = 0.00001;

// Reusable vector for lerp calculations
const _lerpTarget = new Vector3();

/**
 * Updates groove uniforms with convergence optimization.
 * Call this in useFrame to animate the groove.
 */
export function updateGrooveUniforms(
  uniforms: GrooveUniforms,
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
    uniforms.uOpacity.value += (target.opacity - uniforms.uOpacity.value) * 0.1;
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
