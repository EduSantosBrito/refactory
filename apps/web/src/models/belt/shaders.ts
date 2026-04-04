/** Vertex shader for scrolling groove overlay */
export const grooveVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Fragment shader for scrolling groove overlay.
 * Draws thin lines perpendicular to travel direction that scroll with uTime,
 * creating the visual impression of a moving belt surface.
 */
export const grooveFrag = /* glsl */ `
  uniform float uTime;
  uniform float uRepeat;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float f = fract(vUv.x * uRepeat - uTime);
    // Thin line at each groove boundary (f near 0 and 1)
    float line = 1.0 - smoothstep(0.0, 0.08, f) + smoothstep(0.92, 1.0, f);
    line = clamp(line, 0.0, 1.0);
    // Fade at lateral edges for soft blending into rails
    float edge = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
    gl_FragColor = vec4(uColor, line * edge * uOpacity);
  }
`;

/* ── Groove visual config per power state ────────────────── */

/** Light metallic lines for running belts */
export const GROOVE_RUNNING = {
  color: [0.55, 0.5, 0.6] as const,
  opacity: 0.35,
};

/** Subtle lines for stopped belts */
export const GROOVE_STOPPED = {
  color: [0.4, 0.35, 0.45] as const,
  opacity: 0.12,
};
