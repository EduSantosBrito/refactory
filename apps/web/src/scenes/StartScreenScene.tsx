import { Suspense, useRef } from "react";
import { ContactShadows } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { Group } from "three";
import { Character, type CharacterName } from "../models/Character";
import {
  OakTree,
  DetailedTree,
  PineTree,
  FlatTopTree,
  Flower,
  Bush,
  GrassClump,
  Rock,
} from "../models/nature";

interface CharacterSpec {
  readonly name: CharacterName;
  readonly position: [number, number, number];
  readonly rotationY: number;
  readonly bobOffset: number;
}

const SCENE_CENTER = new Vector3(0, 0.55, 0);
const CHARACTER_HEIGHT = 1.55;

const CHARACTERS: CharacterSpec[] = [
  { name: "Barbara", position: [-2.4, 0.06, 0.95], rotationY: 0.22, bobOffset: 0 },
  { name: "Fernando", position: [-0.8, 0.06, 0.35], rotationY: 0.08, bobOffset: 0.7 },
  { name: "Finn", position: [0.9, 0.06, 0.35], rotationY: -0.08, bobOffset: 1.3 },
  { name: "Rae", position: [2.6, 0.06, 0.9], rotationY: -0.22, bobOffset: 2 },
];

function CameraDrift() {
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    state.camera.position.set(
      Math.sin(t * 0.06) * 0.5,
      1.9 + Math.cos(t * 0.1) * 0.08,
      5.2 + Math.cos(t * 0.05) * 0.25,
    );
    state.camera.lookAt(SCENE_CENTER);
  });
  return null;
}

