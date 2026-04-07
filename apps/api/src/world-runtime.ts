import type { ActorContext } from "@refactory/contracts/auth";
import type {
  PlaceBeltRunCommand,
  PlaceBuildingCommand,
  RemoveBeltRunCommand,
  RemoveBuildingCommand,
  SetMachineRecipeCommand,
  TakeFromContainerCommand,
  TransferItemsCommand,
  WorldCommand,
  WorldCommandReceipt,
} from "@refactory/contracts/commands";
import { WorldCommandQueueFullError } from "@refactory/contracts/commands";
import type {
  Facing,
  GridCoordinate,
  RuntimeContainer,
  RuntimeDeliveryQuota,
  RuntimeInventoryBinding,
  RuntimeItemStack,
  RuntimeMapTile,
  RuntimeObservers,
  RuntimePathTile,
  RuntimePlacedObject,
  SlotContainer,
  TypedContainer,
  WorldRuntimeCheckpoint,
  WorldCommandRejectionCode,
  WorldRuntimeChange,
  WorldRuntimeDelta,
  WorldRuntimeMessage,
  WorldRuntimeSnapshot,
} from "@refactory/contracts/runtime";
import { WorldRuntimeUnavailableError } from "@refactory/contracts/runtime";
import type { WorldSnapshot, WorldSpec, WorldVisibility } from "@refactory/contracts/worlds";
import { WorldAccessDeniedError, WorldNotFoundError } from "@refactory/contracts/worlds";
import { Clock, Deferred, Effect, Layer, Option, PubSub, Queue, Ref, ServiceMap, Stream, SubscriptionRef, SynchronizedRef } from "effect";
import {
  findBuildableDefinition,
  findMachineDefinition,
  findMachineRecipe,
  inputAcceptedItemIdsForKind,
  machineStartsWithoutSelectedRecipe,
  MODULAR_STORAGE_PORTS,
  outputAcceptedItemIdsForKind,
  type PortDefinition,
} from "./game-constants.ts";
import { RuntimeCheckpointStore } from "./world-runtime-checkpoints.ts";
import { WorldRepository } from "./worlds.ts";

const commandQueueCapacity = 256;
const checkpointEveryTicks = 50;
const hostInventorySlotCount = 24;
const tickInterval = "100 millis";

type ResourceNodeSpec = {
  readonly buildableId: string;
  readonly minedItemId: string;
  readonly nodeId: string;
  readonly origin: GridCoordinate;
};

const mapWidth = 12;
const mapHeight = 12;
const modularStorageObjectId = "system:modular-storage-object";
const starterBoxAnchor = { x: 6, y: 7 };

const fixedResourceNodes: ReadonlyArray<ResourceNodeSpec> = [
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
];

const fixedStorageOrigin = { x: 9, y: 5 };

const buildMapTiles = (): Array<RuntimeMapTile> =>
  Array.from({ length: mapHeight }, (_, y) =>
    Array.from({ length: mapWidth }, (_, x): RuntimeMapTile => ({
      altitude: x >= 10 && y >= 2 && y <= 9 ? 1 : 0,
      buildable: true,
      coordinate: { x, y },
    }))
  ).flat();

const rotateFacing = (facing: Facing, rotation: Facing): Facing => {
  switch (rotation) {
    case "east":
      return facing;
    case "south":
      switch (facing) {
        case "north":
          return "east";
        case "east":
          return "south";
        case "south":
          return "west";
        case "west":
          return "north";
      }
    case "west":
      switch (facing) {
        case "north":
          return "south";
        case "east":
          return "west";
        case "south":
          return "north";
        case "west":
          return "east";
      }
    case "north":
      switch (facing) {
        case "north":
          return "west";
        case "east":
          return "north";
        case "south":
          return "east";
        case "west":
          return "south";
      }
  }
};

const moveCoordinate = (coordinate: GridCoordinate, facing: Facing): GridCoordinate => {
  switch (facing) {
    case "north":
      return { x: coordinate.x, y: coordinate.y - 1 };
    case "east":
      return { x: coordinate.x + 1, y: coordinate.y };
    case "south":
      return { x: coordinate.x, y: coordinate.y + 1 };
    case "west":
      return { x: coordinate.x - 1, y: coordinate.y };
  }
};

const machineInputContainerId = (objectId: string) => `entity:${objectId}:input`;
const machineOutputContainerId = (objectId: string) => `entity:${objectId}:output`;
const burnerFuelContainerId = (objectId: string) => `entity:${objectId}:fuel`;

const createPlacedBuildable = (
  buildableId: string,
  objectId: string,
  origin: GridCoordinate,
  rotation: Facing,
) => {
  const definition = findBuildableDefinition(buildableId);

  if (definition === undefined) {
    return undefined;
  }

  if (definition.machineKind === undefined) {
    const fuelContainerId = burnerFuelContainerId(objectId);
    return {
      containers: [
        {
          _tag: "TypedContainer" as const,
          acceptedItemIds: [...definition.fuelAcceptedItemIds],
          capacity: 200,
          containerId: fuelContainerId,
          entries: [],
          owner: { kind: "entity" as const, ownerId: objectId, role: "burner_fuel" },
        },
      ],
      machine: undefined,
      object: {
        buildableId: definition.buildableId,
        containerIds: [fuelContainerId],
        fixed: false,
        machineId: undefined,
        objectId,
        origin,
        removable: true,
        rotation,
      },
    };
  }

  const machineDefinition = findMachineDefinition(definition.machineKind);

  if (machineDefinition === undefined) {
    return undefined;
  }

  const initialRecipe = machineDefinition.defaultRecipeId === undefined
    ? undefined
    : findMachineRecipe(definition.machineKind, machineDefinition.defaultRecipeId);
  const potentialInputAcceptedItemIds = inputAcceptedItemIdsForKind(definition.machineKind);
  const potentialOutputAcceptedItemIds = outputAcceptedItemIdsForKind(definition.machineKind);
  const inputAcceptedItemIds = initialRecipe?.input === undefined ? [] : [initialRecipe.input.itemId];
  const outputAcceptedItemIds = initialRecipe === undefined ? [] : [initialRecipe.output.itemId];

  const inputContainerIds = potentialInputAcceptedItemIds.length === 0 ? [] : [machineInputContainerId(objectId)];
  const outputContainerIds = potentialOutputAcceptedItemIds.length === 0 ? [] : [machineOutputContainerId(objectId)];
  const containers: Array<RuntimeContainer> = [];

  if (inputContainerIds[0] !== undefined) {
    containers.push({
      _tag: "TypedContainer",
      acceptedItemIds: inputAcceptedItemIds,
      capacity: 200,
      containerId: inputContainerIds[0],
      entries: [],
      owner: { kind: "entity", ownerId: objectId, role: "machine_input" },
    });
  }

  if (outputContainerIds[0] !== undefined) {
    containers.push({
      _tag: "TypedContainer",
      acceptedItemIds: outputAcceptedItemIds,
      capacity: 200,
      containerId: outputContainerIds[0],
      entries: [],
      owner: { kind: "entity", ownerId: objectId, role: "machine_output" },
    });
  }

  return {
    containers,
    machine: {
      inputContainerIds,
      kind: definition.machineKind,
      machineId: objectId,
      objectId,
      outputContainerIds,
      powerState: "connected" as const,
      progress: 0,
      recipeId: machineDefinition.defaultRecipeId,
      status: "idle" as const,
    },
    object: {
      buildableId: definition.buildableId,
      containerIds: containers.map((container) => container.containerId),
      fixed: false,
      machineId: objectId,
      objectId,
      origin,
      removable: true,
      rotation,
    },
  };
};

const tileKey = (coordinate: GridCoordinate) => `${coordinate.x}:${coordinate.y}`;

const normalizeRuntimeSnapshot = (snapshot: WorldRuntimeSnapshot): WorldRuntimeSnapshot => ({
  ...snapshot,
  objects: snapshot.objects ?? [],
  runtimeVersion: 2,
  tiles: snapshot.tiles ?? buildMapTiles(),
  transportLanes: snapshot.transportLanes.map((lane) => ({
    ...lane,
    pathTiles: lane.pathTiles ?? [],
  })),
});

const fixedRuntimeObjects = (starterBoxEntityId: string | undefined): Array<RuntimePlacedObject> => {
  const nodes = fixedResourceNodes.map<RuntimePlacedObject>((node) => ({
    buildableId: node.buildableId,
    containerIds: [],
    fixed: true,
    machineId: undefined,
    objectId: node.nodeId,
    origin: node.origin,
    removable: false,
    resourceNodeId: node.nodeId,
    rotation: undefined,
  }));

  const storage: RuntimePlacedObject = {
    buildableId: "modular_storage",
    containerIds: [modularStorageContainerId],
    fixed: true,
    machineId: undefined,
    objectId: modularStorageObjectId,
    origin: fixedStorageOrigin,
    removable: false,
    rotation: undefined,
  };

  if (starterBoxEntityId === undefined) {
    return [...nodes, storage];
  }

  return [
    ...nodes,
    storage,
    {
      buildableId: "starter_box",
      containerIds: [starterBoxContainerId(starterBoxEntityId)],
      fixed: false,
      machineId: undefined,
      objectId: starterBoxEntityId,
      origin: starterBoxAnchor,
      removable: true,
      rotation: "south",
    },
  ];
};

type QueuedWorldCommand = {
  readonly actor: ActorContext;
  readonly command: WorldCommand;
  readonly result: Deferred.Deferred<WorldCommandReceipt>;
};

type LoadedWorldRuntime = {
  readonly commandQueue: Queue.Queue<QueuedWorldCommand>;
  readonly deltas: PubSub.PubSub<WorldRuntimeDelta>;
  readonly liveSnapshot: SubscriptionRef.SubscriptionRef<WorldRuntimeSnapshot>;
  readonly state: Ref.Ref<WorldRuntimeSnapshot>;
  readonly worldId: string;
};

