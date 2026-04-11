/**
 * WebGPU-enabled Canvas wrapper for React Three Fiber.
 *
 * NOTE: Currently defaults to WebGL because @react-three/postprocessing
 * doesn't support WebGPU yet. Set `preferWebGPU={true}` to opt-in to
 * WebGPU (but post-processing effects won't work).
 *
 * Uses Three.js WebGPU renderer with TSL shader support.
 */
import { Canvas, type CanvasProps } from "@react-three/fiber";
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { WebGPURenderer as WebGPURendererType } from "three/webgpu";

/* ── Context for renderer type detection ───────────────────── */

export const WebGPUContext = createContext<{ isWebGPU: boolean }>({
  isWebGPU: false,
});

export const useIsWebGPU = () => useContext(WebGPUContext).isWebGPU;

/* ── Props ─────────────────────────────────────────────────── */

export interface WebGPUCanvasProps extends Omit<CanvasProps, "gl"> {
  children: ReactNode;
  /**
   * Prefer WebGPU over WebGL when available.
   * NOTE: Post-processing effects don't work with WebGPU yet.
   * @default false
   */
  preferWebGPU?: boolean;
  /** Callback when renderer is ready */
  onRendererReady?: (renderer: WebGPURendererType) => void;
}

export interface WebGPUCanvasRef {
  renderer: WebGPURendererType | null;
  isWebGPU: boolean;
}

/**
 * WebGPU Canvas component with automatic fallback to WebGL.
 *
 * @example
 * ```tsx
 * // Default: Uses WebGL (compatible with post-processing)
 * <WebGPUCanvas camera={{ position: [0, 5, 10] }}>
 *   <mesh>
 *     <boxGeometry />
 *     <meshStandardMaterial color="orange" />
 *   </mesh>
 * </WebGPUCanvas>
 *
 * // Opt-in to WebGPU (no post-processing support)
 * <WebGPUCanvas preferWebGPU camera={{ position: [0, 5, 10] }}>
 *   ...
 * </WebGPUCanvas>
 * ```
 */
export const WebGPUCanvas = forwardRef<WebGPUCanvasRef, WebGPUCanvasProps>(
  function WebGPUCanvas(
    { children, preferWebGPU = false, onRendererReady, ...props },
    ref,
  ) {
    const [isReady, setIsReady] = useState(false);
    const [useWebGPU, setUseWebGPU] = useState(false);
    const rendererRef = useRef<WebGPURendererType | null>(null);

    // Check WebGPU support only if preferred
    useEffect(() => {
      const checkSupport = async () => {
        if (!preferWebGPU) {
          setUseWebGPU(false);
          setIsReady(true);
          return;
        }

        try {
          if (navigator.gpu) {
            const adapter = await navigator.gpu.requestAdapter();
            setUseWebGPU(adapter !== null);
          } else {
            setUseWebGPU(false);
          }
        } catch {
          setUseWebGPU(false);
        }
        setIsReady(true);
      };

      checkSupport();
    }, [preferWebGPU]);

    // Expose renderer via ref
    useImperativeHandle(
      ref,
      () => ({
        renderer: rendererRef.current,
        isWebGPU: useWebGPU,
      }),
      [useWebGPU],
    );

    if (!isReady) {
      return null;
    }

    // WebGPU renderer configuration
    if (useWebGPU) {
      return (
        <WebGPUContext.Provider value={{ isWebGPU: true }}>
          <Canvas
            {...props}
            gl={async (canvas) => {
              // Dynamic import to avoid bundling WebGPU code when not needed
              const { WebGPURenderer } = await import("three/webgpu");

              const renderer = new WebGPURenderer({
                canvas: canvas as unknown as HTMLCanvasElement,
                antialias: true,
                powerPreference: "high-performance",
              });
              rendererRef.current = renderer;

              // Initialize WebGPU
              await renderer.init();
              onRendererReady?.(renderer);

              return renderer;
            }}
            frameloop="always"
          >
            {children}
          </Canvas>
        </WebGPUContext.Provider>
      );
    }

    // Default: Standard WebGL Canvas (compatible with post-processing)
    return (
      <WebGPUContext.Provider value={{ isWebGPU: false }}>
        <Canvas
          {...props}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          {children}
        </Canvas>
      </WebGPUContext.Provider>
    );
  },
);

export default WebGPUCanvas;
