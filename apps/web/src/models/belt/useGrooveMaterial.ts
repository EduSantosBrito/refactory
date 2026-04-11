/**
 * Hook for creating groove materials with automatic WebGL/WebGPU selection.
 *
 * Uses GLSL ShaderMaterial for WebGL renderer,
 * TSL MeshBasicNodeMaterial for WebGPU renderer.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Material } from "three";
import { Vector3 } from "three";
import { useIsWebGPU } from "../../components/WebGPUCanvas";
import {
  createGrooveMaterial,
  updateGrooveUniforms,
  type GrooveUniforms,
} from "./grooveMaterial";
import {
  createGrooveNodeMaterial,
  updateGrooveNodeUniforms,
  type GrooveNodeUniforms,
} from "./grooveNodeMaterial";

/* ── Unified uniform interface ───────────────────────────────── */

interface UnifiedUniforms {
  uTime: { value: number };
  uRepeat: { value: number };
  uOpacity: { value: number };
  uColor: { value: Vector3 };
}

export interface UseGrooveMaterialOptions {
  repeat: number;
  running?: boolean;
  speed: number;
  /** Set to true to reverse scroll direction */
  reverseScroll?: boolean;
}

export interface UseGrooveMaterialResult {
  material: Material;
  isWebGPU: boolean;
}

/**
 * Creates and animates a groove material.
 * Automatically selects between GLSL (WebGL) and TSL (WebGPU).
 *
 * @example
 * ```tsx
 * const { material } = useGrooveMaterial({
 *   repeat: 8,
 *   running: power === "running",
 *   speed: beltSpeed,
 * });
 *
 * return <mesh material={material}>...</mesh>;
 * ```
 */
export function useGrooveMaterial({
  repeat,
  running = true,
  speed,
  reverseScroll = false,
}: UseGrooveMaterialOptions): UseGrooveMaterialResult {
  const isWebGPU = useIsWebGPU();
  // Apply direction multiplier
  const effectiveSpeed = reverseScroll ? -speed : speed;

  // Create material based on renderer type
  const { material, uniforms } = useMemo(() => {
    if (isWebGPU) {
      const result = createGrooveNodeMaterial({ repeat, running });
      return {
        material: result.material as Material,
        uniforms: result.uniforms as unknown as UnifiedUniforms,
        isNode: true,
      };
    }
    const result = createGrooveMaterial({ repeat, running });
    return {
      material: result.material as Material,
      uniforms: result.uniforms as unknown as UnifiedUniforms,
      isNode: false,
    };
  }, [isWebGPU]);

  // Store refs for animation
  const uniformsRef = useRef(uniforms);
  const isNodeRef = useRef(isWebGPU);
  uniformsRef.current = uniforms;
  isNodeRef.current = isWebGPU;

  // Store effective speed for animation
  const effectiveSpeedRef = useRef(effectiveSpeed);
  effectiveSpeedRef.current = effectiveSpeed;

  // Animate uniforms
  useFrame((_, delta) => {
    if (isNodeRef.current) {
      updateGrooveNodeUniforms(
        uniformsRef.current as unknown as GrooveNodeUniforms,
        delta,
        effectiveSpeedRef.current,
        running,
      );
    } else {
      updateGrooveUniforms(
        uniformsRef.current as unknown as GrooveUniforms,
        delta,
        effectiveSpeedRef.current,
        running,
      );
    }
  });

  return { material, isWebGPU };
}