type WorldRuntimeFeed = {
  readonly deltas: Stream.Stream<WorldRuntimeDelta>;
  readonly snapshot: WorldRuntimeSnapshot;
};

type ReadyWorld = {
  readonly hostPublicKey: string;
  readonly snapshot: WorldSnapshot;
  readonly spec: WorldSpec;
  readonly visibility: WorldVisibility;
  readonly worldId: string;
};

type PendingCommandReceipt =
  | {
      readonly _tag: "accepted";
      readonly commandId: string;
    }
  | {
      readonly _tag: "rejected";
      readonly commandId: string;
      readonly message: string;
      readonly reasonCode: WorldCommandRejectionCode;
    };

type CommandApplication = {
  readonly changes: ReadonlyArray<WorldRuntimeChange>;
  readonly pendingReceipt: PendingCommandReceipt;
  readonly snapshot: WorldRuntimeSnapshot;
};

type TickResult = {
  readonly delta: WorldRuntimeDelta | undefined;
  readonly receipts: ReadonlyArray<{
    readonly deferred: Deferred.Deferred<WorldCommandReceipt>;
    readonly receipt: WorldCommandReceipt;
  }>;
  readonly snapshot: WorldRuntimeSnapshot;
};

type TickPhaseState = {
  readonly changes: Array<WorldRuntimeChange>;
  readonly pendingReceipts: Array<{
    readonly deferred: Deferred.Deferred<WorldCommandReceipt>;
    readonly pendingReceipt: PendingCommandReceipt;
  }>;
  readonly snapshot: WorldRuntimeSnapshot;
};

const modularStorageContainerId = "system:modular-storage";

const assetInventoryContainerId = (assetId: string) => `asset:${assetId}:inventory`;

const starterBoxContainerId = (entityId: string) => `entity:${entityId}:starter-box`;

const isSlotContainer = (container: RuntimeContainer): container is SlotContainer => container._tag === "SlotContainer";

const isTypedContainer = (container: RuntimeContainer): container is TypedContainer => container._tag === "TypedContainer";

const isQuotaStorage = (container: RuntimeContainer) =>
  container.owner.kind === "system" && container.owner.role === "quota_storage";

const makeEmptySlots = (slotCount: number): SlotContainer["slots"] =>
  Array.from({ length: slotCount }, (_, slotIndex) => ({ slotIndex }));

const upsertSlotStack = (slots: SlotContainer["slots"], slotIndex: number, stack: RuntimeItemStack | undefined) =>
  slots.map((slot) => (slot.slotIndex === slotIndex ? { slotIndex, stack } : slot));

const toSlotContainer = (options: {
  readonly containerId: string;
  readonly owner: SlotContainer["owner"];
  readonly slotCount: number;
  readonly stacks: ReadonlyArray<{
    readonly itemId: string;
    readonly quantity: number;
    readonly slotIndex: number;
  }>;
}): SlotContainer => {
  let slots = makeEmptySlots(options.slotCount);

  for (const stack of options.stacks) {
    slots = upsertSlotStack(slots, stack.slotIndex, {
      itemId: stack.itemId,
      quantity: stack.quantity,
    });
  }

  return {
    _tag: "SlotContainer",
    containerId: options.containerId,
    owner: options.owner,
    slotCount: options.slotCount,
    slots,
  };
};

const makeInventoryBindings = (snapshot: WorldSnapshot) =>
  snapshot.roster.map<RuntimeInventoryBinding>((slot) => ({
    actorPublicKey: slot.reservedByProfileId,
    assetId: slot.assetId,
    containerId: assetInventoryContainerId(slot.assetId),
  }));

const toRuntimeQuota = (snapshot: WorldSnapshot) =>
  snapshot.progression.deliveryQuota.map<RuntimeDeliveryQuota>((quota) => ({
    delivered: quota.delivered,
    itemId: quota.itemId,
    required: quota.required,
    reserved: quota.delivered,
  }));

const buildInitialRuntimeSnapshot = (world: ReadyWorld): Effect.Effect<WorldRuntimeSnapshot> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const inventoryBindings = makeInventoryBindings(world.snapshot);
    const inventoryContainers = world.snapshot.roster.map<SlotContainer>((slot) =>
      toSlotContainer({
        containerId: assetInventoryContainerId(slot.assetId),
        owner: {
          actorPublicKey: slot.reservedByProfileId,
          kind: "asset",
          ownerId: slot.assetId,
          role: "inventory",
        },
        slotCount: hostInventorySlotCount,
        stacks:
          world.snapshot.onboarding.starterKit.length > 0 && slot.assetId === world.spec.hostAssetId
            ? world.snapshot.onboarding.starterKit.map((item, index) => ({
                itemId: item.itemId,
                quantity: item.quantity,
                slotIndex: index,
              }))
            : [],
      }),
    );
    const starterBox = world.snapshot.onboarding.starterBox;
    const containers: Array<RuntimeContainer> = [...inventoryContainers];

    if (starterBox !== undefined) {
      containers.push(
        toSlotContainer({
          containerId: starterBoxContainerId(starterBox.entityId),
          owner: {
            kind: "entity",
            ownerId: starterBox.entityId,
            role: "starter_box",
          },
          slotCount: starterBox.slotCount,
          stacks: starterBox.inventory,
        }),
      );
    }

    containers.push({
      _tag: "TypedContainer",
      acceptedItemIds: world.snapshot.storage.modularStorage.acceptedItemIds,
      capacity: undefined,
      containerId: modularStorageContainerId,
      entries: world.snapshot.storage.modularStorage.storedItems.map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
      })),
      owner: {
        kind: "system",
        ownerId: modularStorageContainerId,
        role: "quota_storage",
      },
    });

    const observers: RuntimeObservers = {
      bossChat: world.snapshot.bossChat,
      quota: toRuntimeQuota(world.snapshot),
      tutorial: world.snapshot.tutorial,
    };

    const objects = fixedRuntimeObjects(starterBox?.entityId);

    return {
      containers,
      deltaSequence: 0,
      inventories: inventoryBindings,
      lastTickAt: new Date(now).toISOString(),
      machines: [],
      mode: world.spec.mode,
      observers,
      objects,
      runtimeVersion: 2,
      tick: 0,
      tiles: buildMapTiles(),
      transportLanes: [],
      worldId: world.worldId,
    };
  });

const findContainer = (snapshot: WorldRuntimeSnapshot, containerId: string) =>
  snapshot.containers.find((container) => container.containerId === containerId);

const findObject = (snapshot: WorldRuntimeSnapshot, objectId: string) =>
  (snapshot.objects ?? []).find((object) => object.objectId === objectId);

const findMachine = (snapshot: WorldRuntimeSnapshot, machineId: string) =>
  snapshot.machines.find((machine) => machine.machineId === machineId);

const findTile = (snapshot: WorldRuntimeSnapshot, coordinate: GridCoordinate) =>
  (snapshot.tiles ?? []).find((tile) => tile.coordinate.x === coordinate.x && tile.coordinate.y === coordinate.y);

const replaceObject = (snapshot: WorldRuntimeSnapshot, object: RuntimePlacedObject): WorldRuntimeSnapshot => ({
  ...snapshot,
  objects: (snapshot.objects ?? []).map((current) => (current.objectId === object.objectId ? object : current)),
});

const addObject = (snapshot: WorldRuntimeSnapshot, object: RuntimePlacedObject): WorldRuntimeSnapshot => ({
  ...snapshot,
  objects: [...(snapshot.objects ?? []), object],
});

const removeObject = (snapshot: WorldRuntimeSnapshot, objectId: string): WorldRuntimeSnapshot => ({
  ...snapshot,
  objects: (snapshot.objects ?? []).filter((object) => object.objectId !== objectId),
});

const replaceContainer = (snapshot: WorldRuntimeSnapshot, container: RuntimeContainer): WorldRuntimeSnapshot => ({
  ...snapshot,
  containers: snapshot.containers.map((current) =>
    current.containerId === container.containerId ? container : current,
  ),
});

const addContainer = (snapshot: WorldRuntimeSnapshot, container: RuntimeContainer): WorldRuntimeSnapshot => ({
  ...snapshot,
  containers: [...snapshot.containers, container],
});

const removeContainer = (snapshot: WorldRuntimeSnapshot, containerId: string): WorldRuntimeSnapshot => ({
  ...snapshot,
  containers: snapshot.containers.filter((container) => container.containerId !== containerId),
});

const replaceMachine = (snapshot: WorldRuntimeSnapshot, machine: WorldRuntimeSnapshot["machines"][number]): WorldRuntimeSnapshot => ({
  ...snapshot,
  machines: snapshot.machines.map((current) => (current.machineId === machine.machineId ? machine : current)),
});

const addMachine = (snapshot: WorldRuntimeSnapshot, machine: WorldRuntimeSnapshot["machines"][number]): WorldRuntimeSnapshot => ({
  ...snapshot,
  machines: [...snapshot.machines, machine],
});

const removeMachine = (snapshot: WorldRuntimeSnapshot, machineId: string): WorldRuntimeSnapshot => ({
  ...snapshot,
  machines: snapshot.machines.filter((machine) => machine.machineId !== machineId),
});

const replaceTransportLane = (
  snapshot: WorldRuntimeSnapshot,
  lane: WorldRuntimeSnapshot["transportLanes"][number],
): WorldRuntimeSnapshot => ({
  ...snapshot,
  transportLanes: snapshot.transportLanes.map((current) => (current.laneId === lane.laneId ? lane : current)),
});

