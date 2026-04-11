import type { AssetId } from "@refactory/contracts/worlds";
import type { WorldRuntimeSnapshot } from "@refactory/contracts/runtime";
import { lazy, Suspense } from "react";
import { OutlineProvider } from "./components/OutlineProvider";
import { WebGPUCanvas } from "./components/WebGPUCanvas";
import type { PortalParams } from "./portal";

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
  hasBackPortal = false,
  isPaused = false,
  isPortalEntry = false,
  portalParams = null,
  runtimeSnapshot,
}: {
  readonly assetId: AssetId;
  readonly hasBackPortal?: boolean;
  readonly isPaused?: boolean;
  readonly isPortalEntry?: boolean;
  readonly portalParams?: PortalParams | null;
  readonly runtimeSnapshot?: WorldRuntimeSnapshot;
}) {
  return (
    <WebGPUCanvas
      camera={{ position: INITIAL_CAMERA_POSITION, fov: 50, near: 0.1, far: 220 }}
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

      <OutlineProvider color={0xffffff} edgeStrength={3}>
        <Suspense fallback={null}>
          <WorldScene
            assetId={assetId}
            hasBackPortal={hasBackPortal}
            isPaused={isPaused}
            isPortalEntry={isPortalEntry}
            portalParams={portalParams}
            runtimeSnapshot={runtimeSnapshot}
          />
        </Suspense>
      </OutlineProvider>
    </WebGPUCanvas>
  );
}
