import { BELT_TILE } from "./constants";
import type { BeltPort, BuildingPorts } from "./types";

const H = BELT_TILE.height;

/**
 * Port definitions for all building types.
 *
 * Each building declares its input and output ports with local positions
 * and facing directions. The belt system uses these to determine valid
 * snap connections.
 *
 * Convention:
 * - Positions are relative to the building's origin (center of footprint)
 * - Facing indicates which direction the port opens toward (outward normal)
 * - Y position is at belt surface height for alignment
 */

export const MINER_PORTS: BuildingPorts = {
  inputs: [],
  outputs: [
    { id: "out-0", role: "output", facing: "east", position: [0.75, H / 2, 0] },
  ],
};

export const SMELTER_PORTS: BuildingPorts = {
  inputs: [
    { id: "in-0", role: "input", facing: "west", position: [-0.5, H / 2, 0] },
  ],
  outputs: [
    { id: "out-0", role: "output", facing: "east", position: [0.5, H / 2, 0] },
  ],
};

export const PROCESSOR_PORTS: BuildingPorts = {
  inputs: [
    { id: "in-0", role: "input", facing: "west", position: [-0.5, H / 2, 0] },
  ],
  outputs: [
    { id: "out-0", role: "output", facing: "east", position: [0.5, H / 2, 0] },
  ],
};

export const SPLITTER_PORTS: BuildingPorts = {
  inputs: [
    { id: "in-0", role: "input", facing: "west", position: [-0.5, H / 2, 0] },
  ],
  outputs: [
    { id: "out-0", role: "output", facing: "east", position: [0.5, H / 2, 0] },
    {
      id: "out-1",
      role: "output",
      facing: "north",
      position: [0, H / 2, -0.5],
    },
    { id: "out-2", role: "output", facing: "south", position: [0, H / 2, 0.5] },
  ],
};

export const MERGER_PORTS: BuildingPorts = {
  inputs: [
    { id: "in-0", role: "input", facing: "west", position: [-0.5, H / 2, 0] },
    { id: "in-1", role: "input", facing: "north", position: [0, H / 2, -0.5] },
    { id: "in-2", role: "input", facing: "south", position: [0, H / 2, 0.5] },
  ],
  outputs: [
    { id: "out-0", role: "output", facing: "east", position: [0.5, H / 2, 0] },
  ],
};

/**
 * Modular storage — 4 input docks at cardinal directions around an
 * octagonal body. Each port sits at the outer face of its dock bay,
 * where belts connect. Matches the server-side 4-port definition.
 */
export function createStoragePorts(dockCount: number = 4): BuildingPorts {
  const BODY_R = 1.50; // T1_RB (matches ModularStorage.tsx tier 1)
  const SIDES = 8;
  const BODY_APOTHEM = BODY_R * Math.cos(Math.PI / SIDES);
  const DOCK_D = 0.50;
  const DOCK_INSET = 0.02;
  const PORT_R = BODY_APOTHEM + DOCK_D - DOCK_INSET;

  const inputs: BeltPort[] = Array.from({ length: dockCount }, (_, i) => {
    const angle = (i / dockCount) * Math.PI * 2;
    const x = Math.sin(angle) * PORT_R;
    const z = Math.cos(angle) * PORT_R;

    const facing = nearestFacing(angle);

    return {
      id: `in-${i}`,
      role: "input" as const,
      facing,
      position: [x, H / 2, z] as [number, number, number],
    };
  });

  return { inputs, outputs: [] };
}

export const MODULAR_STORAGE_PORTS = createStoragePorts(4);

/** Map an angle (radians, measured from +Z axis clockwise) to nearest cardinal */
function nearestFacing(angle: number): BeltPort["facing"] {
  // Normalize to [0, 2π)
  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (a < Math.PI / 4 || a >= (7 * Math.PI) / 4) return "south";
  if (a < (3 * Math.PI) / 4) return "east";
  if (a < (5 * Math.PI) / 4) return "north";
  return "west";
}