const addTransportLane = (
  snapshot: WorldRuntimeSnapshot,
  lane: WorldRuntimeSnapshot["transportLanes"][number],
): WorldRuntimeSnapshot => ({
  ...snapshot,
  transportLanes: [...snapshot.transportLanes, lane],
});

const removeTransportLane = (snapshot: WorldRuntimeSnapshot, laneId: string): WorldRuntimeSnapshot => ({
  ...snapshot,
  transportLanes: snapshot.transportLanes.filter((lane) => lane.laneId !== laneId),
});

const peekExtractableItem = (container: RuntimeContainer): RuntimeItemStack | undefined => {
  if (isSlotContainer(container)) {
    const slot = [...container.slots].sort((left, right) => left.slotIndex - right.slotIndex).find((candidate) => candidate.stack !== undefined);
    return slot?.stack;
  }

  return container.entries[0];
};

const takeSingleItemFromContainer = (container: RuntimeContainer):
  | {
      readonly _tag: "rejected";
      readonly message: string;
      readonly reasonCode: WorldCommandRejectionCode;
    }
  | {
      readonly _tag: "taken";
      readonly container: RuntimeContainer;
      readonly moved: RuntimeItemStack;
    } => {
  const stack = peekExtractableItem(container);

  if (stack === undefined) {
    return {
      _tag: "rejected",
      message: `${container.containerId} has no extractable item`,
      reasonCode: "insufficient_items",
    };
  }

  const taken = isSlotContainer(container)
    ? takeFromSlotContainer(container, stack.itemId, 1, undefined)
    : takeFromTypedContainer(container, stack.itemId, 1);

  if (taken._tag === "rejected") {
    return taken;
  }

  return {
    _tag: "taken",
    container: taken.container,
    moved: taken.moved,
  };
};

const resolveActorInventory = (snapshot: WorldRuntimeSnapshot, actor: ActorContext) =>
  snapshot.inventories.find((inventory) => inventory.actorPublicKey === actor.publicKey)?.containerId;

const getActorInventory = (snapshot: WorldRuntimeSnapshot, actor: ActorContext) => {
  const inventoryContainerId = resolveActorInventory(snapshot, actor);

  if (inventoryContainerId === undefined) {
    return undefined;
  }

  const container = findContainer(snapshot, inventoryContainerId);
  return container !== undefined && isSlotContainer(container) ? container : undefined;
};

const placeIntoInventoryOrDestroy = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  stack: RuntimeItemStack,
): {
  readonly changes: ReadonlyArray<WorldRuntimeChange>;
  readonly snapshot: WorldRuntimeSnapshot;
} => {
  const inventory = getActorInventory(snapshot, actor);

  if (inventory === undefined) {
    return { changes: [], snapshot };
  }

  const placed = putIntoSlotContainer(inventory, stack, undefined);

  if (placed._tag === "rejected") {
    return { changes: [], snapshot };
  }

  const nextSnapshot = replaceContainer(snapshot, placed.container);
  return {
    changes: [{ _tag: "ContainerChanged", container: placed.container }],
    snapshot: nextSnapshot,
  };
};

const getPortDefinitions = (object: RuntimePlacedObject): ReadonlyArray<PortDefinition> => {
  if (object.buildableId === "modular_storage") {
    return MODULAR_STORAGE_PORTS;
  }

  const definition = findBuildableDefinition(object.buildableId);

  if (definition === undefined) {
    return [];
  }

  const rotation = object.rotation ?? "east";
  return definition.ports.map((port) => ({
    ...port,
    facing: rotateFacing(port.facing, rotation),
  }));
};

const findPort = (object: RuntimePlacedObject, portId: string) =>
  getPortDefinitions(object).find((port) => port.portId === portId);

const portApproachTile = (object: RuntimePlacedObject, portId: string) => {
  const port = findPort(object, portId);

  if (port === undefined) {
    return undefined;
  }

  return moveCoordinate(object.origin, port.facing);
};

const isObjectTileOccupied = (snapshot: WorldRuntimeSnapshot, coordinate: GridCoordinate, ignoredObjectIds: ReadonlyArray<string>) =>
  (snapshot.objects ?? []).some((object) =>
    !ignoredObjectIds.includes(object.objectId) &&
    object.origin.x === coordinate.x &&
    object.origin.y === coordinate.y
  );

const isBeltTileOccupied = (snapshot: WorldRuntimeSnapshot, coordinate: GridCoordinate) =>
  snapshot.transportLanes.some((lane) =>
    (lane.pathTiles ?? []).some((tile) => tile.x === coordinate.x && tile.y === coordinate.y)
  );

const rejectCommand = (
  snapshot: WorldRuntimeSnapshot,
  commandId: string,
  reasonCode: WorldCommandRejectionCode,
  message: string,
): CommandApplication => ({
  changes: [
    {
      _tag: "CommandProcessed",
      commandId,
      message,
      reasonCode,
      status: "rejected",
    },
  ],
  pendingReceipt: {
    _tag: "rejected",
    commandId,
    message,
    reasonCode,
  },
  snapshot,
});

const acceptCommand = (
  snapshot: WorldRuntimeSnapshot,
  commandId: string,
  changes: ReadonlyArray<WorldRuntimeChange>,
): CommandApplication => ({
  changes: [
    ...changes,
    {
      _tag: "CommandProcessed",
      commandId,
      status: "accepted",
    },
  ],
  pendingReceipt: {
    _tag: "accepted",
    commandId,
  },
  snapshot,
});

const takeFromSlotContainer = (
  container: SlotContainer,
  itemId: string,
  quantity: number,
  fromSlotIndex: number | undefined,
):
  | {
      readonly _tag: "rejected";
      readonly message: string;
      readonly reasonCode: WorldCommandRejectionCode;
    }
  | {
      readonly _tag: "taken";
      readonly container: SlotContainer;
      readonly moved: RuntimeItemStack;
    } => {
  const slot = fromSlotIndex === undefined
    ? container.slots.find((candidate) => candidate.stack?.itemId === itemId && candidate.stack.quantity >= quantity)
    : container.slots.find((candidate) => candidate.slotIndex === fromSlotIndex);

  if (slot === undefined || slot.stack === undefined || slot.stack.itemId !== itemId) {
    return {
      _tag: "rejected",
      message: `Item ${itemId} is not available in ${container.containerId}`,
      reasonCode: "insufficient_items",
    };
  }

  if (slot.stack.quantity < quantity) {
    return {
      _tag: "rejected",
      message: `Item ${itemId} does not have enough quantity in ${container.containerId}`,
      reasonCode: "insufficient_items",
    };
  }

  const remainingQuantity = slot.stack.quantity - quantity;

  return {
    _tag: "taken",
    container: {
      ...container,
      slots: upsertSlotStack(
        container.slots,
        slot.slotIndex,
        remainingQuantity === 0
          ? undefined
          : {
              itemId,
              quantity: remainingQuantity,
            },
      ),
    },
    moved: {
      itemId,
      quantity,
    },
  };
};

const takeFromTypedContainer = (
  container: TypedContainer,
  itemId: string,
  quantity: number,
):
  | {
      readonly _tag: "rejected";
      readonly message: string;
      readonly reasonCode: WorldCommandRejectionCode;
    }
  | {
      readonly _tag: "taken";
      readonly container: TypedContainer;
      readonly moved: RuntimeItemStack;
    } => {
  if (isQuotaStorage(container)) {
    return {
      _tag: "rejected",
      message: `${container.containerId} is input-only in v1`,
      reasonCode: "quota_storage_locked",
    };
  }

  const entry = container.entries.find((candidate) => candidate.itemId === itemId);

  if (entry === undefined || entry.quantity < quantity) {
    return {
      _tag: "rejected",
      message: `Item ${itemId} is not available in ${container.containerId}`,
      reasonCode: "insufficient_items",
    };
  }

  const remainingEntries = entry.quantity === quantity
    ? container.entries.filter((candidate) => candidate.itemId !== itemId)
    : container.entries.map((candidate) =>
        candidate.itemId === itemId
          ? {
              itemId,
              quantity: candidate.quantity - quantity,
            }
          : candidate,
      );

  return {
    _tag: "taken",
    container: {
      ...container,
      entries: remainingEntries,
    },
    moved: {
      itemId,
      quantity,
    },
  };
};

const putIntoSlotContainer = (
  container: SlotContainer,
  stack: RuntimeItemStack,
  toSlotIndex: number | undefined,
):
  | {
      readonly _tag: "rejected";
      readonly message: string;
      readonly reasonCode: WorldCommandRejectionCode;
    }
  | {
      readonly _tag: "placed";
      readonly container: SlotContainer;
    } => {
  const targetSlot = toSlotIndex === undefined
    ? container.slots.find((slot) => slot.stack?.itemId === stack.itemId) ?? container.slots.find((slot) => slot.stack === undefined)
    : container.slots.find((slot) => slot.slotIndex === toSlotIndex);

  if (targetSlot === undefined) {
    return {
      _tag: "rejected",
      message: `${container.containerId} has no free slot for ${stack.itemId}`,
      reasonCode: "container_full",
    };
  }

  if (targetSlot.stack !== undefined && targetSlot.stack.itemId !== stack.itemId) {
    return {
      _tag: "rejected",
      message: `Slot ${targetSlot.slotIndex} in ${container.containerId} is occupied by ${targetSlot.stack.itemId}`,
      reasonCode: "container_full",
    };
  }

  return {
    _tag: "placed",
    container: {
      ...container,
      slots: upsertSlotStack(container.slots, targetSlot.slotIndex, {
        itemId: stack.itemId,
        quantity: (targetSlot.stack?.quantity ?? 0) + stack.quantity,
      }),
    },
  };
};

