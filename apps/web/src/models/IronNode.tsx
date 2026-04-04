import { useMemo } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import { NearestFilter, SRGBColorSpace } from "three";
import type { Mesh, MeshStandardMaterial } from "three";
import { COLORS, type ModelProps } from "./colors";

const MODEL_PATH = "/models/rocks-c.glb";
const TEXTURE_PATH = "/models/textures/colormap-pirate.png";

export function IronNode(props: ModelProps) {
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

  return (
    <group {...props}>
      <primitive object={coloredScene} scale={0.5} />
      {/* Ore glow veins on the rock surface */}
      <mesh position={[0.05, 0.15, 0.15]} rotation={[0.2, 0.3, 0.6]} scale={[1, 0.4, 0.5]}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <meshStandardMaterial
          color={COLORS.ore}
          emissive={COLORS.oreGlow}
          emissiveIntensity={0.3}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[-0.1, 0.1, 0.1]} rotation={[0.5, 1.0, 0.1]} scale={[0.8, 0.35, 0.45]}>
        <sphereGeometry args={[0.08, 10, 8]} />
        <meshStandardMaterial
          color={COLORS.ore}
          emissive={COLORS.oreGlow}
          emissiveIntensity={0.25}
          roughness={0.45}
        />
      </mesh>
    </group>
  );
}

useGLTF.preload(MODEL_PATH);
useTexture.preload(TEXTURE_PATH);
