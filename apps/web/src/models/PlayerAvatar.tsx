import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import { NearestFilter, SRGBColorSpace } from "three";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import type { ModelProps } from "./colors";

const MODEL_PATH = "/models/character-male-e.glb";
const TEXTURE_PATH = "/models/textures/colormap.png";

export function PlayerAvatar(props: ModelProps) {
  const ref = useRef<Group>(null);
  const { scene } = useGLTF(MODEL_PATH);
  const colormap = useTexture(TEXTURE_PATH);

  const coloredScene = useMemo(() => {
    colormap.flipY = false;
    colormap.colorSpace = SRGBColorSpace;
    colormap.minFilter = NearestFilter;
    colormap.magFilter = NearestFilter;

    const cloned = scene.clone();
    cloned.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        const mat = (mesh.material as MeshStandardMaterial).clone();
        mat.map = colormap;
        mat.needsUpdate = true;
        mesh.material = mat;
      }
    });
    return cloned;
  }, [scene, colormap]);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.y = Math.sin(Date.now() * 0.003) * 0.02;
  });

  return (
    <group {...props}>
      <group ref={ref}>
        <primitive object={coloredScene} scale={0.5} />
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_PATH);
useTexture.preload(TEXTURE_PATH);