const putIntoTypedContainer = (
  snapshot: WorldRuntimeSnapshot,
  container: TypedContainer,
  stack: RuntimeItemStack,
):
  | {
      readonly _tag: "rejected";
      readonly message: string;
      readonly reasonCode: WorldCommandRejectionCode;
    }
  | {
      readonly _tag: "placed";
      readonly container: TypedContainer;
      readonly observers: RuntimeObservers;
      readonly observersChanged: boolean;
    } => {
  if (container.acceptedItemIds.length > 0 && !container.acceptedItemIds.includes(stack.itemId)) {
    return {
      _tag: "rejected",
      message: `${container.containerId} does not accept ${stack.itemId}`,
      reasonCode: "item_not_accepted",
    };
  }

  if (isQuotaStorage(container)) {
    const quota = snapshot.observers.quota.find((candidate) => candidate.itemId === stack.itemId);

    if (quota === undefined) {
      return {
        _tag: "rejected",
        message: `${stack.itemId} is not tracked by the current quota`,
        reasonCode: "item_not_accepted",
      };
    }

    const remaining = quota.required - quota.delivered;

    if (remaining < stack.quantity) {
      return {
        _tag: "rejected",
        message: `${container.containerId} only needs ${remaining} more ${stack.itemId}`,
        reasonCode: "item_not_accepted",
      };
    }
  }

  const currentQuantity = container.entries.reduce((total, entry) => total + entry.quantity, 0);

  if (container.capacity !== undefined && currentQuantity + stack.quantity > container.capacity) {
    return {
      _tag: "rejected",
      message: `${container.containerId} is full`,
      reasonCode: "container_full",
    };
  }

  const existingEntry = container.entries.find((entry) => entry.itemId === stack.itemId);
  const nextContainer: TypedContainer = {
    ...container,
    entries:
      existingEntry === undefined
        ? [...container.entries, stack]
        : container.entries.map((entry) =>
            entry.itemId === stack.itemId
              ? {
                  itemId: entry.itemId,
                  quantity: entry.quantity + stack.quantity,
                }
              : entry,
          ),
  };

  const nextObservers = isQuotaStorage(container)
    ? {
        ...snapshot.observers,
        quota: snapshot.observers.quota.map((quota) =>
          quota.itemId === stack.itemId
            ? {
                ...quota,
                delivered: quota.delivered + stack.quantity,
                reserved: quota.reserved + stack.quantity,
              }
            : quota,
        ),
      }
    : snapshot.observers;

  return {
    _tag: "placed",
    container: nextContainer,
    observers: nextObservers,
    observersChanged: nextObservers !== snapshot.observers,
  };
};

const applyTransfer = (snapshot: WorldRuntimeSnapshot, command: TransferItemsCommand): CommandApplication => {
  if (command.fromContainerId === command.toContainerId) {
    return rejectCommand(snapshot, command.commandId, "invalid_command", "Source and target containers must differ");
  }

  const sourceContainer = findContainer(snapshot, command.fromContainerId);
  const targetContainer = findContainer(snapshot, command.toContainerId);

  if (sourceContainer === undefined || targetContainer === undefined) {
    return rejectCommand(snapshot, command.commandId, "container_missing", "Source or target container is missing");
  }

  if (targetContainer.owner.role === "machine_output") {
    return rejectCommand(snapshot, command.commandId, "item_not_accepted", `${targetContainer.containerId} is output-only`);
  }

    if (targetContainer.owner.role === "machine_input") {
      if (!isTypedContainer(targetContainer)) {
        return rejectCommand(snapshot, command.commandId, "invalid_command", `${targetContainer.containerId} is not a typed machine input`);
      }

      const owningObject = findObject(snapshot, targetContainer.owner.ownerId);
      const machine = owningObject?.machineId === undefined ? undefined : findMachine(snapshot, owningObject.machineId);

      if (machine !== undefined && machineStartsWithoutSelectedRecipe(machine.kind) && machine.recipeId === undefined) {
        return rejectCommand(snapshot, command.commandId, "recipe_required", `${machine.machineId} requires a recipe before accepting manual input`);
      }

      if (machine !== undefined) {
        const recipe = findMachineRecipe(machine.kind, machine.recipeId);
        const acceptedManualItemId = recipe?.input?.itemId;

        if (acceptedManualItemId === undefined || acceptedManualItemId !== command.itemId) {
          return rejectCommand(snapshot, command.commandId, "item_not_accepted", `${targetContainer.containerId} does not accept ${command.itemId}`);
        }
      }
    }

  if (targetContainer.owner.role === "burner_fuel" && isTypedContainer(targetContainer)) {
    if (!targetContainer.acceptedItemIds.includes(command.itemId)) {
      return rejectCommand(snapshot, command.commandId, "item_not_accepted", `${targetContainer.containerId} does not accept ${command.itemId}`);
    }
  }

  const taken = isSlotContainer(sourceContainer)
    ? takeFromSlotContainer(sourceContainer, command.itemId, command.quantity, command.fromSlotIndex)
    : takeFromTypedContainer(sourceContainer, command.itemId, command.quantity);

  if (taken._tag === "rejected") {
    return rejectCommand(snapshot, command.commandId, taken.reasonCode, taken.message);
  }

  const withSource = replaceContainer(snapshot, taken.container);
  const changes: Array<WorldRuntimeChange> = [
    {
      _tag: "ContainerChanged",
      container: taken.container,
    },
  ];

  if (isSlotContainer(targetContainer)) {
    const placed = putIntoSlotContainer(targetContainer, taken.moved, command.toSlotIndex);

    if (placed._tag === "rejected") {
      return rejectCommand(snapshot, command.commandId, placed.reasonCode, placed.message);
    }

    changes.push({
      _tag: "ContainerChanged",
      container: placed.container,
    });

    return acceptCommand(replaceContainer(withSource, placed.container), command.commandId, changes);
  }

  const placed = putIntoTypedContainer(snapshot, targetContainer, taken.moved);

  if (placed._tag === "rejected") {
    return rejectCommand(snapshot, command.commandId, placed.reasonCode, placed.message);
  }

  changes.push({
    _tag: "ContainerChanged",
    container: placed.container,
  });

  if (placed.observersChanged) {
    changes.push({
      _tag: "ObserversChanged",
      observers: placed.observers,
    });
  }

  return acceptCommand(
    {
      ...replaceContainer(withSource, placed.container),
      observers: placed.observers,
    },
    command.commandId,
    changes,
  );
};

const applyTakeFromContainer = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: TakeFromContainerCommand,
): CommandApplication => {
  const inventoryContainerId = resolveActorInventory(snapshot, actor);

  if (inventoryContainerId === undefined) {
    return rejectCommand(snapshot, command.commandId, "no_actor_inventory", "Actor has no bound runtime inventory");
  }

  return applyTransfer(snapshot, {
    _tag: "TransferItems",
    commandId: command.commandId,
    fromContainerId: command.fromContainerId,
    fromSlotIndex: command.fromSlotIndex,
    itemId: command.itemId,
    quantity: command.quantity,
    toContainerId: inventoryContainerId,
    toSlotIndex: command.toSlotIndex,
  });
};

const consumeActorInventoryItem = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  commandId: string,
  itemId: string,
  quantity: number,
):
  | {
      readonly _tag: "rejected";
      readonly application: CommandApplication;
    }
  | {
      readonly _tag: "taken";
      readonly changes: ReadonlyArray<WorldRuntimeChange>;
      readonly snapshot: WorldRuntimeSnapshot;
    } => {
  const inventory = getActorInventory(snapshot, actor);

  if (inventory === undefined) {
    return {
      _tag: "rejected",
      application: rejectCommand(snapshot, commandId, "no_actor_inventory", "Actor has no bound runtime inventory"),
    };
  }

  const taken = takeFromSlotContainer(inventory, itemId, quantity, undefined);

  if (taken._tag === "rejected") {
    return {
      _tag: "rejected",
      application: rejectCommand(snapshot, commandId, taken.reasonCode, taken.message),
    };
  }

  return {
    _tag: "taken",
    changes: [{ _tag: "ContainerChanged", container: taken.container }],
    snapshot: replaceContainer(snapshot, taken.container),
  };
};

const toNeighborDirections = (sourceFacing: Facing): ReadonlyArray<Facing> => {
  switch (sourceFacing) {
    case "north":
      return ["north", "east", "west", "south"];
    case "east":
      return ["east", "south", "north", "west"];
    case "south":
      return ["south", "west", "east", "north"];
    case "west":
      return ["west", "north", "south", "east"];
  }
};

const countTurns = (path: ReadonlyArray<GridCoordinate>) => {
  let turns = 0;

  for (let index = 2; index < path.length; index += 1) {
    const previous = path[index - 2];
    const current = path[index - 1];
    const next = path[index];

    if (previous === undefined || current === undefined || next === undefined) {
      continue;
    }

    const firstStepX = current.x - previous.x;
    const firstStepY = current.y - previous.y;
    const secondStepX = next.x - current.x;
    const secondStepY = next.y - current.y;

    if (firstStepX !== secondStepX || firstStepY !== secondStepY) {
      turns += 1;
    }
  }

  return turns;
};

