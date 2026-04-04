import { useMemo } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import { NearestFilter, SRGBColorSpace } from "three";
import type { Mesh, MeshStandardMaterial } from "three";
import type { ModelProps } from "./colors";

const MODEL_PATH = "/models/rocks-sand-a.glb";
const TEXTURE_PATH = "/models/textures/colormap-pirate.png";

const COPPER_COLOR = "#c87840";
const COPPER_GLOW = "#e0a060";

export function CopperNode(props: ModelProps) {
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
      {/* Copper ore veins */}
      <mesh position={[0.06, 0.12, 0.12]} rotation={[0.3, 0.5, 0.4]} scale={[1, 0.4, 0.5]}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <meshStandardMaterial
          color={COPPER_COLOR}
          emissive={COPPER_GLOW}
          emissiveIntensity={0.3}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>
      <mesh position={[-0.08, 0.08, 0.08]} rotation={[0.6, 0.8, 0.2]} scale={[0.7, 0.3, 0.4]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial
          color={COPPER_COLOR}
          emissive={COPPER_GLOW}
          emissiveIntensity={0.25}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>
    </group>
  );
}

useGLTF.preload(MODEL_PATH);
useTexture.preload(TEXTURE_PATH);
