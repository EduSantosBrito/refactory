import type { AssetId } from "@refactory/contracts/worlds";
import { useFrame, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import {
  Color,
  MathUtils,
  Plane,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { useAudioSettings } from "../audio-settings";
import { getCharacterAssetMeta } from "../characterAssets";
import { Character } from "../models/Character";
import { WORLD_RADIUS } from "./constants";
import { type SpatialHash, slideMovementSpatial } from "./collision";
import { surfaceHeightAt } from "./surface";
import { isInWater } from "./water";

const MOVE_SPEED = 5;
const ARRIVE_THRESHOLD = 0.15;
const CAMERA_BASE_HEIGHT = 18;
const CAMERA_BASE_DISTANCE = 14;
const CAMERA_LERP = 4;
const CAMERA_HEIGHT_TRACK = 0.35;
const ZOOM_MIN = 0.45;
const ZOOM_MAX = 2.2;
const ZOOM_STEP = 0.08;
const ROTATION_SPEED = 12;
const MARKER_DURATION = 0.55;
const MARKER_COLOR_VALID = new Color(0x40d850);
const MARKER_COLOR_INVALID = new Color(0xe84848);
const PLAYER_RADIUS = 0.3;
const MOVEMENT_EPSILON = 0.001;
const WALK_LOOP_SOUND_PATH = "/kits/sounds/walking_loop.ogg";
const WALK_LOOP_VOLUME = 0.03;
const WALK_LOOP_FADE_IN_SPEED = 6;
const WALK_LOOP_FADE_OUT_SPEED = 18;
const RUN_ANIMATION_SPEED = 0.78;
const TERRAIN_NORMAL_SAMPLE = 0.35;
const TERRAIN_TILT_LERP = 10;
const TERRAIN_STEP_SAMPLE = 0.45;
const PLAYER_USERNAME = "Brito";

const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
const raycaster = new Raycaster();
const intersectPoint = new Vector3();
const terrainUp = new Vector3(0, 1, 0);
const terrainNormal = new Vector3();
const localTerrainNormal = new Vector3();
const yawQuaternion = new Quaternion();
const yawQuaternionInverse = new Quaternion();
const terrainTiltQuaternion = new Quaternion();

function sampleTerrainNormal(x: number, z: number, target: Vector3): Vector3 {
  const left = surfaceHeightAt(x - TERRAIN_NORMAL_SAMPLE, z);
  const right = surfaceHeightAt(x + TERRAIN_NORMAL_SAMPLE, z);
  const back = surfaceHeightAt(x, z - TERRAIN_NORMAL_SAMPLE);
  const front = surfaceHeightAt(x, z + TERRAIN_NORMAL_SAMPLE);

  return target
    .set(left - right, TERRAIN_NORMAL_SAMPLE * 2, back - front)
    .normalize();
}

function horizontalStepForSurfaceDistance(
  x: number,
  z: number,
  dirX: number,
  dirZ: number,
  surfaceDistance: number,
  remainingDistance: number,
): number {
  const sampleDistance = Math.min(TERRAIN_STEP_SAMPLE, remainingDistance);
  if (sampleDistance <= MOVEMENT_EPSILON) return 0;

  const currentY = surfaceHeightAt(x, z);
  const sampleY = surfaceHeightAt(
    x + dirX * sampleDistance,
    z + dirZ * sampleDistance,
  );
  const slope = (sampleY - currentY) / sampleDistance;
  const horizontalDistance = surfaceDistance / Math.hypot(1, slope);

  return Math.min(horizontalDistance, remainingDistance);
}

export function PlayerController({
  assetId,
  enabled = true,
  playerPosRef,
  spatialHashRef,
}: {
  assetId: AssetId;
  enabled?: boolean;
  playerPosRef: { current: Vector3 };
  spatialHashRef: { readonly current: SpatialHash };
}) {
  const { getChannelVolume } = useAudioSettings();
  const { camera, gl } = useThree();
  const groupRef = useRef<Group>(null);
  const tiltGroupRef = useRef<Group>(null);
  const targetPos = useRef(new Vector3(0, 0, 0));
  const movingRef = useRef(false);
  const [animation, setAnimation] = useState<string>("Idle");
  const walkLoopAudioRef = useRef<HTMLAudioElement | null>(null);
  const wavingRef = useRef(false);
  const handleWaveComplete = useCallback(() => {
    wavingRef.current = false;
    setAnimation("Idle");
  }, []);
  const [chatBubble, setChatBubble] = useState<string | null>(null);
  const chatBubbleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const animationSpeed = animation === "Run" ? RUN_ANIMATION_SPEED : 1;
  const walkLoopVolume = WALK_LOOP_VOLUME * getChannelVolume("soundEffects");
  const characterAsset = getCharacterAssetMeta(assetId);

  /* ── Camera state ──────────────────────────────────────── */
  const zoom = useRef(1);
  const cameraSmooth = useRef(new Vector3(0, 0, 0));
  const hasInitializedCameraRef = useRef(false);

  /* ── Click marker ──────────────────────────────────────── */
  const markerMeshRef = useRef<Mesh>(null);
  const markerMatRef = useRef<MeshBasicMaterial>(null);
  const markerData = useRef({
    active: false,
    x: 0,
    z: 0,
    valid: true,
    elapsed: 0,
  });

  /* ── Right-click to move ───────────────────────────────── */
  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (e.button !== 2) return;

      // Adjust ground plane to player height for better click accuracy on hills
      groundPlane.constant = -playerPosRef.current.y;

      const rect = gl.domElement.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera);
      if (raycaster.ray.intersectPlane(groundPlane, intersectPoint)) {
        const tx = intersectPoint.x;
        const tz = intersectPoint.z;
        const valid =
          !isInWater(tx, tz) && Math.sqrt(tx * tx + tz * tz) < WORLD_RADIUS;

        markerData.current = { active: true, x: tx, z: tz, valid, elapsed: 0 };

        if (valid) {
          targetPos.current.set(tx, surfaceHeightAt(tx, tz), tz);
          movingRef.current = true;

          // Cancel wave animation on movement
          if (wavingRef.current) {
            wavingRef.current = false;
          }
        }
      }
    },
    [camera, gl, playerPosRef],
  );

  /* ── Scroll to zoom ────────────────────────────────────── */
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    zoom.current = MathUtils.clamp(
      zoom.current + dir * ZOOM_STEP,
      ZOOM_MIN,
      ZOOM_MAX,
    );
  }, []);

  useEffect(() => {
    const handleWave = () => {
      movingRef.current = false;
      wavingRef.current = true;
      setAnimation("Wave");
    };

    const handleChat = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      setChatBubble(text);
      if (chatBubbleTimeoutRef.current)
        clearTimeout(chatBubbleTimeoutRef.current);
      chatBubbleTimeoutRef.current = setTimeout(() => {
        setChatBubble(null);
        chatBubbleTimeoutRef.current = null;
      }, 4000);
    };

    window.addEventListener("player-wave", handleWave);
    window.addEventListener("player-chat", handleChat);
    return () => {
      window.removeEventListener("player-wave", handleWave);
      window.removeEventListener("player-chat", handleChat);
      if (chatBubbleTimeoutRef.current)
        clearTimeout(chatBubbleTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const audio = new Audio(WALK_LOOP_SOUND_PATH);
    audio.preload = "auto";
    audio.loop = true;
    audio.volume = 0;
    walkLoopAudioRef.current = audio;

    return () => {
      audio.pause();
      audio.currentTime = 0;
      walkLoopAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      movingRef.current = false;
      setAnimation("Idle");
      const walkLoopAudio = walkLoopAudioRef.current;
      if (walkLoopAudio) {
        walkLoopAudio.pause();
        walkLoopAudio.currentTime = 0;
        walkLoopAudio.volume = 0;
      }
      return;
    }

    const canvas = gl.domElement;
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [enabled, gl, handlePointerDown, handleWheel]);

  /* ── Per-frame update ──────────────────────────────────── */
  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const pPos = playerPosRef.current;
    const prevX = pPos.x;
    const prevY = pPos.y;
    const prevZ = pPos.z;

    /* ── Movement ──────────────────────────────────────────── */
    if (enabled && movingRef.current) {
      const dx = targetPos.current.x - pPos.x;
      const dz = targetPos.current.z - pPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < ARRIVE_THRESHOLD) {
        movingRef.current = false;
      } else {
        const nx = dx / dist;
        const nz = dz / dist;
        const step = horizontalStepForSurfaceDistance(
          pPos.x,
          pPos.z,
          nx,
          nz,
          MOVE_SPEED * delta,
          dist,
        );

        let nextX = pPos.x + nx * step;
        let nextZ = pPos.z + nz * step;

        // World boundary
        const distFromCenter = Math.sqrt(nextX * nextX + nextZ * nextZ);
        if (distFromCenter > WORLD_RADIUS) {
          nextX = (nextX / distFromCenter) * WORLD_RADIUS;
          nextZ = (nextZ / distFromCenter) * WORLD_RADIUS;
          movingRef.current = false;
        }

        // Water collision
        if (isInWater(nextX, nextZ)) {
          movingRef.current = false;
        } else {
          // Nature collision — slide along obstacles
          const hash = spatialHashRef.current;
          if (hash) {
            [nextX, nextZ] = slideMovementSpatial(
              pPos.x,
              pPos.z,
              nextX,
              nextZ,
              PLAYER_RADIUS,
              hash,
            );
          }

          pPos.x = nextX;
          pPos.z = nextZ;
        }

        // Rotate toward movement direction
        const targetRot = Math.atan2(nx, nz);
        let diff = targetRot - group.rotation.y;
        if (diff > Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;
        group.rotation.y +=
          diff * MathUtils.clamp(ROTATION_SPEED * delta, 0, 1);
      }
    }

    // Height following — player walks on terrain
    pPos.y = surfaceHeightAt(pPos.x, pPos.z);
    group.position.copy(pPos);

    const movedDistance = Math.hypot(
      pPos.x - prevX,
      pPos.y - prevY,
      pPos.z - prevZ,
    );
    const walkLoopAudio = walkLoopAudioRef.current;
    if (walkLoopAudio) {
      const targetVolume =
        movedDistance > MOVEMENT_EPSILON ? walkLoopVolume : 0;
      const fadeSpeed =
        targetVolume > 0 ? WALK_LOOP_FADE_IN_SPEED : WALK_LOOP_FADE_OUT_SPEED;

      if (targetVolume > 0 && walkLoopAudio.paused) {
        void walkLoopAudio.play().catch(() => undefined);
      }

      walkLoopAudio.volume = MathUtils.lerp(
        walkLoopAudio.volume,
        targetVolume,
        MathUtils.clamp(fadeSpeed * delta, 0, 1),
      );

      if (
        targetVolume === 0 &&
        !walkLoopAudio.paused &&
        walkLoopAudio.volume < 0.001
      ) {
        walkLoopAudio.pause();
        walkLoopAudio.currentTime = 0;
        walkLoopAudio.volume = 0;
      }
    }

    const tiltGroup = tiltGroupRef.current;
    if (tiltGroup) {
      sampleTerrainNormal(pPos.x, pPos.z, terrainNormal);
      yawQuaternion.setFromAxisAngle(terrainUp, group.rotation.y);
      yawQuaternionInverse.copy(yawQuaternion).invert();
      localTerrainNormal
        .copy(terrainNormal)
        .applyQuaternion(yawQuaternionInverse);
      terrainTiltQuaternion.setFromUnitVectors(terrainUp, localTerrainNormal);
      tiltGroup.quaternion.slerp(
        terrainTiltQuaternion,
        MathUtils.clamp(TERRAIN_TILT_LERP * delta, 0, 1),
      );
    }

    // Animation state (skip during wave)
    if (!wavingRef.current) {
      const shouldRun = movingRef.current;
      if (shouldRun && animation !== "Run") setAnimation("Run");
      if (!shouldRun && animation !== "Idle") setAnimation("Idle");
    }

    /* ── Camera follow ─────────────────────────────────────── */
    const z = zoom.current;
    const camH = CAMERA_BASE_HEIGHT * z;
    const camD = CAMERA_BASE_DISTANCE * z;

    const lookX = pPos.x;
    const lookZ = pPos.z;
    const lookY = pPos.y * CAMERA_HEIGHT_TRACK;

    if (!hasInitializedCameraRef.current) {
      hasInitializedCameraRef.current = true;
      cameraSmooth.current.set(lookX, lookY, lookZ);
    } else {
      cameraSmooth.current.x = MathUtils.lerp(
        cameraSmooth.current.x,
        lookX,
        CAMERA_LERP * delta,
      );
      cameraSmooth.current.y = MathUtils.lerp(
        cameraSmooth.current.y,
        lookY,
        CAMERA_LERP * delta,
      );
      cameraSmooth.current.z = MathUtils.lerp(
        cameraSmooth.current.z,
        lookZ,
        CAMERA_LERP * delta,
      );
    }

    camera.position.set(
      cameraSmooth.current.x,
      cameraSmooth.current.y + camH,
      cameraSmooth.current.z + camD,
    );
    camera.lookAt(
      cameraSmooth.current.x,
      cameraSmooth.current.y,
      cameraSmooth.current.z,
    );

    /* ── Click marker animation ────────────────────────────── */
    const md = markerData.current;
    const marker = markerMeshRef.current;
    const markerMat = markerMatRef.current;
    if (marker && markerMat) {
      if (!enabled) {
        marker.visible = false;
        md.active = false;
      } else if (md.active) {
        md.elapsed += delta;
        if (md.elapsed < MARKER_DURATION) {
          marker.visible = true;
          const markerH = surfaceHeightAt(md.x, md.z);
          marker.position.set(md.x, markerH + 0.03, md.z);
          const scaleIn = Math.min(md.elapsed / 0.1, 1);
          marker.scale.setScalar(0.5 + 0.7 * scaleIn);
          markerMat.opacity = 1 - (md.elapsed / MARKER_DURATION) ** 1.5;
          markerMat.color.copy(
            md.valid ? MARKER_COLOR_VALID : MARKER_COLOR_INVALID,
          );
        } else {
          marker.visible = false;
          md.active = false;
        }
      }
    }
  });

  return (
    <>
      <group ref={groupRef}>
        <group ref={tiltGroupRef}>
          <Suspense fallback={null}>
            <Character
              name={characterAsset.characterName}
              animation={animation}
              animationSpeed={animationSpeed}
              targetHeight={0.8}
              label={PLAYER_USERNAME}
              labelColor={characterAsset.tagColor}
              chatBubble={chatBubble}
              onAnimationComplete={
                animation === "Wave" ? handleWaveComplete : undefined
              }
            />
          </Suspense>
        </group>
        {/* Blob shadow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[0.35, 24]} />
          <meshBasicMaterial
            color="#000000"
            transparent
            opacity={0.18}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Click indicator — world space */}
      <mesh ref={markerMeshRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.5, 0.8, 32]} />
        <meshBasicMaterial ref={markerMatRef} transparent depthWrite={false} />
      </mesh>
    </>
  );
}
