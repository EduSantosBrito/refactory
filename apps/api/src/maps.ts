import type { GridCoordinate, RuntimeMapTile } from "@refactory/contracts/runtime";
import type { WorldSpec } from "@refactory/contracts/worlds";

type ResourceNodeSpec = {
  readonly buildableId: string;
  readonly minedItemId: string;
  readonly nodeId: string;
  readonly origin: GridCoordinate;
};

type ValidationZone = {
  readonly coordinates: ReadonlyArray<GridCoordinate>;
  readonly zoneId: string;
  readonly zoneType: "heat" | "water";
};

export type RuntimeMapContract = {
  readonly mapId: WorldSpec["mapId"];
  readonly modularStorageAnchor: GridCoordinate;
  readonly resourceNodes: ReadonlyArray<ResourceNodeSpec>;
  readonly starterBoxAnchor: GridCoordinate;
  readonly tiles: ReadonlyArray<RuntimeMapTile>;
  readonly validationZones: ReadonlyArray<ValidationZone>;
};

const mapWidth = 12;
const mapHeight = 12;

const buildTiles = (): Array<RuntimeMapTile> =>
  Array.from({ length: mapHeight }, (_, y) =>
    Array.from({ length: mapWidth }, (_, x): RuntimeMapTile => ({
      altitude: x >= 10 && y >= 2 && y <= 9 ? 1 : 0,
      buildable: true,
      coordinate: { x, y },
    }))
  ).flat();

const GPY_7: RuntimeMapContract = {
  mapId: "GPY-7",
  modularStorageAnchor: { x: 9, y: 5 },
  resourceNodes: [
    {
      buildableId: "iron_node_impure",
      minedItemId: "iron_ore",
      nodeId: "node:iron:1",
      origin: { x: 2, y: 5 },
    },
    {
      buildableId: "iron_node_impure",
      minedItemId: "iron_ore",
      nodeId: "node:iron:2",
      origin: { x: 2, y: 8 },
    },
  ],
  starterBoxAnchor: { x: 6, y: 7 },
  tiles: buildTiles(),
  validationZones: [],
};

export const getRuntimeMapContract = (mapId: WorldSpec["mapId"]) => {
  switch (mapId) {
    case "GPY-7":
      return GPY_7;
  }
};
