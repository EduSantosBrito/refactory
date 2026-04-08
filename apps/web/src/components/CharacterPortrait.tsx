import { Canvas } from "@react-three/fiber";
import { Character, type CharacterName } from "../models/Character";

/** Warm scene lighting for a character bust portrait */
function PortraitScene({ name }: { readonly name: CharacterName }) {
  return (
    <>
      {/* Warm ambient fill */}
      <ambientLight intensity={0.5} color="#ffecd2" />
      {/* Key light — warm golden from top-right */}
      <directionalLight
        position={[1.5, 2, 2.5]}
        intensity={1.8}
        color="#ffe8a0"
      />
      {/* Fill light — soft blue from left */}
      <directionalLight
        position={[-1.5, 0.5, 1.5]}
        intensity={0.5}
        color="#a0d8ff"
      />
      {/* Rim light from behind */}
      <directionalLight
        position={[0, 1, -1.5]}
        intensity={0.3}
        color="#fff5e0"
      />

      {/* Character feet sit at y=0 after internal bounding-box
          alignment, head reaches ~y=targetHeight. Push the whole
          model down by the full height so the HEAD is at y≈0,
          then the camera (also at y≈0) frames the face. */}
      <group position={[0, -1.2, 0]}>
        <Character
          name={name}
          animation={null}
          targetHeight={1.0}
        />
      </group>
    </>
  );
}

export function CharacterPortrait({
  name,
}: {
  readonly name: CharacterName;
}) {
  return (
    <div className="character-portrait">
      <Canvas
        frameloop="always"
        dpr={1}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        camera={{
          position: [0, 0.0, 0.34],
          fov: 42,
          near: 0.01,
          far: 5,
        }}
        style={{ background: "transparent" }}
      >
        <PortraitScene name={name} />
      </Canvas>
    </div>
  );
}