function WavingCharacter({ name, position, rotationY, bobOffset }: CharacterSpec) {
  const bobRef = useRef<Group>(null);

  useFrame((state) => {
    if (!bobRef.current) return;
    bobRef.current.position.y = Math.sin((state.clock.getElapsedTime() + bobOffset) * 1.6) * 0.04;
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group ref={bobRef}>
        <Character name={name} animation="Wave" targetHeight={CHARACTER_HEIGHT} />
      </group>
    </group>
  );
}

function ParadiseIsland() {
  return (
    <group>
      {/* Water plane */}
      <mesh position={[0, -0.94, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[22, 96]} />
        <meshStandardMaterial color="#58cfd7" roughness={0.18} metalness={0.05} />
      </mesh>

      {/* Sand base */}
      <mesh position={[0, -0.45, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[7.8, 8.5, 0.9, 56]} />
        <meshStandardMaterial color="#f0d39e" roughness={0.98} />
      </mesh>

      {/* Grass layer */}
      <mesh position={[0, -0.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[7.3, 7.6, 0.22, 56]} />
        <meshStandardMaterial color="#72d45e" roughness={0.96} />
      </mesh>

      {/* Sandy clearing for characters */}
      <mesh position={[0, 0.03, 1.35]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.9, 1, 0.88]} receiveShadow>
        <circleGeometry args={[2.2, 48]} />
        <meshStandardMaterial color="#f7e2b4" roughness={1} />
      </mesh>

      {/* Background hills */}
      <mesh position={[-2.7, 0.2, -2.2]} scale={[2.2, 0.95, 2]} castShadow receiveShadow>
        <sphereGeometry args={[0.95, 32, 24]} />
        <meshStandardMaterial color="#84de72" roughness={0.98} />
      </mesh>
      <mesh position={[2.85, 0.16, -2.65]} scale={[2.4, 0.85, 2.15]} castShadow receiveShadow>
        <sphereGeometry args={[0.9, 32, 24]} />
        <meshStandardMaterial color="#78d569" roughness={0.98} />
      </mesh>

      {/* ── Trees (background canopy) ── */}
      <DetailedTree size="lg" position={[-4.4, 0.06, -1.9]} scale={3.2} rotation={[0, 0.35, 0]} />
      <OakTree size="lg" position={[-2.4, 0.08, -3.2]} scale={3.4} rotation={[0, -0.55, 0]} />
      <PineTree size="lg" position={[1.8, 0.08, -3.35]} scale={3.0} rotation={[0, 0.6, 0]} />
      <OakTree position={[4.8, 0.08, -1.7]} scale={2.8} rotation={[0, -0.4, 0]} />
      <FlatTopTree position={[5.25, 0.06, 1.35]} scale={2.6} rotation={[0, -0.8, 0]} />
      <PineTree size="sm" position={[-3.2, 0.06, -2.6]} scale={2.6} rotation={[0, 0.5, 0]} />

      {/* ── Extra trees (framing) ── */}
      <OakTree size="lg" position={[-5.8, 0.06, -0.5]} scale={3.8} rotation={[0, 0.4, 0]} />
      <PineTree size="lg" position={[6.2, 0.06, 0.3]} scale={3.4} rotation={[0, -0.6, 0]} />
      <FlatTopTree size="lg" position={[-3.6, 0.06, -3.8]} scale={3.6} rotation={[0, 0.7, 0]} />
      <DetailedTree position={[3.8, 0.06, -3.6]} scale={3.2} rotation={[0, -0.5, 0]} />

      {/* ── Bushes ── */}
      <Bush position={[-3.75, 0.04, 2.75]} scale={3.5} rotation={[0, 0.2, 0]} />
      <Bush position={[4.1, 0.04, -2.45]} scale={3.2} rotation={[0, 0.12, 0]} />
      <Bush position={[5.0, 0.04, 2.2]} scale={2.8} rotation={[0, -0.35, 0]} />

      {/* ── Flowers (foreground color) ── */}
      <Flower color="purple" position={[-3.2, 0.04, 2.1]} scale={2.8} rotation={[0, 0.3, 0]} />
      <Flower color="yellow" position={[-1.4, 0.04, 2.7]} scale={2.5} rotation={[0, -0.2, 0]} />
      <Flower color="red" position={[1.6, 0.04, 2.6]} scale={2.7} rotation={[0, 0.5, 0]} />
      <Flower color="purple" position={[3.2, 0.04, 2.3]} scale={2.4} rotation={[0, -0.4, 0]} />
      <Flower color="red" position={[-2.1, 0.04, 3.0]} scale={2.5} rotation={[0, -0.35, 0]} />

      {/* ── Grass ── */}
      <GrassClump position={[0.45, 0.04, 2.55]} scale={2.8} rotation={[0, 0.25, 0]} />
      <GrassClump position={[4.3, 0.04, 1.4]} scale={2.6} rotation={[0, -0.2, 0]} />

      {/* ── Rocks ── */}
      <Rock position={[3.65, 0.03, 2.95]} scale={3.2} rotation={[0, 0.7, 0]} />
      <Rock position={[5.35, 0.03, 2.35]} scale={2.4} rotation={[0, -0.28, 0]} />

      {/* ── Characters ── */}
      {CHARACTERS.map((c) => (
        <WavingCharacter key={c.name} {...c} />
      ))}

      <ContactShadows position={[0, 0.02, 0]} scale={18} opacity={0.32} blur={3} far={9} color="#1f7a57" />
    </group>
  );
}

function StartScreenContents() {
  return (
    <>
      <color attach="background" args={["#87dce0"]} />
      <fog attach="fog" args={["#b8f5e8", 9, 24]} />

      <hemisphereLight args={["#ffecd2", "#88cf92", 1.3]} />
      <ambientLight intensity={0.3} color="#fff8f0" />
      <directionalLight
        castShadow
        position={[10, 14, 8]}
        intensity={2.4}
        color="#ffe8a0"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-far={40}
      />
      <directionalLight position={[-8, 6, -8]} intensity={0.55} color="#a0d8ff" />
      <directionalLight position={[0, 4, 12]} intensity={0.3} color="#fff5e0" />

      <CameraDrift />
      <ParadiseIsland />
    </>
  );
}

export function StartScreenScene() {
  return (
    <Canvas
      className="stage"
      shadows
      camera={{ position: [0, 1.9, 5.2], fov: 55, near: 0.1, far: 100 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      dpr={[1, 1.5]}
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none" }}
    >
      <Suspense fallback={null}>
        <StartScreenContents />
      </Suspense>
    </Canvas>
  );
}
