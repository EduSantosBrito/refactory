import { BELT_TILE } from "./constants";
import type { BuildingPorts, BeltPort } from "./types";

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
    { id: "out-0", role: "output", facing: "east", position: [0.5, H / 2, 0] },
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
    { id: "out-1", role: "output", facing: "north", position: [0, H / 2, -0.5] },
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
 * Modular storage — 6 input docks arranged around a hexagonal body.
 * Each dock aligns to one hex face. These ports do not map to strict
 * cardinal grid directions due to the hex geometry; the facing values
 * are approximate for snap matching.
 */
export function createStoragePorts(dockCount: number = 6): BuildingPorts {
  const HEX_APOTHEM = 1.05 * Math.cos(Math.PI / 6);
  const DOCK_RADIUS = HEX_APOTHEM + 0.14;

  const inputs: BeltPort[] = Array.from({ length: dockCount }, (_, i) => {
    const angle = (i / dockCount) * Math.PI * 2 + Math.PI / 6;
    const x = Math.sin(angle) * DOCK_RADIUS;
    const z = Math.cos(angle) * DOCK_RADIUS;

    // Snap to nearest cardinal facing
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

export const MODULAR_STORAGE_PORTS = createStoragePorts(6);

/** Map an angle (radians, measured from +Z axis clockwise) to nearest cardinal */
function nearestFacing(angle: number): BeltPort["facing"] {
  // Normalize to [0, 2π)
  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (a < Math.PI / 4 || a >= (7 * Math.PI) / 4) return "south";
  if (a < (3 * Math.PI) / 4) return "east";
  if (a < (5 * Math.PI) / 4) return "north";
  return "west";
}
