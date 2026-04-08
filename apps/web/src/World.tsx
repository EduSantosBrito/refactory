import type { AssetId } from "@refactory/contracts/worlds";
import { Canvas } from "@react-three/fiber";
import { lazy, Suspense } from "react";

const WorldScene = lazy(() =>
  import("./world/WorldScene").then((module) => ({
    default: module.WorldScene,
  })),
);

const WORLD_FOG_COLOR = "#7395a4";
const WORLD_FOG_NEAR = 48;
const WORLD_FOG_FAR = 116;
const INITIAL_CAMERA_POSITION: [number, number, number] = [0, 18, 14];
const INITIAL_CAMERA_TARGET: [number, number, number] = [0, 0, 0];

export function World({
  assetId,
  isPaused = false,
}: {
  readonly assetId: AssetId;
  readonly isPaused?: boolean;
}) {
  return (
    <Canvas
      camera={{ position: INITIAL_CAMERA_POSITION, fov: 50, near: 0.1, far: 220 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      dpr={[1, 1.5]}
      onCreated={(state) => {
        state.camera.position.set(...INITIAL_CAMERA_POSITION);
        state.camera.lookAt(...INITIAL_CAMERA_TARGET);
      }}
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
        <WorldScene assetId={assetId} isPaused={isPaused} />
      </Suspense>
    </Canvas>
  );
}
