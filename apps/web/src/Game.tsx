import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MOUSE, TOUCH } from "three";
import { CharacterViewer } from "./scenes/CharacterViewer";

interface KeyboardOrbitControls {
  listenToKeyEvents(domElement: HTMLElement | Window): void;
  stopListenToKeyEvents(): void;
}

export function Game() {
  const controlsRef = useRef<KeyboardOrbitControls | null>(null);

  return (
    <Canvas
      camera={{ position: [6, 14, 24], fov: 50, near: 0.1, far: 120 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      dpr={[1, 1.5]}
      onContextMenu={(event) => event.preventDefault()}
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh" }}
    >
      {/* Warm sky background — like an Animal Crossing evening */}
      <color attach="background" args={["#2a3040"]} />

      {/* Hemisphere light: warm sky + warm ground bounce */}
      <hemisphereLight args={["#b0d0f0", "#6a5a40", 0.6]} />

      {/* Main sun — warm and strong */}
      <directionalLight position={[8, 12, 6]} intensity={1.5} color="#fff5e0" />

      {/* Fill light — soft blue from the opposite side */}
      <directionalLight position={[-5, 8, -4]} intensity={0.4} color="#a0c8e8" />

      {/* Soft ambient so nothing is pure black */}
      <ambientLight intensity={0.25} color="#e8d8c8" />

      <fog attach="fog" args={["#2a3040", 30, 70]} />

      <CharacterViewer />

      <OrbitControls
        ref={(controls) => {
          if (controlsRef.current === controls) {
            return;
          }

          controlsRef.current?.stopListenToKeyEvents();
          controlsRef.current = controls;
          controls?.listenToKeyEvents(document.body);
        }}
        makeDefault
        target={[5, 0.5, 8]}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={1.5}
        maxDistance={120}
        enablePan
        enableDamping
        dampingFactor={0.08}
        keys={{ LEFT: "ArrowLeft", UP: "ArrowUp", RIGHT: "ArrowRight", BOTTOM: "ArrowDown" }}
        keyPanSpeed={40}
        mouseButtons={{ LEFT: MOUSE.ROTATE, RIGHT: MOUSE.PAN }}
        touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
      />
    </Canvas>
  );
}
