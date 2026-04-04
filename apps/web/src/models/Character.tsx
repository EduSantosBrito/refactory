import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  AnimationMixer,
  Box3,
  LoopOnce,
  MathUtils,
  Mesh,
  Vector3,
} from "three";
import type { AnimationAction, Group, Object3D } from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

export type CharacterName = "Barbara" | "Fernando" | "Finn" | "Rae";

const CHARACTER_MODELS: Record<CharacterName, string> = {
  Barbara: "/models/Astronaut_BarbaraTheBee.glb",
  Fernando: "/models/Astronaut_FernandoTheFlamingo.glb",
  Finn: "/models/Astronaut_FinnTheFrog.glb",
  Rae: "/models/Astronaut_RaeTheRedPanda.glb",
};

const WEAPON_NAMES = new Set(["Pistol", "Gun", "Weapon", "Rifle"]);

function stripWeapons(object: Object3D) {
  const toRemove: Object3D[] = [];
  object.traverse((child) => {
    if (WEAPON_NAMES.has(child.name)) toRemove.push(child);
  });
  for (const obj of toRemove) obj.removeFromParent();
}

function enableShadows(object: Object3D) {
  object.traverse((child) => {
    if (child instanceof Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

interface CharacterProps {
  name: CharacterName;
  animation?: string | string[];
  targetHeight?: number;
  roam?: boolean;
}

export function Character({
  name,
  animation = "Idle",
  targetHeight = 1.55,
  roam = false,
}: CharacterProps) {
  const path = CHARACTER_MODELS[name];
  const groupRef = useRef<Group>(null);
  const mixerRef = useRef<AnimationMixer | null>(null);
  const prevActionRef = useRef<AnimationAction | null>(null);
  const { scene, animations } = useGLTF(path);

  const actor = useMemo(() => {
    const clone = skeletonClone(scene) as Group;
    stripWeapons(clone);
    enableShadows(clone);
    return clone;
  }, [scene]);

  // Auto-scale to target height
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    group.scale.setScalar(1);
    group.position.set(0, 0, 0);
    group.updateWorldMatrix(true, true);

    const bounds = new Box3();
    const point = new Vector3();

    actor.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const positions = child.geometry.getAttribute("position");
      if (!positions) return;
      for (let i = 0; i < positions.count; i++) {
        point.set(positions.getX(i), positions.getY(i), positions.getZ(i));
        point.applyMatrix4(child.matrixWorld);
        bounds.expandByPoint(point);
      }
    });

    if (bounds.isEmpty()) return;
    const size = new Vector3();
    bounds.getSize(size);
    if (size.y <= Number.EPSILON) return;

    const scale = targetHeight / size.y;
    group.scale.setScalar(scale);
    group.position.y = -bounds.min.y * scale;
  }, [actor, targetHeight]);

  // Animation
  useEffect(() => {
    if (!animation || animations.length === 0) return;

    const mixer = new AnimationMixer(actor);
    mixerRef.current = mixer;

    const names = Array.isArray(animation) ? animation : [animation];
    let onFinished: (() => void) | null = null;

    if (names.length === 1) {
      const clip = animations.find((a) => a.name === names[0]);
      if (clip) {
        const action = mixer.clipAction(clip);
        action.play();
        prevActionRef.current = action;
      }
    } else {
      let idx = 0;
      const playAt = (i: number) => {
        const clip = animations.find((a) => a.name === names[i]);
        if (!clip) return;
        const action = mixer.clipAction(clip);
        action.reset();
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = false;
        if (prevActionRef.current && prevActionRef.current !== action) {
          action.crossFadeFrom(prevActionRef.current, 0.25, true);
        }
        action.play();
        prevActionRef.current = action;
      };
      onFinished = () => {
        idx = (idx + 1) % names.length;
        playAt(idx);
      };
      mixer.addEventListener("finished", onFinished);
      playAt(0);
    }

    return () => {
      if (onFinished) mixer.removeEventListener("finished", onFinished);
      mixer.stopAllAction();
      prevActionRef.current = null;
      mixerRef.current = null;
    };
  }, [actor, animations, animation]);

  // Roaming + mixer update
  const roamState = useRef({ tx: 0, tz: 0, cx: 0, cz: 0, targetRot: 0 });

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);

    if (!roam || !groupRef.current) return;
    const st = roamState.current;
    const RADIUS = 0.5;
    const SPEED = 0.35;
    const ROT_SPEED = 8;
    const dx = st.tx - st.cx;
    const dz = st.tz - st.cz;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.05) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * RADIUS;
      st.tx = Math.cos(a) * r;
      st.tz = Math.sin(a) * r;
    } else {
      const step = Math.min(SPEED * delta, dist);
      st.cx += (dx / dist) * step;
      st.cz += (dz / dist) * step;
      st.targetRot = Math.atan2(dx, dz);
    }

    let diff = st.targetRot - actor.rotation.y;
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    actor.rotation.y += diff * MathUtils.clamp(ROT_SPEED * delta, 0, 1);

    const s = groupRef.current.scale.x;
    if (s > 0) {
      actor.position.x = st.cx / s;
      actor.position.z = st.cz / s;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={actor} />
    </group>
  );
}

for (const path of Object.values(CHARACTER_MODELS)) {
  useGLTF.preload(path);
}
