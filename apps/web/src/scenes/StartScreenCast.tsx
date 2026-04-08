import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Mesh, Group } from "three";
import { Character, type CharacterName } from "../models/Character";

/** Event name used to communicate the selected character from UI to 3D scene */
export const CHARACTER_SELECT_EVENT = "character-select";

interface CharacterSpec {
  readonly name: CharacterName;
  readonly position: [number, number, number];
  readonly rotationY: number;
  readonly bobOffset: number;
  readonly color: string;
}

const CHARACTER_HEIGHT = 1.55;
const ARROW_HEIGHT_ABOVE_HEAD = 0.35;

const CHARACTERS: readonly CharacterSpec[] = [
  {
    name: "Barbara",
    position: [-2.0, 0.06, 0.95],
    rotationY: 0.22,
    bobOffset: 0,
    color: "#ffc000",
  },
  {
    name: "Fernando",
    position: [-0.7, 0.06, 0.35],
    rotationY: 0.08,
    bobOffset: 0.7,
    color: "#ff0066",
  },
  {
    name: "Finn",
    position: [0.8, 0.06, 0.35],
    rotationY: -0.08,
    bobOffset: 1.3,
    color: "#00e639",
  },
  {
    name: "Rae",
    position: [2.2, 0.06, 0.9],
    rotationY: -0.22,
    bobOffset: 2,
    color: "#ff3300",
  },
];

/** Cute bouncing arrow — rounded sphere + softened cone, character-colored */
function SelectionArrow({
  position,
  color,
}: {
  readonly position: [number, number, number];
  readonly color: string;
}) {
  const groupRef = useRef<Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const bounce = Math.sin(state.clock.getElapsedTime() * 3.2) * 0.06;
    groupRef.current.position.y =
      position[1] + CHARACTER_HEIGHT + ARROW_HEIGHT_ABOVE_HEAD + bounce;
    groupRef.current.rotation.y = state.clock.getElapsedTime() * 1.2;
  });

  return (
    <group
      ref={groupRef}
      position={[
        position[0],
        position[1] + CHARACTER_HEIGHT + ARROW_HEIGHT_ABOVE_HEAD,
        position[2],
      ]}
    >
      {/* Sphere deeply overlapping cone to form seamless teardrop.
          Cone top radius matches sphere radius; sphere center sits
          at the cone's top edge so the upper half protrudes. */}
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          roughness={0.35}
          metalness={0.05}
        />
      </mesh>
      <mesh position={[0, -0.1, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.08, 0.16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          roughness={0.35}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}

function WavingCharacter({
  name,
  position,
  rotationY,
  bobOffset,
  isSelected,
}: CharacterSpec & { readonly isSelected: boolean }) {
  const bobRef = useRef<Group>(null);

  useFrame((state) => {
    if (!bobRef.current) {
      return;
    }

    bobRef.current.position.y =
      Math.sin((state.clock.getElapsedTime() + bobOffset) * 1.6) * 0.04;
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group ref={bobRef}>
        <Character
          name={name}
          animation={isSelected ? "Wave" : "Idle"}
          targetHeight={CHARACTER_HEIGHT}
        />
      </group>
    </group>
  );
}

export function StartScreenCast() {
  const [selectedName, setSelectedName] = useState<CharacterName | null>(null);

  useEffect(() => {
    const handleSelect = (e: Event) => {
      const name = (e as CustomEvent<CharacterName | null>).detail;
      setSelectedName(name);
    };

    window.addEventListener(CHARACTER_SELECT_EVENT, handleSelect);
    return () => window.removeEventListener(CHARACTER_SELECT_EVENT, handleSelect);
  }, []);

  const selectedChar = selectedName
    ? CHARACTERS.find((c) => c.name === selectedName)
    : null;

  return (
    <>
      {CHARACTERS.map((character) => (
        <WavingCharacter
          key={character.name}
          {...character}
          isSelected={character.name === selectedName}
        />
      ))}
      {selectedChar ? (
        <SelectionArrow position={selectedChar.position} color={selectedChar.color} />
      ) : null}
    </>
  );
}
