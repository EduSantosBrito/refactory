import { Canvas } from "@react-three/fiber";
import { DirectorVoss } from "../models/DirectorVoss";

/** Static head-on portrait of Voss rendered in a tiny hologram canvas */
function VossScene() {
  return (
    <>
      {/* Hologram-style cyan lighting */}
      <ambientLight intensity={0.35} color="#88ccff" />
      <directionalLight
        position={[0.5, 1.5, 2]}
        intensity={1.4}
        color="#66ddff"
      />
      <directionalLight
        position={[-1, 0.5, 1]}
        intensity={0.5}
        color="#4488cc"
      />
      <pointLight position={[0, 0, 1.5]} intensity={0.6} color="#00ccff" />

      {/* Push model down so face is centered in frame */}
      <group position={[0, -0.96, 0]}>
        <DirectorVoss scale={2.2} />
      </group>
    </>
  );
}

export function VossPortrait() {
  return (
    <div className="voss-portrait">
      <div className="voss-portrait-canvas">
        <Canvas
          frameloop="demand"
          dpr={1}
          gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
          camera={{
            position: [0, 0.18, 0.52],
            fov: 38,
            near: 0.01,
            far: 5,
          }}
          style={{ background: "transparent" }}
        >
          <VossScene />
        </Canvas>
      </div>
      {/* Scanline overlay */}
      <div className="voss-portrait-scanlines" aria-hidden="true" />
    </div>
  );
}
