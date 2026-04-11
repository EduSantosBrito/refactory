import type {
  Facing,
  GridCoordinate,
  RuntimeMapTile,
  RuntimePlacedObject,
} from "@refactory/contracts/runtime";
import type { WorldSpec } from "@refactory/contracts/worlds";

type ResourceNodeSpec = {
  readonly buildableId: string;
  readonly minedItemId: string;
  readonly nodeId: string;
  readonly origin: GridCoordinate;
};

export type DefaultFixtureSpec = {
  readonly buildableId:
    | "modular_storage"
    | "portal_entry"
    | "portal_exit"
    | "rocket"
    | "wip_sign";
  readonly fixed: true;
  readonly objectId: string;
  readonly origin: GridCoordinate;
  readonly removable: false;
  readonly rotation: Facing;
};

type ValidationZone = {
  readonly coordinates: ReadonlyArray<GridCoordinate>;
  readonly zoneId: string;
  readonly zoneType: "heat" | "water";
};

export type RuntimeMapContract = {
  readonly defaultFixtures: ReadonlyArray<DefaultFixtureSpec>;
  readonly mapId: WorldSpec["mapId"];
  readonly modularStorageAnchor: GridCoordinate;
  readonly resourceNodes: ReadonlyArray<ResourceNodeSpec>;
  readonly starterBoxAnchor: GridCoordinate;
  readonly tiles: ReadonlyArray<RuntimeMapTile>;
  readonly validationZones: ReadonlyArray<ValidationZone>;
};

const mapWidth = 12;
const mapHeight = 12;

const tileKey = (coordinate: GridCoordinate) =>
  `${coordinate.x}:${coordinate.y}`;

const buildTiles = (): Array<RuntimeMapTile> =>
  Array.from({ length: mapHeight }, (_, y) =>
    Array.from(
      { length: mapWidth },
      (_, x): RuntimeMapTile => ({
        altitude: x >= 10 && y >= 2 && y <= 9 ? 1 : 0,
        buildable: true,
        coordinate: { x, y },
      }),
    ),
  ).flat();

const findTile = (
  tiles: ReadonlyArray<RuntimeMapTile>,
  coordinate: GridCoordinate,
) =>
  tiles.find(
    (tile) =>
      tile.coordinate.x === coordinate.x && tile.coordinate.y === coordinate.y,
  );

const isGoodDefaultFixtureTile = ({
  coordinate,
  occupied,
  tiles,
}: {
  readonly coordinate: GridCoordinate;
  readonly occupied: ReadonlySet<string>;
  readonly tiles: ReadonlyArray<RuntimeMapTile>;
}) => {
  const tile = findTile(tiles, coordinate);

  return tile?.buildable === true && !occupied.has(tileKey(coordinate));
};

const nearbyCoordinates = (
  origin: GridCoordinate,
): ReadonlyArray<GridCoordinate> => [
  origin,
  { x: origin.x + 1, y: origin.y },
  { x: origin.x - 1, y: origin.y },
  { x: origin.x, y: origin.y + 1 },
  { x: origin.x, y: origin.y - 1 },
  { x: origin.x + 1, y: origin.y + 1 },
  { x: origin.x - 1, y: origin.y + 1 },
  { x: origin.x + 1, y: origin.y - 1 },
  { x: origin.x - 1, y: origin.y - 1 },
];

const firstGoodDefaultFixtureTile = ({
  occupied,
  preferred,
  tiles,
}: {
  readonly occupied: ReadonlySet<string>;
  readonly preferred: GridCoordinate;
  readonly tiles: ReadonlyArray<RuntimeMapTile>;
}) =>
  nearbyCoordinates(preferred).find((coordinate) =>
    isGoodDefaultFixtureTile({ coordinate, occupied, tiles }),
  ) ?? preferred;

const placeDefaultFixtures = (
  tiles: ReadonlyArray<RuntimeMapTile>,
  resourceNodes: ReadonlyArray<ResourceNodeSpec>,
): ReadonlyArray<DefaultFixtureSpec> => {
  const occupied = new Set(resourceNodes.map((node) => tileKey(node.origin)));
  const place = (
    fixture: Omit<DefaultFixtureSpec, "fixed" | "origin" | "removable"> & {
      readonly preferredOrigin: GridCoordinate;
    },
  ): DefaultFixtureSpec => {
    const origin = firstGoodDefaultFixtureTile({
      occupied,
      preferred: fixture.preferredOrigin,
      tiles,
    });
    occupied.add(tileKey(origin));

    return {
      buildableId: fixture.buildableId,
      fixed: true,
      objectId: fixture.objectId,
      origin,
      removable: false,
      rotation: fixture.rotation,
    };
  };

  return [
    place({
      buildableId: "rocket",
      objectId: "system:rocket",
      preferredOrigin: { x: 6, y: 3 },
      rotation: "south",
    }),
    place({
      buildableId: "portal_entry",
      objectId: "system:portal-entry",
      preferredOrigin: { x: 8, y: 4 },
      rotation: "east",
    }),
    place({
      buildableId: "portal_exit",
      objectId: "system:portal-exit",
      preferredOrigin: { x: 9, y: 2 },
      rotation: "south",
    }),
    place({
      buildableId: "wip_sign",
      objectId: "system:wip-sign",
      preferredOrigin: { x: 4, y: 4 },
      rotation: "east",
    }),
    place({
      buildableId: "modular_storage",
      objectId: "system:modular-storage-object",
      preferredOrigin: { x: 9, y: 5 },
      rotation: "east",
    }),
  ];
};

const resourceNodes = [
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
] satisfies ReadonlyArray<ResourceNodeSpec>;

const tiles = buildTiles();
const defaultFixtures = placeDefaultFixtures(tiles, resourceNodes);
const modularStorageFixture = defaultFixtures.find(
  (fixture) => fixture.buildableId === "modular_storage",
);

const mapFixtureToRuntimeObject = (
  fixture: DefaultFixtureSpec,
  containerIds: ReadonlyArray<string> = [],
): RuntimePlacedObject => ({
  buildableId: fixture.buildableId,
  containerIds: [...containerIds],
  fixed: fixture.fixed,
  machineId: undefined,
  objectId: fixture.objectId,
  origin: fixture.origin,
  removable: fixture.removable,
  rotation: fixture.rotation,
});

export const DefaultFixturePlacement = {
  isGoodTile: isGoodDefaultFixtureTile,
  toRuntimeObject: mapFixtureToRuntimeObject,
} as const;

export const GPY_7: RuntimeMapContract = {
  defaultFixtures,
  mapId: "GPY-7",
  modularStorageAnchor: modularStorageFixture?.origin ?? { x: 9, y: 5 },
  resourceNodes,
  starterBoxAnchor: { x: 6, y: 7 },
  tiles,
  validationZones: [],
};