const findBeltPath = (
  snapshot: WorldRuntimeSnapshot,
  sourceObject: RuntimePlacedObject,
  sourcePortId: string,
  destinationObject: RuntimePlacedObject,
  destinationPortId: string,
): Array<RuntimePathTile> | undefined => {
  const sourcePort = findPort(sourceObject, sourcePortId);
  const destinationPort = findPort(destinationObject, destinationPortId);
  const sourceStart = portApproachTile(sourceObject, sourcePortId);
  const destinationEnd = portApproachTile(destinationObject, destinationPortId);

  if (
    sourcePort === undefined ||
    destinationPort === undefined ||
    sourceStart === undefined ||
    destinationEnd === undefined
  ) {
    return undefined;
  }

  const startTile = findTile(snapshot, sourceStart);
  const endTile = findTile(snapshot, destinationEnd);

  if (startTile === undefined || endTile === undefined || !startTile.buildable || !endTile.buildable) {
    return undefined;
  }

  if (
    isObjectTileOccupied(snapshot, sourceStart, [sourceObject.objectId, destinationObject.objectId]) ||
    isObjectTileOccupied(snapshot, destinationEnd, [sourceObject.objectId, destinationObject.objectId]) ||
    isBeltTileOccupied(snapshot, sourceStart) ||
    isBeltTileOccupied(snapshot, destinationEnd)
  ) {
    return undefined;
  }

  const queue: Array<ReadonlyArray<GridCoordinate>> = [[sourceStart]];
  const bestByTile = new Map<string, { readonly length: number; readonly turns: number }>();
  const results: Array<ReadonlyArray<GridCoordinate>> = [];
  const preferredDirections = toNeighborDirections(sourcePort.facing);

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path?.at(-1);

    if (path === undefined || current === undefined) {
      continue;
    }

    if (current.x === destinationEnd.x && current.y === destinationEnd.y) {
      results.push(path);
      continue;
    }

    for (const direction of preferredDirections) {
      const nextCoordinate = moveCoordinate(current, direction);
      const nextTile = findTile(snapshot, nextCoordinate);
      const currentTile = findTile(snapshot, current);

      if (nextTile === undefined || currentTile === undefined || !nextTile.buildable) {
        continue;
      }

      if (Math.abs(nextTile.altitude - currentTile.altitude) > 1) {
        continue;
      }

      if (
        isObjectTileOccupied(snapshot, nextCoordinate, [sourceObject.objectId, destinationObject.objectId]) ||
        isBeltTileOccupied(snapshot, nextCoordinate) ||
        path.some((step) => step.x === nextCoordinate.x && step.y === nextCoordinate.y)
      ) {
        continue;
      }

      const nextPath = [...path, nextCoordinate];
      const score = { length: nextPath.length, turns: countTurns(nextPath) };
      const best = bestByTile.get(tileKey(nextCoordinate));

      if (best !== undefined && (best.length < score.length || (best.length === score.length && best.turns < score.turns))) {
        continue;
      }

      bestByTile.set(tileKey(nextCoordinate), score);
      queue.push(nextPath);
    }
  }

  const sorted = results.sort((left, right) => {
    if (left.length !== right.length) {
      return left.length - right.length;
    }

    const leftTurns = countTurns(left);
    const rightTurns = countTurns(right);

    if (leftTurns !== rightTurns) {
      return leftTurns - rightTurns;
    }

    const leftFirst = left[1];
    const rightFirst = right[1];

    if (leftFirst === undefined || rightFirst === undefined) {
      return left.length - right.length;
    }

    for (const direction of preferredDirections) {
      const preferred = moveCoordinate(sourceStart, direction);
      const leftMatches = leftFirst.x === preferred.x && leftFirst.y === preferred.y;
      const rightMatches = rightFirst.x === preferred.x && rightFirst.y === preferred.y;

      if (leftMatches !== rightMatches) {
        return leftMatches ? -1 : 1;
      }
    }

    return 0;
  });

  const bestPath = sorted[0];

  if (bestPath === undefined) {
    return undefined;
  }

  return bestPath.map((step) => {
    const tile = findTile(snapshot, step);

    if (tile === undefined) {
      return undefined;
    }

    return {
      altitude: tile.altitude,
      x: step.x,
      y: step.y,
    };
  }).filter((step): step is RuntimePathTile => step !== undefined);
};

const applyPlaceBuilding = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: PlaceBuildingCommand,
): CommandApplication => {
  const definition = findBuildableDefinition(command.buildableId);

  if (definition === undefined) {
    return rejectCommand(snapshot, command.commandId, "unsupported_command", `${command.buildableId} is not supported yet`);
  }

  const tile = findTile(snapshot, command.origin);

  if (tile === undefined || !tile.buildable) {
    return rejectCommand(snapshot, command.commandId, "invalid_location", "Target tile is not buildable");
  }

  const occupiedByBlockingObject = (snapshot.objects ?? []).some((object) => {
    if (object.origin.x !== command.origin.x || object.origin.y !== command.origin.y) {
      return false;
    }

    if (command.buildableId === "miner_v1" && object.resourceNodeId !== undefined) {
      return false;
    }

    return true;
  });

  if (occupiedByBlockingObject || isBeltTileOccupied(snapshot, command.origin)) {
    return rejectCommand(snapshot, command.commandId, "invalid_location", "Target tile is already occupied");
  }

  if (command.buildableId === "miner_v1") {
    const node = fixedResourceNodes.find((candidate) => candidate.origin.x === command.origin.x && candidate.origin.y === command.origin.y);

    if (node === undefined) {
      return rejectCommand(snapshot, command.commandId, "invalid_location", "Miner must be placed on a resource node");
    }

    const occupied = (snapshot.objects ?? []).some((object) => object.buildableId === "miner_v1" && object.resourceNodeId === node.nodeId);

    if (occupied) {
      return rejectCommand(snapshot, command.commandId, "invalid_location", "Resource node already has a miner");
    }
  }

  const takenCost = consumeActorInventoryItem(snapshot, actor, command.commandId, definition.buildCostItemId, 1);

  if (takenCost._tag === "rejected") {
    return takenCost.application;
  }

  const objectId = crypto.randomUUID();
  const created = createPlacedBuildable(command.buildableId, objectId, command.origin, command.rotation);

  if (created === undefined) {
    return rejectCommand(snapshot, command.commandId, "unsupported_command", `${command.buildableId} is not supported yet`);
  }

  const object = command.buildableId === "miner_v1"
    ? {
        ...created.object,
        resourceNodeId: fixedResourceNodes.find((node) => node.origin.x === command.origin.x && node.origin.y === command.origin.y)?.nodeId,
      }
    : created.object;

  let nextSnapshot = takenCost.snapshot;
  const changes: Array<WorldRuntimeChange> = [...takenCost.changes];

  for (const container of created.containers) {
    nextSnapshot = addContainer(nextSnapshot, container);
    changes.push({ _tag: "ContainerChanged", container });
  }

  if (created.machine !== undefined) {
    nextSnapshot = addMachine(nextSnapshot, created.machine);
    changes.push({ _tag: "MachineChanged", machine: created.machine });
  }

  nextSnapshot = addObject(nextSnapshot, object);
  changes.push({ _tag: "RuntimeObjectChanged", object });

  return acceptCommand(nextSnapshot, command.commandId, changes);
};

const applyPlaceBeltRun = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: PlaceBeltRunCommand,
): CommandApplication => {
  const sourceObject = findObject(snapshot, command.sourceObjectId);
  const destinationObject = findObject(snapshot, command.destinationObjectId);

  if (sourceObject === undefined || destinationObject === undefined) {
    return rejectCommand(snapshot, command.commandId, "object_missing", "Source or destination object is missing");
  }

  if (sourceObject.objectId === destinationObject.objectId) {
    return rejectCommand(snapshot, command.commandId, "invalid_command", "A belt cannot connect an object to itself");
  }

  const sourcePort = findPort(sourceObject, command.sourcePortId);
  const destinationPort = findPort(destinationObject, command.destinationPortId);

  if (sourcePort === undefined || destinationPort === undefined) {
    return rejectCommand(snapshot, command.commandId, "invalid_target", "Source or destination port is missing");
  }

  if (sourcePort.role !== "output" || destinationPort.role !== "input") {
    return rejectCommand(snapshot, command.commandId, "invalid_target", "Belts must connect one output port to one input port");
  }

  const sourceOccupied = snapshot.transportLanes.some(
    (lane) => lane.sourceObjectId === sourceObject.objectId && lane.sourcePortId === command.sourcePortId,
  );
  const destinationOccupied = snapshot.transportLanes.some(
    (lane) => lane.destinationObjectId === destinationObject.objectId && lane.destinationPortId === command.destinationPortId,
  );

  if (sourceOccupied || destinationOccupied) {
    return rejectCommand(snapshot, command.commandId, "port_occupied", "Source or destination port already has a belt");
  }

  const pathTiles = findBeltPath(snapshot, sourceObject, command.sourcePortId, destinationObject, command.destinationPortId);

  if (pathTiles === undefined || pathTiles.length === 0) {
    return rejectCommand(snapshot, command.commandId, "path_blocked", "No valid belt route exists between the selected ports");
  }

  const takenCost = consumeActorInventoryItem(snapshot, actor, command.commandId, "belt_v1", pathTiles.length);

  if (takenCost._tag === "rejected") {
    return takenCost.application;
  }

  const sourceContainerId = sourceObject.containerIds.find((containerId) => {
    const container = findContainer(snapshot, containerId);
    return container?.owner.role === "machine_output" || container?.owner.role === "container_output";
  });
  const destinationContainerId = destinationObject.containerIds.find((containerId) => {
    const container = findContainer(snapshot, containerId);
    return container?.owner.role === "machine_input" || container?.owner.role === "quota_storage" || container?.owner.role === "container_input";
  }) ?? (destinationObject.buildableId === "modular_storage" ? modularStorageContainerId : undefined);

  const lane: WorldRuntimeSnapshot["transportLanes"][number] = {
    destinationId: destinationContainerId,
    destinationObjectId: destinationObject.objectId,
    destinationPortId: command.destinationPortId,
    itemSpacing: 0.8,
    items: [],
    laneId: crypto.randomUUID(),
    length: pathTiles.length,
    pathTiles,
    sourceId: sourceContainerId,
    sourceObjectId: sourceObject.objectId,
    sourcePortId: command.sourcePortId,
    speed: 0.8,
  };

  const nextSnapshot = addTransportLane(takenCost.snapshot, lane);

  return acceptCommand(nextSnapshot, command.commandId, [...takenCost.changes, { _tag: "TransportLaneChanged", lane }]);
};

