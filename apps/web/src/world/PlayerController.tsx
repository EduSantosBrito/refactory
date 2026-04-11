import { useFrame, useThree } from "@react-three/fiber";
import type { AssetId } from "@refactory/contracts/worlds";
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
import {
  type PortalParams,
  redirectBackToRef,
  redirectToPortal,
} from "../portal";
import { type SpatialHash, slideMovementSpatial } from "./collision";
import { WORLD_RADIUS } from "./constants";
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
const CAMERA_ROTATION_SPEED = 1.6;
const CAMERA_MOUSE_HOLD_DELAY_MS = 100;
const CAMERA_MOUSE_ROTATION_SPEED = 0.006;
const CAMERA_ROTATE_CURSOR_CLASS = "camera-rotate-mode";
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

/* ── Portal constants ── */
const PORTAL_TRIGGER_RADIUS = 1.5;
const DEFAULT_BACK_PORTAL_XZ = [4, -4] as const;
const DEFAULT_EXIT_PORTAL_XZ = [6, -8] as const;
const backPortalPosition = new Vector3();
const exitPortalPosition = new Vector3();

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function PlayerController({
  assetId,
  backPortalXZ = DEFAULT_BACK_PORTAL_XZ,
  enabled = true,
  exitPortalXZ = DEFAULT_EXIT_PORTAL_XZ,
  hasBackPortal = false,
  portalParams = null,
  playerPosRef,
  spatialHashRef,
  isPortalEntry = false,
}: {
  assetId: AssetId;
  backPortalXZ?: readonly [number, number];
  enabled?: boolean;
  exitPortalXZ?: readonly [number, number];
  hasBackPortal?: boolean;
  portalParams?: PortalParams | null;
  playerPosRef: { current: Vector3 };
  spatialHashRef: { readonly current: SpatialHash };
  isPortalEntry?: boolean;
}) {
  const { getChannelVolume } = useAudioSettings();
  const { camera, events, gl } = useThree();
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
  const portalSessionRef = useRef<PortalParams | null>(portalParams);

  useEffect(() => {
    portalSessionRef.current = portalParams;
  }, [portalParams]);

  /* ── Camera state ──────────────────────────────────────── */
  const zoom = useRef(1);
  const cameraYaw = useRef(0);
  const hasPointerMovedRef = useRef(false);
  const isPointerInsideCanvasRef = useRef(false);
  const cameraRotationKeys = useRef({ left: false, right: false });
  const cameraMouseRotation = useRef<{
    active: boolean;
    clickResetTimeout: ReturnType<typeof setTimeout> | null;
    holdTimeout: ReturnType<typeof setTimeout> | null;
    lastX: number;
    pointerId: number | null;
    suppressNextClick: boolean;
  }>({
    active: false,
    clickResetTimeout: null,
    holdTimeout: null,
    lastX: 0,
    pointerId: null,
    suppressNextClick: false,
  });
  const cameraSmooth = useRef(new Vector3(0, 0, 0));
  const hasInitializedCameraRef = useRef(false);

  /* ── Click marker ──────────────────────────────────────── */
  const markerMeshRef = useRef<Mesh>(null);
  const markerMatRef = useRef<MeshBasicMaterial>(null);
  const isRedirectingRef = useRef(false);
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

  useEffect(() => {
    const resetCameraRotationKeys = () => {
      cameraRotationKeys.current.left = false;
      cameraRotationKeys.current.right = false;
    };

    if (!enabled) {
      resetCameraRotationKeys();
      return;
    }

    const setCameraRotationKey = (event: KeyboardEvent, isDown: boolean) => {
      const isArrowLeft = event.key === "ArrowLeft";
      const isArrowRight = event.key === "ArrowRight";
      if (!isArrowLeft && !isArrowRight) {
        return;
      }

      if (!isDown) {
        if (isArrowLeft) {
          cameraRotationKeys.current.left = false;
        } else {
          cameraRotationKeys.current.right = false;
        }
        event.preventDefault();
        return;
      }

      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      if (isArrowLeft) {
        cameraRotationKeys.current.left = isDown;
        event.preventDefault();
      } else {
        cameraRotationKeys.current.right = isDown;
        event.preventDefault();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      setCameraRotationKey(event, true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      setCameraRotationKey(event, false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", resetCameraRotationKeys);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", resetCameraRotationKeys);
      resetCameraRotationKeys();
    };
  }, [enabled]);

  useEffect(() => {
    const canvas = gl.domElement;

    const handlePointerMove = () => {
      hasPointerMovedRef.current = true;
    };

    const handlePointerEnter = () => {
      isPointerInsideCanvasRef.current = true;
    };

    const handlePointerLeave = () => {
      isPointerInsideCanvasRef.current = false;
      document.body.classList.remove("interactable-hover");
      events.update?.();
    };

    const handleBlur = () => {
      handlePointerLeave();
    };

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerenter", handlePointerEnter);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("blur", handleBlur);

    return () => {
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerenter", handlePointerEnter);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("blur", handleBlur);
    };
  }, [events, gl]);

  useEffect(() => {
    const canvas = gl.domElement;
    const getCursorRoots = () => {
      const appRoot = document.getElementById("app");
      return [document.body, document.documentElement, appRoot].filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      );
    };

    const setCameraRotationCursor = (active: boolean) => {
      if (active) {
        document.body.classList.remove("interactable-hover");
      }

      for (const element of getCursorRoots()) {
        element.classList.toggle(CAMERA_ROTATE_CURSOR_CLASS, active);
      }
    };

    const clearHoldTimeout = () => {
      const state = cameraMouseRotation.current;
      if (state.holdTimeout) {
        clearTimeout(state.holdTimeout);
        state.holdTimeout = null;
      }
    };

    const clearClickResetTimeout = () => {
      const state = cameraMouseRotation.current;
      if (state.clickResetTimeout) {
        clearTimeout(state.clickResetTimeout);
        state.clickResetTimeout = null;
      }
    };

    const scheduleClickSuppressionReset = () => {
      const state = cameraMouseRotation.current;
      clearClickResetTimeout();
      state.clickResetTimeout = setTimeout(() => {
        state.suppressNextClick = false;
        state.clickResetTimeout = null;
      }, 0);
    };

    const resetMouseRotation = (suppressClick: boolean) => {
      const state = cameraMouseRotation.current;
      const active = state.active;
      clearHoldTimeout();
      state.active = false;
      state.pointerId = null;
      setCameraRotationCursor(false);

      if (active || suppressClick) {
        state.suppressNextClick = true;
        scheduleClickSuppressionReset();
      }
    };

    if (!enabled) {
      resetMouseRotation(false);
      return;
    }

    const stopPointerEvent = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const handleMouseRotationPointerDown = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        !event.isPrimary ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      const state = cameraMouseRotation.current;
      resetMouseRotation(false);
      clearClickResetTimeout();
      state.suppressNextClick = false;
      state.pointerId = event.pointerId;
      state.lastX = event.clientX;
      state.holdTimeout = setTimeout(() => {
        if (state.pointerId !== event.pointerId) {
          return;
        }

        state.active = true;
        state.suppressNextClick = true;
        setCameraRotationCursor(true);

        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          // The pointer may already be released by the time the hold delay fires.
        }
      }, CAMERA_MOUSE_HOLD_DELAY_MS);
    };

    const handleMouseRotationPointerMove = (event: PointerEvent) => {
      const state = cameraMouseRotation.current;
      if (state.pointerId !== event.pointerId) {
        return;
      }

      if ((event.buttons & 1) === 0) {
        resetMouseRotation(false);
        return;
      }

      if (!state.active) {
        state.lastX = event.clientX;
        return;
      }

      const deltaX = event.clientX - state.lastX;
      state.lastX = event.clientX;
      cameraYaw.current += deltaX * CAMERA_MOUSE_ROTATION_SPEED;
      stopPointerEvent(event);
    };

    const handleMouseRotationPointerEnd = (event: PointerEvent) => {
      const state = cameraMouseRotation.current;
      if (state.pointerId !== event.pointerId) {
        return;
      }

      const wasActive = state.active;
      resetMouseRotation(wasActive);

      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // The pointer may not have been captured if release happened pre-delay.
      }

      if (wasActive) {
        stopPointerEvent(event);
      }
    };

    const handleMouseRotationClick = (event: MouseEvent) => {
      const state = cameraMouseRotation.current;
      if (!state.suppressNextClick) {
        return;
      }

      state.suppressNextClick = false;
      clearClickResetTimeout();
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const handleBlur = () => {
      resetMouseRotation(false);
    };

    canvas.addEventListener("pointerdown", handleMouseRotationPointerDown);
    canvas.addEventListener(
      "pointermove",
      handleMouseRotationPointerMove,
      true,
    );
    canvas.addEventListener("pointerup", handleMouseRotationPointerEnd, true);
    canvas.addEventListener(
      "pointercancel",
      handleMouseRotationPointerEnd,
      true,
    );
    canvas.addEventListener("click", handleMouseRotationClick, true);
    window.addEventListener("pointermove", handleMouseRotationPointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", handleMouseRotationPointerEnd);
    window.addEventListener("pointercancel", handleMouseRotationPointerEnd);
    window.addEventListener("blur", handleBlur);

    return () => {
      canvas.removeEventListener("pointerdown", handleMouseRotationPointerDown);
      canvas.removeEventListener(
        "pointermove",
        handleMouseRotationPointerMove,
        true,
      );
      canvas.removeEventListener(
        "pointerup",
        handleMouseRotationPointerEnd,
        true,
      );
      canvas.removeEventListener(
        "pointercancel",
        handleMouseRotationPointerEnd,
        true,
      );
      canvas.removeEventListener("click", handleMouseRotationClick, true);
      window.removeEventListener("pointermove", handleMouseRotationPointerMove);
      window.removeEventListener("pointerup", handleMouseRotationPointerEnd);
      window.removeEventListener(
        "pointercancel",
        handleMouseRotationPointerEnd,
      );
      window.removeEventListener("blur", handleBlur);
      resetMouseRotation(false);
      clearClickResetTimeout();
    };
  }, [enabled, gl]);

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

    // Portal proximity check - trigger exit portal redirect
    if (isPortalEntry && !isRedirectingRef.current) {
      const portalSession = portalSessionRef.current;

      if (hasBackPortal) {
        backPortalPosition.set(
          backPortalXZ[0],
          surfaceHeightAt(backPortalXZ[0], backPortalXZ[1]),
          backPortalXZ[1],
        );
        const distToBackPortal = pPos.distanceTo(backPortalPosition);
        if (distToBackPortal < PORTAL_TRIGGER_RADIUS) {
          isRedirectingRef.current = redirectBackToRef(portalSession);
          if (isRedirectingRef.current) {
            return; // Stop processing after redirect
          }
        }
      }

      exitPortalPosition.set(
        exitPortalXZ[0],
        surfaceHeightAt(exitPortalXZ[0], exitPortalXZ[1]),
        exitPortalXZ[1],
      );
      const distToExitPortal = pPos.distanceTo(exitPortalPosition);
      if (distToExitPortal < PORTAL_TRIGGER_RADIUS) {
        isRedirectingRef.current = true;
        redirectToPortal(portalSession);
        return; // Stop processing after redirect
      }
    }

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
    const cameraRotationDirection =
      Number(cameraRotationKeys.current.right) -
      Number(cameraRotationKeys.current.left);
    if (enabled && cameraRotationDirection !== 0) {
      cameraYaw.current +=
        cameraRotationDirection * CAMERA_ROTATION_SPEED * delta;
    }
    const cameraOffsetX = Math.sin(cameraYaw.current) * camD;
    const cameraOffsetZ = Math.cos(cameraYaw.current) * camD;

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
      cameraSmooth.current.x + cameraOffsetX,
      cameraSmooth.current.y + camH,
      cameraSmooth.current.z + cameraOffsetZ,
    );
    camera.lookAt(
      cameraSmooth.current.x,
      cameraSmooth.current.y,
      cameraSmooth.current.z,
    );
    if (hasPointerMovedRef.current && isPointerInsideCanvasRef.current) {
      events.update?.();
    }

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
