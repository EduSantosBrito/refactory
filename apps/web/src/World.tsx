import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { WorldScene } from "./world/WorldScene";

const WORLD_FOG_COLOR = "#7395a4";
const WORLD_FOG_NEAR = 48;
const WORLD_FOG_FAR = 116;

export function World({ isPaused = false }: { readonly isPaused?: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 15, 12], fov: 50, near: 0.1, far: 220 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      dpr={[1, 1.5]}
      onContextMenu={(e) => e.preventDefault()}
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh" }}
    >
      <color attach="background" args={[WORLD_FOG_COLOR]} />

      {/* Warm hemisphere: bright sky + warm ground bounce */}
      <hemisphereLight args={["#c0e0ff", "#7a9a50", 0.95]} />

      {/* Main sun — warm afternoon */}
      <directionalLight
        position={[30, 40, 20]}
        intensity={2.0}
        color="#fff5e0"
      />

      {/* Fill light — cool side */}
      <directionalLight
        position={[-20, 30, -15]}
        intensity={0.45}
        color="#a0c8e8"
      />

      {/* Ambient baseline */}
      <ambientLight intensity={0.45} color="#e8e0d8" />

      {/* Heavy horizon fog hides cull transitions and chunk limits. */}
      <fog
        attach="fog"
        args={[WORLD_FOG_COLOR, WORLD_FOG_NEAR, WORLD_FOG_FAR]}
      />

      <Suspense fallback={null}>
        <WorldScene isPaused={isPaused} />
      </Suspense>
    </Canvas>
  );
}