const applyRemoveBeltRun = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: RemoveBeltRunCommand,
): CommandApplication => {
  const lane = snapshot.transportLanes.find((candidate) => candidate.laneId === command.beltRunId);

  if (lane === undefined) {
    return rejectCommand(snapshot, command.commandId, "object_missing", "Belt run is missing");
  }

  const refunded = placeIntoInventoryOrDestroy(snapshot, actor, { itemId: "belt_v1", quantity: (lane.pathTiles ?? []).length });
  const nextSnapshot = removeTransportLane(refunded.snapshot, lane.laneId);

  return acceptCommand(nextSnapshot, command.commandId, [...refunded.changes, { _tag: "TransportLaneRemoved", laneId: lane.laneId }]);
};

const applyRemoveBuilding = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: RemoveBuildingCommand,
): CommandApplication => {
  const object = findObject(snapshot, command.objectId);

  if (object === undefined) {
    return rejectCommand(snapshot, command.commandId, "object_missing", "Object is missing");
  }

  if (!object.removable) {
    return rejectCommand(snapshot, command.commandId, "object_not_removable", "Object is not removable");
  }

  let nextSnapshot = snapshot;
  const changes: Array<WorldRuntimeChange> = [];

  for (const lane of snapshot.transportLanes.filter(
    (candidate) => candidate.sourceObjectId === object.objectId || candidate.destinationObjectId === object.objectId,
  )) {
    nextSnapshot = removeTransportLane(nextSnapshot, lane.laneId);
    changes.push({ _tag: "TransportLaneRemoved", laneId: lane.laneId });
    const refund = placeIntoInventoryOrDestroy(nextSnapshot, actor, { itemId: "belt_v1", quantity: (lane.pathTiles ?? []).length });
    nextSnapshot = refund.snapshot;
    changes.push(...refund.changes);
  }

  for (const containerId of object.containerIds) {
    const container = findContainer(nextSnapshot, containerId);

    if (container !== undefined) {
      const stacks = isSlotContainer(container)
        ? container.slots.flatMap((slot) => (slot.stack === undefined ? [] : [slot.stack]))
        : container.entries;

      for (const stack of stacks) {
        const refund = placeIntoInventoryOrDestroy(nextSnapshot, actor, stack);
        nextSnapshot = refund.snapshot;
        changes.push(...refund.changes);
      }

      nextSnapshot = removeContainer(nextSnapshot, containerId);
      changes.push({ _tag: "ContainerRemoved", containerId });
    }
  }

  if (object.machineId !== undefined) {
    nextSnapshot = removeMachine(nextSnapshot, object.machineId);
    changes.push({ _tag: "MachineRemoved", machineId: object.machineId });
  }

  nextSnapshot = removeObject(nextSnapshot, object.objectId);
  changes.push({ _tag: "RuntimeObjectRemoved", objectId: object.objectId });

  const refund = placeIntoInventoryOrDestroy(nextSnapshot, actor, { itemId: object.buildableId, quantity: 1 });
  nextSnapshot = refund.snapshot;
  changes.push(...refund.changes);

  return acceptCommand(nextSnapshot, command.commandId, changes);
};

const updateTypedContainerAcceptedItems = (container: RuntimeContainer, acceptedItemIds: ReadonlyArray<string>) =>
  isTypedContainer(container)
    ? {
        ...container,
        acceptedItemIds: [...acceptedItemIds],
      }
    : container;

const applySetMachineRecipe = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: SetMachineRecipeCommand,
): CommandApplication => {
  const machine = findMachine(snapshot, command.machineId);

  if (machine === undefined) {
    return rejectCommand(snapshot, command.commandId, "object_missing", "Machine is missing");
  }

  const machineDefinition = findMachineDefinition(machine.kind);

  if (machineDefinition === undefined) {
    return rejectCommand(snapshot, command.commandId, "invalid_command", `${machine.kind} has no machine definition`);
  }

  if (machineDefinition.defaultRecipeId !== undefined && machineDefinition.recipes.length <= 1) {
    return rejectCommand(snapshot, command.commandId, "invalid_command", `${machine.kind} does not support recipe switching`);
  }

  const nextRecipe = findMachineRecipe(machine.kind, command.recipeId);

  if (nextRecipe === undefined) {
    return rejectCommand(snapshot, command.commandId, "invalid_command", `Unsupported recipe ${command.recipeId}`);
  }

  const inputContainerId = machine.inputContainerIds[0];
  const outputContainerId = machine.outputContainerIds[0];
  const inputContainer = inputContainerId === undefined ? undefined : findContainer(snapshot, inputContainerId);
  const outputContainer = outputContainerId === undefined ? undefined : findContainer(snapshot, outputContainerId);

  if (inputContainer === undefined || outputContainer === undefined || !isTypedContainer(inputContainer) || !isTypedContainer(outputContainer)) {
    return rejectCommand(snapshot, command.commandId, "container_missing", "Machine buffers are missing");
  }

  let nextSnapshot = snapshot;
  const changes: Array<WorldRuntimeChange> = [];

  for (const entry of inputContainer.entries) {
    if (nextRecipe.input === undefined || entry.itemId !== nextRecipe.input.itemId) {
      const refund = placeIntoInventoryOrDestroy(nextSnapshot, actor, entry);
      nextSnapshot = refund.snapshot;
      changes.push(...refund.changes);
    }
  }

  for (const entry of outputContainer.entries) {
    if (entry.itemId !== nextRecipe.output.itemId) {
      const refund = placeIntoInventoryOrDestroy(nextSnapshot, actor, entry);
      nextSnapshot = refund.snapshot;
      changes.push(...refund.changes);
    }
  }

  const nextInputContainer = updateTypedContainerAcceptedItems(
    {
      ...inputContainer,
      entries: nextRecipe.input === undefined
        ? []
        : inputContainer.entries.filter((entry) => entry.itemId === nextRecipe.input?.itemId),
    },
    nextRecipe.input === undefined ? [] : [nextRecipe.input.itemId],
  );
  const nextOutputContainer = updateTypedContainerAcceptedItems(
    {
      ...outputContainer,
      entries: outputContainer.entries.filter((entry) => entry.itemId === nextRecipe.output.itemId),
    },
    [nextRecipe.output.itemId],
  );
  const nextMachine = {
    ...machine,
    progress: 0,
    recipeId: nextRecipe.recipeId,
    status: "idle" as const,
  };

  nextSnapshot = replaceContainer(nextSnapshot, nextInputContainer);
  nextSnapshot = replaceContainer(nextSnapshot, nextOutputContainer);
  nextSnapshot = replaceMachine(nextSnapshot, nextMachine);
  changes.push({ _tag: "ContainerChanged", container: nextInputContainer });
  changes.push({ _tag: "ContainerChanged", container: nextOutputContainer });
  changes.push({ _tag: "MachineChanged", machine: nextMachine });

  return acceptCommand(nextSnapshot, command.commandId, changes);
};

const applyCommand = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: WorldCommand,
): CommandApplication => {
  switch (command._tag) {
    case "PlaceBuilding":
      return applyPlaceBuilding(snapshot, actor, command);
    case "PlaceBeltRun":
      return applyPlaceBeltRun(snapshot, actor, command);
    case "RemoveBuilding":
      return applyRemoveBuilding(snapshot, actor, command);
    case "RemoveBeltRun":
      return applyRemoveBeltRun(snapshot, actor, command);
    case "SetMachineRecipe":
      return applySetMachineRecipe(snapshot, actor, command);
    case "TransferItems":
      return applyTransfer(snapshot, command);
    case "TakeFromContainer":
      return applyTakeFromContainer(snapshot, actor, command);
    case "AdvanceBossChat":
    case "DeliverQuota":
    case "InsertFuel":
    case "VoteSkipBossChat":
      return rejectCommand(
        snapshot,
        command.commandId,
        "unsupported_command",
        `${command._tag} is not implemented yet`,
      );
  }
};

export const applyWorldCommand = applyCommand;

const machineRecipeFor = (machine: WorldRuntimeSnapshot["machines"][number]) =>
  findMachineRecipe(machine.kind, machine.recipeId);

const machineChanged = (
  left: WorldRuntimeSnapshot["machines"][number],
  right: WorldRuntimeSnapshot["machines"][number],
) =>
  left.status !== right.status ||
  left.powerState !== right.powerState ||
  left.progress !== right.progress ||
  left.recipeId !== right.recipeId;

