import { useEffect, useRef, type ComponentRef, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MOUSE, Spherical, TOUCH, Vector3 } from "three";
import { CharacterViewer } from "./scenes/CharacterViewer";

type OrbitControlsRef = ComponentRef<typeof OrbitControls>;

const ROTATION_SPEED = 1.6;
const PAN_SPEED = 14;
const ZOOM_STEP = 1.035;
const MIN_POLAR_EPSILON = 0.0001;
const MIN_DISTANCE = 0.1;
const MAX_DISTANCE = 520;
const SPACE_PAN_CURSOR_CLASS = "space-pan-mode";

const HANDLED_KEYS = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  " ",
  "Shift",
  "+",
  "=",
  "-",
  "_",
  "PageUp",
  "PageDown",
] as const;

type HandledKey = (typeof HANDLED_KEYS)[number];
type KeyState = Record<HandledKey, boolean>;
const handledKeys = new Set<string>(HANDLED_KEYS);

const orbitOffset = new Vector3();
const panOffset = new Vector3();
const lateralAxis = new Vector3();
const verticalAxis = new Vector3();
const forwardAxis = new Vector3();
const orbitSpherical = new Spherical();

const INITIAL_KEY_STATE: KeyState = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false,
  " ": false,
  Shift: false,
  "+": false,
  "=": false,
  "-": false,
  _: false,
  PageUp: false,
  PageDown: false,
};

function isHandledKey(value: string): value is HandledKey {
  return handledKeys.has(value);
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function KeyboardCameraControls({
  controlsRef,
  enabled,
}: {
  readonly controlsRef: RefObject<OrbitControlsRef | null>;
  readonly enabled: boolean;
}) {
  const keyStateRef = useRef<KeyState>({ ...INITIAL_KEY_STATE });
  const spaceHeldRef = useRef(false);

  useEffect(() => {
    const getCursorRoots = () => {
      const appRoot = document.getElementById("app");
      return [document.body, document.documentElement, appRoot].filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      );
    };

    const setSpaceHeld = (nextValue: boolean) => {
      if (spaceHeldRef.current === nextValue) {
        return;
      }

      spaceHeldRef.current = nextValue;
      for (const element of getCursorRoots()) {
        element.classList.toggle(SPACE_PAN_CURSOR_CLASS, nextValue);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.code === "Space" ? " " : event.key;

      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      if (!isHandledKey(key)) {
        return;
      }

      keyStateRef.current[key] = true;
      if (key === " ") {
        setSpaceHeld(true);
      }
      event.preventDefault();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.code === "Space" ? " " : event.key;

      if (!isHandledKey(key)) {
        return;
      }

      keyStateRef.current[key] = false;
      if (key === " ") {
        setSpaceHeld(false);
      }
      event.preventDefault();
    };

    const resetKeys = () => {
      keyStateRef.current = { ...INITIAL_KEY_STATE };
      setSpaceHeld(false);
      const controls = controlsRef.current;
      if (controls) {
        controls.mouseButtons.LEFT = MOUSE.ROTATE;
      }
    };

    if (!enabled) {
      resetKeys();
      return;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", resetKeys);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", resetKeys);
      for (const element of getCursorRoots()) {
        element.classList.remove(SPACE_PAN_CURSOR_CLASS);
      }
    };
  }, [controlsRef, enabled]);

  useFrame((_, delta) => {
    if (!enabled) {
      return;
    }

    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    const keys = keyStateRef.current;
    controls.mouseButtons.LEFT = keys[" "] ? MOUSE.PAN : MOUSE.ROTATE;

    const horizontal = Number(keys.ArrowRight) - Number(keys.ArrowLeft);
    const vertical = Number(keys.ArrowUp) - Number(keys.ArrowDown);
    const zoom =
      Number(keys.PageUp || keys["+"] || keys["="]) - Number(keys.PageDown || keys["-"] || keys._);

    let hasMoved = false;

    if (horizontal !== 0 || vertical !== 0) {
      const camera = controls.object;

      if (keys.Shift) {
        orbitOffset.subVectors(camera.position, controls.target);
        orbitSpherical.setFromVector3(orbitOffset);
        orbitSpherical.theta += horizontal * ROTATION_SPEED * delta;
        orbitSpherical.phi -= vertical * ROTATION_SPEED * delta;
        orbitSpherical.phi = Math.max(
          controls.minPolarAngle + MIN_POLAR_EPSILON,
          Math.min(controls.maxPolarAngle - MIN_POLAR_EPSILON, orbitSpherical.phi),
        );

        orbitOffset.setFromSpherical(orbitSpherical);
        camera.position.copy(controls.target).add(orbitOffset);
      } else {
        forwardAxis.subVectors(controls.target, camera.position).normalize();
        lateralAxis.crossVectors(camera.up, forwardAxis).normalize();
        verticalAxis.crossVectors(forwardAxis, lateralAxis).normalize();

        panOffset
          .copy(lateralAxis)
          .multiplyScalar(horizontal * PAN_SPEED * delta)
          .addScaledVector(verticalAxis, vertical * PAN_SPEED * delta);

        camera.position.add(panOffset);
        controls.target.add(panOffset);
      }

      hasMoved = true;
    }

    if (zoom !== 0) {
      const camera = controls.object;
      const zoomFactor = Math.pow(ZOOM_STEP, delta * 60);

      orbitOffset.subVectors(camera.position, controls.target);
      orbitSpherical.setFromVector3(orbitOffset);
      orbitSpherical.radius = Math.max(
        MIN_DISTANCE,
        Math.min(
          MAX_DISTANCE,
          zoom > 0 ? orbitSpherical.radius / zoomFactor : orbitSpherical.radius * zoomFactor,
        ),
      );

      orbitOffset.setFromSpherical(orbitSpherical);
      camera.position.copy(controls.target).add(orbitOffset);

      hasMoved = true;
    }

    if (hasMoved) {
      controls.update();
    }
  });

  return null;
}

export function Game({ isPaused = false }: { readonly isPaused?: boolean }) {
  const controlsRef = useRef<OrbitControlsRef | null>(null);

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
      <KeyboardCameraControls controlsRef={controlsRef} enabled={!isPaused} />

      <OrbitControls
        ref={(controls) => {
          if (controlsRef.current === controls) {
            return;
          }

          controlsRef.current = controls;
        }}
        makeDefault
        target={[5, 0.5, 8]}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={MIN_DISTANCE}
        maxDistance={MAX_DISTANCE}
        enabled={!isPaused}
        enablePan
        enableDamping
        dampingFactor={0.08}
        mouseButtons={{ LEFT: MOUSE.ROTATE, RIGHT: MOUSE.PAN }}
        touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
      />
    </Canvas>
  );
}
