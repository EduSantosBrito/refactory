import { B, M } from "./palette";
import type { ModelProps } from "../colors";

/**
 * Container Storage — "The Shipping Container"
 *
 * Modeled after a real intermodal freight container (ISO 668).
 * Corrugated long walls, corner castings, locking bars on the door end.
 * Wide and low — unmistakably a shipping container.
 *
 * FLOW: belt port (side) → internal storage → door access (end)
 *
 * Silhouette: long rectangular box with corner blocks and door bars.
 */

/* ── Dimensions ── */
const CW = 0.72; // container width (long axis, X)
const CD = 0.30; // container depth (short axis, Z)
const CH = 0.30; // container body height
const BASE_H = 0.03; // bottom frame height

const BASE_Y = BASE_H / 2;
const BODY_Y = BASE_H + CH / 2;
const TOP_Y = BASE_H + CH;

/* Corner casting dimensions */
const CC_W = 0.04; // casting width along container edge
const CC_D = 0.04;
const CC_H = CH + 0.008; // slightly taller than body for visual pop

/* Corrugation */
const RIB_COUNT = 7;
const RIB_SPAN = CW - CC_W * 2 - 0.06; // space between corner castings
const RIB_STEP = RIB_SPAN / (RIB_COUNT + 1);

export function ContainerStorage(props: ModelProps) {
  return (
    <group {...props}>
      {/* ═══════════════════════════════════════════
          1. BOTTOM FRAME — structural rails
          ═══════════════════════════════════════════ */}
      <group>
        {/* 2× Long bottom rails (X direction) */}
        {[-1, 1].map((side) => (
          <mesh key={`rail-${side}`} position={[0, BASE_Y, side * (CD / 2 - 0.015)]}>
            <boxGeometry args={[CW + 0.01, BASE_H, 0.025]} />
            <meshStandardMaterial color={B.dark} {...M} roughness={0.7} />
          </mesh>
        ))}

        {/* 3× Cross-members */}
        {[-1, 0, 1].map((pos) => (
          <mesh key={`xmember-${pos}`} position={[pos * (CW * 0.35), BASE_Y, 0]}>
            <boxGeometry args={[0.025, BASE_H, CD - 0.02]} />
            <meshStandardMaterial color={B.dark} {...M} roughness={0.7} />
          </mesh>
        ))}

        {/* 4× Forklift pocket openings (darker recesses between cross-members) */}
        {[-1, 1].map((xSide) =>
          [-1, 1].map((zSide) => (
            <mesh
              key={`fork-${xSide}-${zSide}`}
              position={[xSide * (CW * 0.17), BASE_Y - 0.005, zSide * (CD / 2 - 0.015)]}
            >
              <boxGeometry args={[CW * 0.28, BASE_H * 0.6, 0.03]} />
              <meshStandardMaterial color="#1a1a2a" {...M} roughness={0.9} />
            </mesh>
          )),
        )}
      </group>

      {/* ═══════════════════════════════════════════
          2. MAIN BODY — corrugated walls + roof
          ═══════════════════════════════════════════ */}
      <group position={[0, BODY_Y, 0]}>
        {/* Core volume */}
        <mesh>
          <boxGeometry args={[CW, CH, CD]} />
          <meshStandardMaterial color={B.bright} {...M} />
        </mesh>

        {/* ── Corrugation ribs — both long sides (±Z) ── */}
        {[-1, 1].map((side) =>
          Array.from({ length: RIB_COUNT }, (_, i) => {
            const xPos = -RIB_SPAN / 2 + RIB_STEP * (i + 1);
            return (
              <mesh
                key={`rib-${side}-${i}`}
                position={[xPos, 0, side * (CD / 2 + 0.003)]}
              >
                <boxGeometry args={[0.012, CH * 0.88, 0.008]} />
                <meshStandardMaterial color={B.light} {...M} roughness={0.5} />
              </mesh>
            );
          }),
        )}

        {/* ── Top roof panel — slightly inset with drainage ridges ── */}
        <mesh position={[0, CH / 2 + 0.003, 0]}>
          <boxGeometry args={[CW - 0.02, 0.006, CD - 0.02]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
        {/* 3× Drainage ridges on roof */}
        {[-1, 0, 1].map((pos) => (
          <mesh key={`ridge-${pos}`} position={[pos * 0.2, CH / 2 + 0.008, 0]}>
            <boxGeometry args={[0.008, 0.004, CD - 0.05]} />
            <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
          </mesh>
        ))}
      </group>

      {/* ═══════════════════════════════════════════
          3. CORNER CASTINGS — 8 blocks at all corners
          ═══════════════════════════════════════════ */}
      {([[-1, -1], [-1, 1], [1, -1], [1, 1]] as const).map(([sx, sz]) =>
        /* Top and bottom castings for each corner */
        [0, 1].map((top) => {
          const yOff = top === 0 ? -CH / 2 + 0.03 : CH / 2 - 0.03;
          return (
            <mesh
              key={`cc-${sx}-${sz}-${top}`}
              position={[
                sx * (CW / 2 - CC_W / 2 + 0.005),
                BODY_Y + yOff,
                sz * (CD / 2 - CC_D / 2 + 0.005),
              ]}
            >
              <boxGeometry args={[CC_W, 0.06, CC_D]} />
              <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
            </mesh>
          );
        }),
      )}

      {/* Vertical corner posts connecting top/bottom castings */}
      {([[-1, -1], [-1, 1], [1, -1], [1, 1]] as const).map(([sx, sz], i) => (
        <mesh
          key={`cpost-${i}`}
          position={[
            sx * (CW / 2 - 0.01),
            BODY_Y,
            sz * (CD / 2 - 0.01),
          ]}
        >
          <boxGeometry args={[0.02, CC_H, 0.02]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>
      ))}

      {/* ═══════════════════════════════════════════
          4. DOOR END (+X) — double doors with locking bars
          ═══════════════════════════════════════════ */}
      <group position={[CW / 2 + 0.005, BODY_Y, 0]}>
        {/* Door panels — 2 side by side */}
        {[-1, 1].map((side) => (
          <mesh key={`door-${side}`} position={[0, 0, side * (CD * 0.22)]}>
            <boxGeometry args={[0.01, CH * 0.90, CD * 0.40]} />
            <meshStandardMaterial color={B.light} {...M} roughness={0.55} />
          </mesh>
        ))}

        {/* Door gap — center seam */}
        <mesh position={[0.006, 0, 0]}>
          <boxGeometry args={[0.005, CH * 0.88, 0.008]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.7} />
        </mesh>

        {/* 4× Vertical locking bars (2 per door) */}
        {[-1, 1].map((door) =>
          [-1, 1].map((bar) => (
            <mesh
              key={`bar-${door}-${bar}`}
              position={[0.01, 0, door * (CD * 0.22) + bar * (CD * 0.12)]}
            >
              <cylinderGeometry args={[0.006, 0.006, CH * 0.82, 6]} />
              <meshStandardMaterial color={B.mid} {...M} roughness={0.55} />
            </mesh>
          )),
        )}

        {/* 8× Cam locks — at top and bottom of each locking bar */}
        {[-1, 1].map((door) =>
          [-1, 1].map((bar) =>
            [-1, 1].map((end) => (
              <mesh
                key={`cam-${door}-${bar}-${end}`}
                position={[
                  0.018,
                  end * (CH * 0.36),
                  door * (CD * 0.22) + bar * (CD * 0.12),
                ]}
              >
                <boxGeometry args={[0.012, 0.022, 0.018]} />
                <meshStandardMaterial color={B.accent} {...M} roughness={0.5} />
              </mesh>
            )),
          ),
        )}

        {/* Door gasket frame */}
        <mesh position={[0.002, 0, 0]}>
          <boxGeometry args={[0.004, CH * 0.92, CD * 0.88]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.7} />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════════
          5. SOLID END (-X) — plain wall with vent
          ═══════════════════════════════════════════ */}
      <group position={[-CW / 2 - 0.003, BODY_Y, 0]}>
        {/* End plate */}
        <mesh>
          <boxGeometry args={[0.008, CH * 0.90, CD * 0.88]} />
          <meshStandardMaterial color={B.bright} {...M} />
        </mesh>
        {/* Small vent */}
        <mesh position={[-0.005, CH * 0.3, 0]}>
          <boxGeometry args={[0.006, 0.04, 0.08]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.7} />
        </mesh>
        {/* Vent slats */}
        {[-1, 0, 1].map((row) => (
          <mesh key={`vslat-${row}`} position={[-0.008, CH * 0.3 + row * 0.012, 0]}>
            <boxGeometry args={[0.004, 0.005, 0.065]} />
            <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
          </mesh>
        ))}
      </group>

      {/* ═══════════════════════════════════════════
          6. BELT PORT — one long side (+Z) for game conveyor
          ═══════════════════════════════════════════ */}
      <group
        position={[0.08, BODY_Y - 0.02, CD / 2 + 0.008]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        {/* Port frame */}
        <mesh>
          <cylinderGeometry args={[0.048, 0.048, 0.02, 8]} />
          <meshStandardMaterial color={B.dark} {...M} roughness={0.65} />
        </mesh>
        {/* Port opening */}
        <mesh position={[0, 0.006, 0]}>
          <cylinderGeometry args={[0.032, 0.032, 0.012, 8]} />
          <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
        </mesh>
        {/* Accent ring */}
        <mesh position={[0, 0.013, 0]}>
          <torusGeometry args={[0.040, 0.005, 6, 8]} />
          <meshStandardMaterial color={B.accent} {...M} roughness={0.5} />
        </mesh>
      </group>

      {/* ═══════════════════════════════════════════
          7. IDENTIFICATION PLATE — small detail on door
          ═══════════════════════════════════════════ */}
      <mesh position={[CW / 2 + 0.014, BODY_Y - CH * 0.28, CD * 0.15]}>
        <boxGeometry args={[0.004, 0.035, 0.05]} />
        <meshStandardMaterial color={B.mid} {...M} roughness={0.6} />
      </mesh>
    </group>
  );
}