export const progressMachineWork = (snapshot: WorldRuntimeSnapshot): {
  readonly changes: ReadonlyArray<WorldRuntimeChange>;
  readonly snapshot: WorldRuntimeSnapshot;
} => {
  let nextSnapshot = snapshot;
  const changes: Array<WorldRuntimeChange> = [];

  for (const machine of snapshot.machines) {
    const recipe = machineRecipeFor(machine);

    if (recipe === undefined) {
      if (machine.status !== "idle" || machine.progress !== 0) {
        const nextMachine = {
          ...machine,
          progress: 0,
          status: machine.powerState === "connected" ? ("idle" as const) : ("unpowered" as const),
        };
        nextSnapshot = replaceMachine(nextSnapshot, nextMachine);
        changes.push({ _tag: "MachineChanged", machine: nextMachine });
      }

      continue;
    }

    let nextMachine = machine;

    if (machine.powerState !== "connected") {
      nextMachine = {
        ...machine,
        status: "unpowered",
      };

      if (machineChanged(machine, nextMachine)) {
        nextSnapshot = replaceMachine(nextSnapshot, nextMachine);
        changes.push({ _tag: "MachineChanged", machine: nextMachine });
      }

      continue;
    }

    if (recipe.input !== undefined && machine.progress === 0) {
      const inputContainerId = machine.inputContainerIds[0];
      const inputContainer = inputContainerId === undefined ? undefined : findContainer(nextSnapshot, inputContainerId);

      if (inputContainer === undefined) {
        nextMachine = {
          ...machine,
          status: "idle",
        };
      } else {
        const taken = isSlotContainer(inputContainer)
          ? takeFromSlotContainer(inputContainer, recipe.input.itemId, recipe.input.quantity, undefined)
          : takeFromTypedContainer(inputContainer, recipe.input.itemId, recipe.input.quantity);

        if (taken._tag === "rejected") {
          nextMachine = {
            ...machine,
            status: "idle",
          };
        } else {
          nextSnapshot = replaceContainer(nextSnapshot, taken.container);
          changes.push({ _tag: "ContainerChanged", container: taken.container });
          nextMachine = {
            ...machine,
            progress: machine.progress + recipe.cycleProgressPerTick,
            status: "running",
          };
        }
      }
    } else {
      nextMachine = {
        ...machine,
        progress: machine.progress + recipe.cycleProgressPerTick,
        status: "running",
      };
    }

    if (nextMachine.progress >= 1) {
      const outputContainerId = nextMachine.outputContainerIds[0];
      const outputContainer = outputContainerId === undefined ? undefined : findContainer(nextSnapshot, outputContainerId);

      if (outputContainer === undefined) {
        nextMachine = {
          ...nextMachine,
          progress: 1,
          status: "blocked",
        };
      } else {
        const placed = isSlotContainer(outputContainer)
          ? putIntoSlotContainer(outputContainer, recipe.output, undefined)
          : putIntoTypedContainer(nextSnapshot, outputContainer, recipe.output);

        if (placed._tag === "rejected") {
          nextMachine = {
            ...nextMachine,
            progress: 1,
            status: "blocked",
          };
        } else {
          nextSnapshot = replaceContainer(nextSnapshot, placed.container);
          changes.push({ _tag: "ContainerChanged", container: placed.container });

          if ("observersChanged" in placed && placed.observersChanged) {
            nextSnapshot = {
              ...nextSnapshot,
              observers: placed.observers,
            };
            changes.push({ _tag: "ObserversChanged", observers: placed.observers });
          }

          nextMachine = {
            ...nextMachine,
            progress: Math.max(0, nextMachine.progress - 1),
            status: "running",
          };
        }
      }
    }

    if (machineChanged(machine, nextMachine)) {
      nextSnapshot = replaceMachine(nextSnapshot, nextMachine);
      changes.push({ _tag: "MachineChanged", machine: nextMachine });
    }
  }

  return {
    changes,
    snapshot: nextSnapshot,
  };
};

const sortLaneItems = (items: WorldRuntimeSnapshot["transportLanes"][number]["items"]) =>
  [...items].sort((left, right) => right.progress - left.progress);

const laneProgressStep = (lane: WorldRuntimeSnapshot["transportLanes"][number]) =>
  lane.length <= 0 ? lane.speed : lane.speed / lane.length;

const laneDidChange = (
  left: WorldRuntimeSnapshot["transportLanes"][number],
  right: WorldRuntimeSnapshot["transportLanes"][number],
) =>
  left.items.length !== right.items.length ||
  left.items.some((item, index) => {
    const other = right.items[index];
    return other === undefined || other.itemId !== item.itemId || other.progress !== item.progress;
  });

const advanceLaneItems = (lane: WorldRuntimeSnapshot["transportLanes"][number]) => {
  const sortedItems = sortLaneItems(lane.items);
  const progressStep = laneProgressStep(lane);
  let leadProgress = Number.POSITIVE_INFINITY;

  return sortedItems.map((item) => {
    const maxProgress = Number.isFinite(leadProgress) ? Math.max(0, leadProgress - lane.itemSpacing) : 1;
    const progress = Math.min(1, Math.min(item.progress + progressStep, maxProgress));
    leadProgress = progress;
    return {
      ...item,
      progress,
    };
  });
};

export const executeTransport = (snapshot: WorldRuntimeSnapshot): {
  readonly changes: ReadonlyArray<WorldRuntimeChange>;
  readonly snapshot: WorldRuntimeSnapshot;
} => {
  let nextSnapshot = snapshot;
  const changes: Array<WorldRuntimeChange> = [];

  for (const lane of snapshot.transportLanes) {
    let nextLane = {
      ...lane,
      items: advanceLaneItems(lane),
    };

    const destinationContainer = nextLane.destinationId === undefined ? undefined : findContainer(nextSnapshot, nextLane.destinationId);
    const headItem = sortLaneItems(nextLane.items)[0];

    if (destinationContainer !== undefined && headItem !== undefined && headItem.progress >= 1) {
      const placed = isSlotContainer(destinationContainer)
        ? putIntoSlotContainer(destinationContainer, { itemId: headItem.itemId, quantity: 1 }, undefined)
        : putIntoTypedContainer(nextSnapshot, destinationContainer, { itemId: headItem.itemId, quantity: 1 });

      if (placed._tag === "placed") {
        nextSnapshot = replaceContainer(nextSnapshot, placed.container);
        changes.push({ _tag: "ContainerChanged", container: placed.container });

        if ("observersChanged" in placed && placed.observersChanged) {
          nextSnapshot = {
            ...nextSnapshot,
            observers: placed.observers,
          };
          changes.push({ _tag: "ObserversChanged", observers: placed.observers });
        }

        nextLane = {
          ...nextLane,
          items: sortLaneItems(nextLane.items).slice(1),
        };
      }
    }

    const tailProgress = sortLaneItems(nextLane.items).at(-1)?.progress;
    const canPull = tailProgress === undefined || tailProgress >= nextLane.itemSpacing;
    const sourceContainer = nextLane.sourceId === undefined ? undefined : findContainer(nextSnapshot, nextLane.sourceId);

    if (canPull && sourceContainer !== undefined) {
      const taken = takeSingleItemFromContainer(sourceContainer);

      if (taken._tag === "taken") {
        nextSnapshot = replaceContainer(nextSnapshot, taken.container);
        changes.push({ _tag: "ContainerChanged", container: taken.container });
        nextLane = {
          ...nextLane,
          items: sortLaneItems([
            ...nextLane.items,
            {
              itemId: taken.moved.itemId,
              progress: 0,
            },
          ]),
        };
      }
    }

    if (laneDidChange(lane, nextLane)) {
      nextSnapshot = replaceTransportLane(nextSnapshot, nextLane);
      changes.push({ _tag: "TransportLaneChanged", lane: nextLane });
    }
  }

  return {
    changes,
    snapshot: nextSnapshot,
  };
};

const materializeReceipt = (
  worldId: string,
  tick: number,
  deltaSequence: number,
  pendingReceipt: PendingCommandReceipt,
): WorldCommandReceipt => {
  if (pendingReceipt._tag === "accepted") {
    return {
      _tag: "WorldCommandAccepted",
      appliedTick: tick,
      commandId: pendingReceipt.commandId,
      deltaSequence,
      status: "accepted",
      worldId,
    };
  }

  return {
    _tag: "WorldCommandRejected",
    commandId: pendingReceipt.commandId,
    message: pendingReceipt.message,
    reasonCode: pendingReceipt.reasonCode,
    rejectedTick: tick,
    status: "rejected",
    worldId,
  };
};

const shouldCheckpoint = (snapshot: WorldRuntimeSnapshot) => snapshot.tick > 0 && snapshot.tick % checkpointEveryTicks === 0;

const startTickPhase = (snapshot: WorldRuntimeSnapshot, now: number): TickPhaseState => ({
  changes: [],
  pendingReceipts: [],
  snapshot: {
    ...snapshot,
    lastTickAt: new Date(now).toISOString(),
    tick: snapshot.tick + 1,
  },
});

const applyCommandPhase = (state: TickPhaseState, commands: ReadonlyArray<QueuedWorldCommand>): TickPhaseState => {
  let nextState = state;

  for (const queued of commands) {
    const applied = applyCommand(nextState.snapshot, queued.actor, queued.command);
    nextState = {
      changes: [...nextState.changes, ...applied.changes],
      pendingReceipts: [
        ...nextState.pendingReceipts,
        {
          deferred: queued.result,
          pendingReceipt: applied.pendingReceipt,
        },
      ],
      snapshot: applied.snapshot,
    };
  }

  return nextState;
};

const recomputePowerPhase = (state: TickPhaseState): TickPhaseState => state;

const progressMachinesPhase = (state: TickPhaseState): TickPhaseState => {
  const result = progressMachineWork(state.snapshot);
  return {
    ...state,
    changes: [...state.changes, ...result.changes],
    snapshot: result.snapshot,
  };
};

const transportPhase = (state: TickPhaseState): TickPhaseState => {
  const result = executeTransport(state.snapshot);
  return {
    ...state,
    changes: [...state.changes, ...result.changes],
    snapshot: result.snapshot,
  };
};

const storageAcceptancePhase = (state: TickPhaseState): TickPhaseState => state;

const observerUpdatePhase = (state: TickPhaseState): TickPhaseState => state;

const applyTick = (
  currentSnapshot: WorldRuntimeSnapshot,
  commands: ReadonlyArray<QueuedWorldCommand>,
  now: number,
  worldId: string,
): TickResult => {
  const afterCommands = applyCommandPhase(startTickPhase(currentSnapshot, now), commands);
  const afterPower = recomputePowerPhase(afterCommands);
  const afterMachines = progressMachinesPhase(afterPower);
  const afterTransport = transportPhase(afterMachines);
  const afterStorage = storageAcceptancePhase(afterTransport);
  const finalPhaseState = observerUpdatePhase(afterStorage);

  if (finalPhaseState.changes.length === 0) {
    return {
      delta: undefined,
      receipts: [],
      snapshot: finalPhaseState.snapshot,
    };
  }

  const deltaSequence = finalPhaseState.snapshot.deltaSequence + 1;
  const finalSnapshot: WorldRuntimeSnapshot = {
    ...finalPhaseState.snapshot,
    deltaSequence,
  };
  const delta: WorldRuntimeDelta = {
    changes: [
      ...finalPhaseState.changes,
      {
        _tag: "TickAdvanced",
        processedCommandCount: commands.length,
        tick: finalSnapshot.tick,
      },
    ],
    deltaSequence,
    tick: finalSnapshot.tick,
    worldId,
  };

  return {
    delta,
    receipts: finalPhaseState.pendingReceipts.map(({ deferred, pendingReceipt }) => ({
      deferred,
      receipt: materializeReceipt(worldId, finalSnapshot.tick, deltaSequence, pendingReceipt),
    })),
    snapshot: finalSnapshot,
  };
};

const runWorldLoop = Effect.fnUntraced(function*(runtime: LoadedWorldRuntime, checkpoints: RuntimeCheckpointStore["Service"]) {
  while (true) {
    yield* Effect.sleep(tickInterval);
    const now = yield* Clock.currentTimeMillis;
    const commands = yield* Queue.takeAll(runtime.commandQueue);
    const result = yield* Ref.modify(runtime.state, (snapshot) => {
      const next = applyTick(snapshot, commands, now, runtime.worldId);
      return [next, next.snapshot] as const;
    });

    if (result.delta !== undefined) {
      yield* SubscriptionRef.set(runtime.liveSnapshot, result.snapshot);
      yield* PubSub.publish(runtime.deltas, result.delta);
    }

    if (shouldCheckpoint(result.snapshot)) {
      yield* checkpoints.save(result.snapshot, new Date(now).toISOString()).pipe(
        Effect.catchTag("StorageError", (error) =>
          Effect.logWarning(`runtime checkpoint save failed: ${error.operation}`),
        ),
      );
    }

    yield* Effect.forEach(result.receipts, ({ deferred, receipt }) => Deferred.succeed(deferred, receipt), {
      concurrency: 1,
      discard: true,
    });
  }
});

const hasRuntimeMembership = (snapshot: WorldSnapshot, actor: ActorContext) =>
  snapshot.roster.some((slot) => slot.reservedByProfileId === actor.publicKey);

export class WorldRuntimeService extends ServiceMap.Service<
  WorldRuntimeService,
  {
      readonly getWorldRuntime: (
        actor: ActorContext,
        worldId: string,
      ) => Effect.Effect<WorldRuntimeSnapshot, WorldAccessDeniedError | WorldNotFoundError | WorldRuntimeUnavailableError, never>;
      readonly getWorldRuntimeCheckpoint: (
        actor: ActorContext,
        worldId: string,
      ) => Effect.Effect<WorldRuntimeCheckpoint | undefined, WorldAccessDeniedError | WorldNotFoundError, never>;
      readonly openWorldRuntimeFeed: (
        actor: ActorContext,
        worldId: string,
      ) => Effect.Effect<WorldRuntimeFeed, WorldAccessDeniedError | WorldNotFoundError | WorldRuntimeUnavailableError, never>;
      readonly openWorldRuntimeMessageStream: (
        actor: ActorContext,
        worldId: string,
      ) => Effect.Effect<Stream.Stream<WorldRuntimeMessage>, WorldAccessDeniedError | WorldNotFoundError | WorldRuntimeUnavailableError, never>;
      readonly submitWorldCommand: (
        actor: ActorContext,
        worldId: string,
      command: WorldCommand,
    ) => Effect.Effect<
      WorldCommandReceipt,
      WorldAccessDeniedError | WorldCommandQueueFullError | WorldNotFoundError | WorldRuntimeUnavailableError,
      never
    >;
  }
>()("refactory/WorldRuntimeService") {
  static readonly Live = Layer.effect(
    WorldRuntimeService,
    Effect.gen(function* () {
      const checkpoints = yield* RuntimeCheckpointStore;
      const worlds = yield* WorldRepository;
      const registry = yield* SynchronizedRef.make<ReadonlyMap<string, LoadedWorldRuntime>>(
        new Map<string, LoadedWorldRuntime>(),
      );

      const authorizeWorld = Effect.fnUntraced(function*(options: {
        readonly actor: ActorContext;
        readonly requireWrite: boolean;
        readonly worldId: string;
      }) {
        const worldOption = yield* worlds.findById(options.worldId).pipe(
          Effect.catchTag("StorageError", Effect.die),
        );

        if (Option.isNone(worldOption)) {
          return yield* Effect.fail(new WorldNotFoundError({ worldId: options.worldId }));
        }

        const world = worldOption.value;

        const isOwner = world.hostPublicKey === options.actor.publicKey;
        const isMember = world.snapshot === undefined ? false : hasRuntimeMembership(world.snapshot, options.actor);
        const isPublicReadable = world.visibility === "public";

        if (options.requireWrite ? !isOwner && !isMember : !isOwner && !isMember && !isPublicReadable) {
          return yield* Effect.fail(new WorldAccessDeniedError({ worldId: options.worldId }));
        }

        return world;
      });

      const resolveReadyWorld = Effect.fnUntraced(function*(actor: ActorContext, worldId: string, requireWrite: boolean) {
        const world = yield* authorizeWorld({ actor, requireWrite, worldId });

        if (world.snapshot === undefined || world.spec === undefined) {
          return yield* Effect.fail(
            new WorldRuntimeUnavailableError({
              message: "World runtime is not available until the world is ready",
              worldId,
            }),
          );
        }

        const readyWorld: ReadyWorld = {
          hostPublicKey: world.hostPublicKey,
          snapshot: world.snapshot,
          spec: world.spec,
          visibility: world.visibility,
          worldId: world.worldId,
        };

        return readyWorld;
      });

      const ensureRuntime = Effect.fnUntraced(function*(world: ReadyWorld) {
        return yield* SynchronizedRef.modifyEffect(registry, (current) => {
          const existing = current.get(world.worldId);

          if (existing !== undefined) {
            return Effect.succeed([existing, current] as const);
          }

          return Effect.gen(function* () {
            const checkpointOption = yield* checkpoints.loadLatest(world.worldId).pipe(
              Effect.catchTag("StorageError", Effect.die),
            );
            const initialState = yield* Option.match(checkpointOption, {
              onNone: () => buildInitialRuntimeSnapshot(world),
              onSome: (checkpoint: WorldRuntimeCheckpoint) => Effect.succeed(normalizeRuntimeSnapshot(checkpoint.snapshot)),
            });
            const state = yield* Ref.make(initialState);
            const liveSnapshot = yield* SubscriptionRef.make(initialState);
            const commandQueue = yield* Queue.make<QueuedWorldCommand>({
              capacity: commandQueueCapacity,
              strategy: "dropping",
            });
            const deltas = yield* PubSub.bounded<WorldRuntimeDelta>(64);
            const runtime: LoadedWorldRuntime = {
              commandQueue,
              deltas,
              liveSnapshot,
              state,
              worldId: world.worldId,
            };

            yield* Effect.sync(() => {
              Effect.runFork(runWorldLoop(runtime, checkpoints));
            });

            const next = new Map(current);
            next.set(world.worldId, runtime);
            return [runtime, next] as const;
          });
        });
      });

      const getWorldRuntime = Effect.fnUntraced(function*(actor: ActorContext, worldId: string) {
        const world = yield* resolveReadyWorld(actor, worldId, false);
        const runtime = yield* ensureRuntime(world);
        return yield* Ref.get(runtime.state);
      });

      const getWorldRuntimeCheckpoint = Effect.fnUntraced(function*(actor: ActorContext, worldId: string) {
        yield* authorizeWorld({ actor, requireWrite: false, worldId });
        const checkpointOption = yield* checkpoints.loadLatest(worldId).pipe(
          Effect.catchTag("StorageError", Effect.die),
        );

        return Option.getOrUndefined(checkpointOption);
      });

      const openWorldRuntimeFeed = Effect.fnUntraced(function*(actor: ActorContext, worldId: string) {
        const world = yield* resolveReadyWorld(actor, worldId, false);
        const runtime = yield* ensureRuntime(world);

        return {
          deltas: Stream.fromPubSub(runtime.deltas),
          snapshot: yield* SubscriptionRef.get(runtime.liveSnapshot),
        };
      });

      const openWorldRuntimeMessageStream = Effect.fnUntraced(function*(actor: ActorContext, worldId: string) {
        const feed = yield* openWorldRuntimeFeed(actor, worldId);

        return Stream.make({
          _tag: "WorldRuntimeSnapshotMessage",
          snapshot: feed.snapshot,
        }).pipe(
          Stream.concat(
            feed.deltas.pipe(
              Stream.map((delta): WorldRuntimeMessage => ({
                _tag: "WorldRuntimeDeltaMessage",
                delta,
              })),
            ),
          ),
        );
      });

      const submitWorldCommand = Effect.fnUntraced(function*(actor: ActorContext, worldId: string, command: WorldCommand) {
        const world = yield* resolveReadyWorld(actor, worldId, true);
        const runtime = yield* ensureRuntime(world);
        const result = yield* Deferred.make<WorldCommandReceipt>();
        const accepted = yield* Queue.offer(runtime.commandQueue, {
          actor,
          command,
          result,
        });

        if (!accepted) {
          return yield* Effect.fail(
            new WorldCommandQueueFullError({
              message: "World command queue is full",
              worldId,
            }),
          );
        }

        return yield* Deferred.await(result);
      });

      return {
        getWorldRuntime,
        getWorldRuntimeCheckpoint,
        openWorldRuntimeFeed,
        openWorldRuntimeMessageStream,
        submitWorldCommand,
      };
    }),
  );
}
