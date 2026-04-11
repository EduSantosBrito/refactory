import type { ActorContext } from "@refactory/contracts/auth";
import type {
  PlaceBeltRunCommand,
  PlaceBuildingCommand,
  RemoveBeltRunCommand,
  RemoveBuildingCommand,
  RestartPowerNetworkCommand,
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
  RuntimeGenerator,
  RuntimeInventoryBinding,
  RuntimeItemStack,
  RuntimeObservers,
  RuntimePathTile,
  RuntimePlacedObject,
  RuntimePowerNetwork,
  SlotContainer,
  TypedContainer,
  WorldCommandRejectionCode,
  WorldRuntimeChange,
  WorldRuntimeCheckpoint,
  WorldRuntimeDelta,
  WorldRuntimeMessage,
  WorldRuntimeSnapshot,
} from "@refactory/contracts/runtime";
import { WorldRuntimeUnavailableError } from "@refactory/contracts/runtime";
import type {
  WorldSnapshot,
  WorldSpec,
  WorldVisibility,
} from "@refactory/contracts/worlds";
import {
  WorldAccessDeniedError,
  WorldNotFoundError,
} from "@refactory/contracts/worlds";
import {
  Clock,
  Deferred,
  Effect,
  Layer,
  Match,
  Option,
  PubSub,
  Queue,
  Ref,
  Scope,
  ServiceMap,
  Stream,
  SubscriptionRef,
  SynchronizedRef,
} from "effect";
import {
  type PersistenceDecodeError,
  RuntimeEngineError,
} from "./backend-errors.ts";
import {
  BUILDABLE_DEFINITIONS,
  MACHINE_DEFINITIONS,
  MODULAR_STORAGE_PORTS,
  type PortDefinition,
} from "./game-constants.ts";
import { DefaultFixturePlacement, GPY_7 } from "./maps.ts";
import type { StorageError } from "./sqlite.ts";
import { RuntimeCheckpointStore } from "./world-runtime-checkpoints.ts";
import { WorldRepository } from "./worlds.ts";

const commandQueueCapacity = 256;
const checkpointEveryTicks = 50;
const hostInventorySlotCount = 24;
const defaultRuntimeMapContract = GPY_7;

const findBuildableDefinition = (buildableId: string) =>
  BUILDABLE_DEFINITIONS.find(
    (definition) => definition.buildableId === buildableId,
  );

const findGeneratorDefinition = (buildableId: string) =>
  findBuildableDefinition(buildableId)?.generator;

const findMachineDefinition = (kind: string) =>
  MACHINE_DEFINITIONS.find((definition) => definition.kind === kind);

const machineStartsWithoutSelectedRecipe = (kind: string) =>
  findMachineDefinition(kind)?.defaultRecipeId === undefined;

const findMachineRecipe = (kind: string, recipeId: string | undefined) =>
  findMachineDefinition(kind)?.recipes.find(
    (recipe) => recipe.recipeId === recipeId,
  );

const unique = (values: ReadonlyArray<string>) =>
  values.filter((value, index) => values.indexOf(value) === index);

const inputAcceptedItemIdsForKind = (kind: string) =>
  unique(
    (findMachineDefinition(kind)?.recipes ?? []).flatMap((recipe) => {
      switch (recipe.input) {
        case undefined:
          return [];
        default:
          return [recipe.input.itemId];
      }
    }),
  );

const outputAcceptedItemIdsForKind = (kind: string) =>
  unique(
    (findMachineDefinition(kind)?.recipes ?? []).map(
      (recipe) => recipe.output.itemId,
    ),
  );

const getRuntimeMapContract = (mapId: WorldSpec["mapId"]) => {
  switch (mapId) {
    case "GPY-7":
      return GPY_7;
  }
};

const rotateFacingSouth = (facing: Facing): Facing => {
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
};

const rotateFacingWest = (facing: Facing): Facing => {
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
};

const rotateFacingNorth = (facing: Facing): Facing => {
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
};

const rotateFacing = (facing: Facing, rotation: Facing): Facing => {
  switch (rotation) {
    case "east":
      return facing;
    case "south":
      return rotateFacingSouth(facing);
    case "west":
      return rotateFacingWest(facing);
    case "north":
      return rotateFacingNorth(facing);
  }
};

const moveCoordinate = (
  coordinate: GridCoordinate,
  facing: Facing,
): GridCoordinate => {
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

const machineInputContainerId = (objectId: string) =>
  `entity:${objectId}:input`;
const machineOutputContainerId = (objectId: string) =>
  `entity:${objectId}:output`;
const burnerFuelContainerId = (objectId: string) => `entity:${objectId}:fuel`;

const createRuntimeGenerator = (
  buildableId: string,
  objectId: string,
  fuelContainerId: string,
): RuntimeGenerator | undefined => {
  const generator = findGeneratorDefinition(buildableId);

  return Match.value(generator).pipe(
    Match.when(Match.undefined, () => undefined),
    Match.orElse((definedGenerator) => ({
      currentOutputMw: 0,
      fuelBurnProgress: 0,
      fuelContainerId,
      generatorId: objectId,
      kind: buildableId,
      maxCapacityMw: definedGenerator.maxCapacityMw,
      networkId: undefined,
      objectId,
      powerRadius: definedGenerator.powerRadius,
      status: "out_of_fuel" as const,
    })),
  );
};

const findMachineDefinitionForBuildable = (
  machineKind: Parameters<typeof findMachineDefinition>[0] | undefined,
) =>
  Match.value(machineKind).pipe(
    Match.when(Match.undefined, () => undefined),
    Match.orElse((machineKind) => findMachineDefinition(machineKind)),
  );

const findInitialRecipeForMachine = (
  machineKind: Parameters<typeof findMachineDefinition>[0],
  machineDefinition: NonNullable<ReturnType<typeof findMachineDefinition>>,
) =>
  Match.value(machineDefinition.defaultRecipeId).pipe(
    Match.when(Match.undefined, () => undefined),
    Match.orElse((defaultRecipeId) =>
      findMachineRecipe(machineKind, defaultRecipeId),
    ),
  );

const inputAcceptedItemIdsForRecipe = (
  recipe: ReturnType<typeof findInitialRecipeForMachine>,
) =>
  Match.value(recipe).pipe(
    Match.when({ input: Match.defined }, ({ input }) => [input.itemId]),
    Match.orElse(() => []),
  );

const outputAcceptedItemIdsForRecipe = (
  recipe: ReturnType<typeof findInitialRecipeForMachine>,
) =>
  Match.value(recipe).pipe(
    Match.when(Match.undefined, () => []),
    Match.orElse((definedRecipe) => [definedRecipe.output.itemId]),
  );

const buildMachineContainerIds = (
  acceptedItemCount: number,
  containerId: string,
) =>
  Match.value(acceptedItemCount).pipe(
    Match.when(0, () => []),
    Match.orElse(() => [containerId]),
  );

const createTypedContainerList = (
  containerId: string | undefined,
  acceptedItemIds: ReadonlyArray<string>,
  objectId: string,
  role: "machine_input" | "machine_output",
) =>
  Match.value(containerId).pipe(
    Match.when(Match.undefined, () => []),
    Match.orElse((containerId) => [
      {
        _tag: "TypedContainer" as const,
        acceptedItemIds,
        capacity: 200,
        containerId,
        entries: [],
        owner: {
          kind: "entity" as const,
          ownerId: objectId,
          role,
        },
      },
    ]),
  );

const createPlacedBuildable = (
  buildableId: string,
  objectId: string,
  origin: GridCoordinate,
  rotation: Facing,
) => {
  const definition = findBuildableDefinition(buildableId);
  const machineKind = definition?.machineKind;
  const machineDefinition = findMachineDefinitionForBuildable(machineKind);

  return Match.value({ definition, machineDefinition, machineKind }).pipe(
    Match.when({ definition: Match.undefined }, () => undefined),
    Match.when(
      { definition: Match.defined, machineKind: Match.undefined },
      ({ definition }) => {
        const fuelContainerId = burnerFuelContainerId(objectId);
        return {
          containers: [
            {
              _tag: "TypedContainer" as const,
              acceptedItemIds: [...definition.fuelAcceptedItemIds],
              capacity: 200,
              containerId: fuelContainerId,
              entries: [],
              owner: {
                kind: "entity" as const,
                ownerId: objectId,
                role: "burner_fuel",
              },
            },
          ],
          generator: createRuntimeGenerator(
            buildableId,
            objectId,
            fuelContainerId,
          ),
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
      },
    ),
    Match.when(
      { definition: Match.defined, machineDefinition: Match.undefined },
      () => undefined,
    ),
    Match.orElse(({ definition, machineDefinition, machineKind }) => {
      const initialRecipe = findInitialRecipeForMachine(
        machineKind,
        machineDefinition,
      );
      const potentialInputAcceptedItemIds =
        inputAcceptedItemIdsForKind(machineKind);
      const potentialOutputAcceptedItemIds =
        outputAcceptedItemIdsForKind(machineKind);
      const inputAcceptedItemIds = inputAcceptedItemIdsForRecipe(initialRecipe);
      const outputAcceptedItemIds =
        outputAcceptedItemIdsForRecipe(initialRecipe);
      const inputContainerIds = buildMachineContainerIds(
        potentialInputAcceptedItemIds.length,
        machineInputContainerId(objectId),
      );
      const outputContainerIds = buildMachineContainerIds(
        potentialOutputAcceptedItemIds.length,
        machineOutputContainerId(objectId),
      );
      const containers: Array<RuntimeContainer> = [
        ...createTypedContainerList(
          inputContainerIds[0],
          inputAcceptedItemIds,
          objectId,
          "machine_input",
        ),
        ...createTypedContainerList(
          outputContainerIds[0],
          outputAcceptedItemIds,
          objectId,
          "machine_output",
        ),
      ];

      return {
        containers,
        machine: {
          inputContainerIds,
          kind: machineKind,
          machineId: objectId,
          networkId: undefined,
          objectId,
          outputContainerIds,
          powerState: "connected" as const,
          progress: 0,
          recipeId: machineDefinition.defaultRecipeId,
          status: "idle" as const,
        },
        generator: undefined,
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
    }),
  );
};

const tileKey = (coordinate: GridCoordinate) =>
  `${coordinate.x}:${coordinate.y}`;

const normalizeRuntimeSnapshot = (
  snapshot: WorldRuntimeSnapshot,
): WorldRuntimeSnapshot => {
  const objects = snapshot.objects ?? [];
  const objectIds = new Set(objects.map((object) => object.objectId));
  const missingDefaultFixtures = defaultRuntimeMapContract.defaultFixtures
    .filter((fixture) => !objectIds.has(fixture.objectId))
    .map((fixture) => {
      const containerIds =
        fixture.buildableId === "modular_storage"
          ? [modularStorageContainerId()]
          : [];
      return DefaultFixturePlacement.toRuntimeObject(fixture, containerIds);
    });

  return {
    ...snapshot,
    generators: snapshot.generators ?? [],
    objects: [...objects, ...missingDefaultFixtures],
    powerNetworks: snapshot.powerNetworks ?? [],
    runtimeVersion: 3,
    tiles: snapshot.tiles ?? defaultRuntimeMapContract.tiles,
    transportLanes: snapshot.transportLanes.map((lane) => ({
      ...lane,
      pathTiles: lane.pathTiles ?? [],
    })),
  };
};

const fixedRuntimeObjects = (
  mapContract: typeof defaultRuntimeMapContract,
  starterBoxEntityId: string | undefined,
): Array<RuntimePlacedObject> => {
  const nodes = mapContract.resourceNodes.map<RuntimePlacedObject>(
    (node: (typeof mapContract.resourceNodes)[number]) => ({
      buildableId: node.buildableId,
      containerIds: [],
      fixed: true,
      machineId: undefined,
      objectId: node.nodeId,
      origin: node.origin,
      removable: false,
      resourceNodeId: node.nodeId,
      rotation: undefined,
    }),
  );

  const fixtures = mapContract.defaultFixtures.map((fixture) => {
    const containerIds =
      fixture.buildableId === "modular_storage"
        ? [modularStorageContainerId()]
        : [];
    return DefaultFixturePlacement.toRuntimeObject(fixture, containerIds);
  });

  const objects: Array<RuntimePlacedObject> = [...nodes, ...fixtures];

  if (starterBoxEntityId !== undefined) {
    objects.push({
      buildableId: "starter_box",
      containerIds: [starterBoxContainerId(starterBoxEntityId)],
      fixed: false,
      machineId: undefined,
      objectId: starterBoxEntityId,
      origin: mapContract.starterBoxAnchor,
      removable: true,
      rotation: "south",
    });
  }

  return objects;
};

type QueuedWorldCommand = {
  readonly actor: ActorContext;
  readonly cacheKey: string;
  readonly command: WorldCommand;
  readonly enqueuedAtMs: number;
  readonly result: Deferred.Deferred<WorldCommandReceipt>;
};

type RememberedCommand =
  | {
      readonly _tag: "pending";
      readonly deferred: Deferred.Deferred<WorldCommandReceipt>;
      readonly payloadKey: string;
    }
  | {
      readonly _tag: "resolved";
      readonly payloadKey: string;
      readonly receipt: WorldCommandReceipt;
    };

type CommandSubmissionResolution =
  | {
      readonly _tag: "conflict";
    }
  | {
      readonly _tag: "enqueue";
      readonly deferred: Deferred.Deferred<WorldCommandReceipt>;
    }
  | {
      readonly _tag: "pending";
      readonly deferred: Deferred.Deferred<WorldCommandReceipt>;
    }
  | {
      readonly _tag: "resolved";
      readonly receipt: WorldCommandReceipt;
    };

type QueuedCommandResult =
  | {
      readonly _tag: "queued";
      readonly commandId: string;
      readonly receipt: Deferred.Deferred<WorldCommandReceipt>;
    }
  | {
      readonly _tag: "resolved";
      readonly receipt: WorldCommandReceipt;
    };

type LoadedWorldRuntime = {
  readonly commandQueue: Queue.Queue<QueuedWorldCommand>;
  readonly commandReceipts: SynchronizedRef.SynchronizedRef<
    ReadonlyMap<string, RememberedCommand>
  >;
  readonly deltas: PubSub.PubSub<WorldRuntimeDelta>;
  readonly liveSnapshot: SubscriptionRef.SubscriptionRef<WorldRuntimeSnapshot>;
  readonly state: Ref.Ref<WorldRuntimeSnapshot>;
  readonly worldId: string;
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
    readonly cacheKey: string;
    readonly deferred: Deferred.Deferred<WorldCommandReceipt>;
    readonly receipt: WorldCommandReceipt;
  }>;
  readonly snapshot: WorldRuntimeSnapshot;
};

type TickPhaseState = {
  readonly changes: Array<WorldRuntimeChange>;
  readonly pendingReceipts: Array<{
    readonly cacheKey: string;
    readonly deferred: Deferred.Deferred<WorldCommandReceipt>;
    readonly pendingReceipt: PendingCommandReceipt;
  }>;
  readonly snapshot: WorldRuntimeSnapshot;
};

const modularStorageContainerId = () => "system:modular-storage";

const commandCacheKey = (actor: ActorContext, commandId: string) =>
  `${actor.publicKey}:${commandId}`;

const commandPayloadKey = (command: WorldCommand) => JSON.stringify(command);

const commandTagSummary = (commands: ReadonlyArray<QueuedWorldCommand>) =>
  commands.map((queued) => queued.command._tag).join(",");

const assetInventoryContainerId = (assetId: string) =>
  `asset:${assetId}:inventory`;

const starterBoxContainerId = (entityId: string) =>
  `entity:${entityId}:starter-box`;

const isSlotContainer = (
  container: RuntimeContainer,
): container is SlotContainer => container._tag === "SlotContainer";

const isTypedContainer = (
  container: RuntimeContainer,
): container is TypedContainer => container._tag === "TypedContainer";

const isQuotaStorage = (container: RuntimeContainer) =>
  container.owner.kind === "system" && container.owner.role === "quota_storage";

const makeEmptySlots = (slotCount: number): SlotContainer["slots"] =>
  Array.from({ length: slotCount }, (_, slotIndex) => ({ slotIndex }));

const upsertSlotStack = (
  slots: SlotContainer["slots"],
  slotIndex: number,
  stack: RuntimeItemStack | undefined,
) =>
  slots.map((slot) =>
    Match.value(slot.slotIndex === slotIndex).pipe(
      Match.when(true, () => ({ slotIndex, stack })),
      Match.orElse(() => slot),
    ),
  );

const stackListFromSlot = (slot: SlotContainer["slots"][number]) =>
  Match.value(slot.stack).pipe(
    Match.when(Match.undefined, () => []),
    Match.orElse((stack) => [stack]),
  );

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

const buildInitialRuntimeSnapshot = Effect.fn("api.worldRuntime.buildInitialRuntimeSnapshot")(function* (
  world: ReadyWorld,
) {
  const now = yield* Clock.currentTimeMillis;
  const mapContract = getRuntimeMapContract(world.spec.mapId);
  const inventoryBindings = makeInventoryBindings(world.snapshot);
  const hostStarterStacks = Match.value(
    world.snapshot.onboarding.starterKit.length > 0,
  ).pipe(
    Match.when(true, () =>
      world.snapshot.onboarding.starterKit.map((item, index) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        slotIndex: index,
      })),
    ),
    Match.orElse(() => []),
  );
  const inventoryContainers = world.snapshot.roster.map<SlotContainer>(
    (slot) => {
      const stacks = Match.value(slot.assetId === world.spec.hostAssetId).pipe(
        Match.when(true, () => hostStarterStacks),
        Match.orElse(() => []),
      );

      return toSlotContainer({
        containerId: assetInventoryContainerId(slot.assetId),
        owner: {
          actorPublicKey: slot.reservedByProfileId,
          kind: "asset",
          ownerId: slot.assetId,
          role: "inventory",
        },
        slotCount: hostInventorySlotCount,
        stacks,
      });
    },
  );
  const starterBox = world.snapshot.onboarding.starterBox;
  const starterBoxContainers = Match.value(starterBox).pipe(
    Match.when(Match.undefined, () => []),
    Match.orElse((starterBox) => [
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
    ]),
  );
  const containers: Array<RuntimeContainer> = [
    ...inventoryContainers,
    ...starterBoxContainers,
    {
      _tag: "TypedContainer",
      acceptedItemIds: world.snapshot.storage.modularStorage.acceptedItemIds,
      capacity: undefined,
      containerId: modularStorageContainerId(),
      entries: world.snapshot.storage.modularStorage.storedItems.map(
        (item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
        }),
      ),
      owner: {
        kind: "system",
        ownerId: modularStorageContainerId(),
        role: "quota_storage",
      },
    },
  ];

  const observers: RuntimeObservers = {
    bossChat: world.snapshot.bossChat,
    quota: toRuntimeQuota(world.snapshot),
    tutorial: world.snapshot.tutorial,
  };

  const objects = fixedRuntimeObjects(mapContract, starterBox?.entityId);

  return {
    containers,
    deltaSequence: 0,
    generators: [],
    inventories: inventoryBindings,
    lastTickAt: new Date(now).toISOString(),
    machines: [],
    mode: world.spec.mode,
    observers,
    objects,
    powerNetworks: [],
    runtimeVersion: 3,
    tick: 0,
    tiles: mapContract.tiles,
    transportLanes: [],
    worldId: world.worldId,
  };
});

const findContainer = (snapshot: WorldRuntimeSnapshot, containerId: string) =>
  snapshot.containers.find(
    (container) => container.containerId === containerId,
  );

const findObject = (snapshot: WorldRuntimeSnapshot, objectId: string) =>
  (snapshot.objects ?? []).find((object) => object.objectId === objectId);

const findMachine = (snapshot: WorldRuntimeSnapshot, machineId: string) =>
  snapshot.machines.find((machine) => machine.machineId === machineId);

const findGenerator = (snapshot: WorldRuntimeSnapshot, generatorId: string) =>
  snapshot.generators.find(
    (generator) => generator.generatorId === generatorId,
  );

const findTile = (snapshot: WorldRuntimeSnapshot, coordinate: GridCoordinate) =>
  (snapshot.tiles ?? []).find(
    (tile) =>
      tile.coordinate.x === coordinate.x && tile.coordinate.y === coordinate.y,
  );

const addObject = (
  snapshot: WorldRuntimeSnapshot,
  object: RuntimePlacedObject,
): WorldRuntimeSnapshot => ({
  ...snapshot,
  objects: [...(snapshot.objects ?? []), object],
});

const removeObject = (
  snapshot: WorldRuntimeSnapshot,
  objectId: string,
): WorldRuntimeSnapshot => ({
  ...snapshot,
  objects: (snapshot.objects ?? []).filter(
    (object) => object.objectId !== objectId,
  ),
});

const replaceContainer = (
  snapshot: WorldRuntimeSnapshot,
  container: RuntimeContainer,
): WorldRuntimeSnapshot => ({
  ...snapshot,
  containers: snapshot.containers.map((current) =>
    Match.value(current.containerId === container.containerId).pipe(
      Match.when(true, () => container),
      Match.orElse(() => current),
    ),
  ),
});

const addContainer = (
  snapshot: WorldRuntimeSnapshot,
  container: RuntimeContainer,
): WorldRuntimeSnapshot => ({
  ...snapshot,
  containers: [...snapshot.containers, container],
});

const removeContainer = (
  snapshot: WorldRuntimeSnapshot,
  containerId: string,
): WorldRuntimeSnapshot => ({
  ...snapshot,
  containers: snapshot.containers.filter(
    (container) => container.containerId !== containerId,
  ),
});

const replaceMachine = (
  snapshot: WorldRuntimeSnapshot,
  machine: WorldRuntimeSnapshot["machines"][number],
): WorldRuntimeSnapshot => ({
  ...snapshot,
  machines: snapshot.machines.map((current) =>
    Match.value(current.machineId === machine.machineId).pipe(
      Match.when(true, () => machine),
      Match.orElse(() => current),
    ),
  ),
});

const addMachine = (
  snapshot: WorldRuntimeSnapshot,
  machine: WorldRuntimeSnapshot["machines"][number],
): WorldRuntimeSnapshot => ({
  ...snapshot,
  machines: [...snapshot.machines, machine],
});

const removeMachine = (
  snapshot: WorldRuntimeSnapshot,
  machineId: string,
): WorldRuntimeSnapshot => ({
  ...snapshot,
  machines: snapshot.machines.filter(
    (machine) => machine.machineId !== machineId,
  ),
});

const replaceGenerator = (
  snapshot: WorldRuntimeSnapshot,
  generator: RuntimeGenerator,
): WorldRuntimeSnapshot => ({
  ...snapshot,
  generators: snapshot.generators.map((current) =>
    Match.value(current.generatorId === generator.generatorId).pipe(
      Match.when(true, () => generator),
      Match.orElse(() => current),
    ),
  ),
});

const addGenerator = (
  snapshot: WorldRuntimeSnapshot,
  generator: RuntimeGenerator,
): WorldRuntimeSnapshot => ({
  ...snapshot,
  generators: [...snapshot.generators, generator],
});

const removeGenerator = (
  snapshot: WorldRuntimeSnapshot,
  generatorId: string,
): WorldRuntimeSnapshot => ({
  ...snapshot,
  generators: snapshot.generators.filter(
    (generator) => generator.generatorId !== generatorId,
  ),
});

const replacePowerNetworks = (
  snapshot: WorldRuntimeSnapshot,
  powerNetworks: ReadonlyArray<RuntimePowerNetwork>,
): WorldRuntimeSnapshot => ({
  ...snapshot,
  powerNetworks: [...powerNetworks],
});

const replaceTransportLane = (
  snapshot: WorldRuntimeSnapshot,
  lane: WorldRuntimeSnapshot["transportLanes"][number],
): WorldRuntimeSnapshot => ({
  ...snapshot,
  transportLanes: snapshot.transportLanes.map((current) =>
    Match.value(current.laneId === lane.laneId).pipe(
      Match.when(true, () => lane),
      Match.orElse(() => current),
    ),
  ),
});

const addTransportLane = (
  snapshot: WorldRuntimeSnapshot,
  lane: WorldRuntimeSnapshot["transportLanes"][number],
): WorldRuntimeSnapshot => ({
  ...snapshot,
  transportLanes: [...snapshot.transportLanes, lane],
});

const removeTransportLane = (
  snapshot: WorldRuntimeSnapshot,
  laneId: string,
): WorldRuntimeSnapshot => ({
  ...snapshot,
  transportLanes: snapshot.transportLanes.filter(
    (lane) => lane.laneId !== laneId,
  ),
});

const peekExtractableItem = (
  container: RuntimeContainer,
): RuntimeItemStack | undefined =>
  Match.value(isSlotContainer(container)).pipe(
    Match.when(true, () => {
      const slot = [...container.slots]
        .sort((left, right) => left.slotIndex - right.slotIndex)
        .find((candidate) => candidate.stack !== undefined);
      return slot?.stack;
    }),
    Match.orElse(() => container.entries[0]),
  );

const takeOneExtractableItem = (container: RuntimeContainer, itemId: string) =>
  Match.value(isSlotContainer(container)).pipe(
    Match.when(true, () =>
      takeFromSlotContainer(container, itemId, 1, undefined),
    ),
    Match.orElse(() => takeFromTypedContainer(container, itemId, 1)),
  );

const decrementTypedContainerEntry = (
  entry: TypedContainer["entries"][number],
  itemId: string,
  quantity: number,
) =>
  Match.value(entry.itemId === itemId).pipe(
    Match.when(true, () => ({ itemId, quantity: entry.quantity - quantity })),
    Match.orElse(() => entry),
  );

const incrementTypedContainerEntry = (
  entry: TypedContainer["entries"][number],
  stack: RuntimeItemStack,
) =>
  Match.value(entry.itemId === stack.itemId).pipe(
    Match.when(true, () => ({
      itemId: entry.itemId,
      quantity: entry.quantity + stack.quantity,
    })),
    Match.orElse(() => entry),
  );

const incrementQuotaDelivery = (
  quota: RuntimeObservers["quota"][number],
  stack: RuntimeItemStack,
) =>
  Match.value(quota.itemId === stack.itemId).pipe(
    Match.when(true, () => ({
      ...quota,
      delivered: quota.delivered + stack.quantity,
      reserved: quota.reserved + stack.quantity,
    })),
    Match.orElse(() => quota),
  );

const rejectContainerMutation = (
  message: string,
  reasonCode: WorldCommandRejectionCode,
) => ({
  _tag: "rejected" as const,
  message,
  reasonCode,
});

const nextTypedContainerEntries = (
  container: TypedContainer,
  stack: RuntimeItemStack,
) => {
  const existingEntry = container.entries.find(
    (entry) => entry.itemId === stack.itemId,
  );

  return Match.value(existingEntry).pipe(
    Match.when(Match.undefined, () => [...container.entries, stack]),
    Match.orElse(() =>
      container.entries.map((entry) =>
        incrementTypedContainerEntry(entry, stack),
      ),
    ),
  );
};

const quantityForMatchingItem = (
  candidateItemId: string,
  itemId: string,
  quantity: number,
) =>
  Match.value(candidateItemId === itemId).pipe(
    Match.when(true, () => quantity),
    Match.orElse(() => 0),
  );

const quantityForOptionalStackItem = (
  stack: RuntimeItemStack | undefined,
  itemId: string,
) =>
  Match.value(stack).pipe(
    Match.when(Match.undefined, () => 0),
    Match.orElse((stack) =>
      quantityForMatchingItem(stack.itemId, itemId, stack.quantity),
    ),
  );

const availableQuantityInContainer = (
  container: RuntimeContainer,
  itemId: string,
) =>
  Match.value(isSlotContainer(container)).pipe(
    Match.when(true, () =>
      container.slots.reduce(
        (total, slot) =>
          total + quantityForOptionalStackItem(slot.stack, itemId),
        0,
      ),
    ),
    Match.orElse(() =>
      container.entries.reduce(
        (total, entry) =>
          total + quantityForMatchingItem(entry.itemId, itemId, entry.quantity),
        0,
      ),
    ),
  );

const resolveTypedEntryForTake = (
  container: TypedContainer,
  itemId: string,
  quantity: number,
) => {
  const entry = container.entries.find(
    (candidate) => candidate.itemId === itemId,
  );

  return Match.value(entry).pipe(
    Match.when(Match.undefined, () => undefined),
    Match.orElse((entry) =>
      keepTypedEntryWithSufficientQuantity(entry, quantity),
    ),
  );
};

const keepTypedEntryWithSufficientQuantity = (
  entry: TypedContainer["entries"][number],
  quantity: number,
) =>
  Match.value(entry.quantity < quantity).pipe(
    Match.when(true, () => undefined),
    Match.orElse(() => entry),
  );

const remainingEntriesAfterTypedTake = (
  container: TypedContainer,
  itemId: string,
  quantity: number,
  entry: TypedContainer["entries"][number],
) =>
  Match.value(entry.quantity === quantity).pipe(
    Match.when(true, () =>
      container.entries.filter((candidate) => candidate.itemId !== itemId),
    ),
    Match.orElse(() =>
      container.entries.map((candidate) =>
        decrementTypedContainerEntry(candidate, itemId, quantity),
      ),
    ),
  );

const typedTakeResultFromEntry = (
  container: TypedContainer,
  itemId: string,
  quantity: number,
  entry: TypedContainer["entries"][number] | undefined,
) =>
  Match.value(entry).pipe(
    Match.when(Match.undefined, () =>
      rejectContainerMutation(
        `Item ${itemId} is not available in ${container.containerId}`,
        "insufficient_items",
      ),
    ),
    Match.orElse((entry) => ({
      _tag: "taken" as const,
      container: {
        ...container,
        entries: remainingEntriesAfterTypedTake(
          container,
          itemId,
          quantity,
          entry,
        ),
      },
      moved: {
        itemId,
        quantity,
      },
    })),
  );

const observersAfterTypedPlacement = (
  snapshot: WorldRuntimeSnapshot,
  container: TypedContainer,
  stack: RuntimeItemStack,
) =>
  Match.value(isQuotaStorage(container)).pipe(
    Match.when(true, () => ({
      ...snapshot.observers,
      quota: snapshot.observers.quota.map((quota) =>
        incrementQuotaDelivery(quota, stack),
      ),
    })),
    Match.orElse(() => snapshot.observers),
  );

const validateTypedContainerCapacity = (
  container: TypedContainer,
  currentQuantity: number,
  stack: RuntimeItemStack,
): PlacementValidation => {
  const hasOverflow = Match.value(container.capacity).pipe(
    Match.when(Match.undefined, () => false),
    Match.orElse((capacity) => currentQuantity + stack.quantity > capacity),
  );

  return Match.value(hasOverflow).pipe(
    Match.when(true, () =>
      placementRejected(`${container.containerId} is full`, "container_full"),
    ),
    Match.orElse(() => placementOk),
  );
};

const finalizeTypedPlacement = (
  snapshot: WorldRuntimeSnapshot,
  container: TypedContainer,
  stack: RuntimeItemStack,
) => {
  const currentQuantity = container.entries.reduce(
    (total, entry) => total + entry.quantity,
    0,
  );
  const capacityValidation = validateTypedContainerCapacity(
    container,
    currentQuantity,
    stack,
  );

  return Match.value(capacityValidation).pipe(
    Match.when({ _tag: "rejected" }, ({ message, reasonCode }) => ({
      _tag: "rejected" as const,
      message,
      reasonCode,
    })),
    Match.orElse(() => {
      const nextEntries = nextTypedContainerEntries(container, stack);
      const nextContainer: TypedContainer = {
        ...container,
        entries: nextEntries,
      };

      const nextObservers = observersAfterTypedPlacement(
        snapshot,
        container,
        stack,
      );

      return {
        _tag: "placed" as const,
        container: nextContainer,
        observers: nextObservers,
        observersChanged: nextObservers !== snapshot.observers,
      };
    }),
  );
};

const findOptionalContainer = (
  snapshot: WorldRuntimeSnapshot,
  containerId: string | undefined,
) =>
  Match.value(containerId).pipe(
    Match.when(Match.undefined, () => undefined),
    Match.orElse((containerId) => findContainer(snapshot, containerId)),
  );

type PlacementValidation =
  | { readonly _tag: "ok" }
  | {
      readonly _tag: "rejected";
      readonly message: string;
      readonly reasonCode: WorldCommandRejectionCode;
    };

const placementOk: PlacementValidation = { _tag: "ok" };

const placementRejected = (
  message: string,
  reasonCode: WorldCommandRejectionCode,
): PlacementValidation => ({
  _tag: "rejected",
  message,
  reasonCode,
});

const validateQuotaRemainingPlacement = (
  container: TypedContainer,
  stack: RuntimeItemStack,
  quota: RuntimeObservers["quota"][number],
): PlacementValidation => {
  const remaining = quota.required - quota.delivered;

  return Match.value(remaining < stack.quantity).pipe(
    Match.when(true, () =>
      placementRejected(
        `${container.containerId} only needs ${remaining} more ${stack.itemId}`,
        "item_not_accepted",
      ),
    ),
    Match.orElse(() => placementOk),
  );
};

const validateQuotaPlacement = (
  snapshot: WorldRuntimeSnapshot,
  container: TypedContainer,
  stack: RuntimeItemStack,
): PlacementValidation => {
  const quota = snapshot.observers.quota.find(
    (candidate) => candidate.itemId === stack.itemId,
  );

  return Match.value(quota).pipe(
    Match.when(Match.undefined, () =>
      placementRejected(
        `${stack.itemId} is not tracked by the current quota`,
        "item_not_accepted",
      ),
    ),
    Match.orElse((quota) =>
      validateQuotaRemainingPlacement(container, stack, quota),
    ),
  );
};

const takeSingleItemFromContainer = (
  container: RuntimeContainer,
):
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

  return Match.value(stack).pipe(
    Match.when(Match.undefined, () => ({
      _tag: "rejected" as const,
      message: `${container.containerId} has no extractable item`,
      reasonCode: "insufficient_items" as const,
    })),
    Match.orElse((stack) => {
      const taken = takeOneExtractableItem(container, stack.itemId);

      switch (taken._tag) {
        case "rejected":
          return taken;
        case "taken":
          return {
            _tag: "taken",
            container: taken.container,
            moved: taken.moved,
          };
      }
    }),
  );
};

const resolveActorInventory = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
) =>
  snapshot.inventories.find(
    (inventory) => inventory.actorPublicKey === actor.publicKey,
  )?.containerId;

const getActorInventory = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
) => {
  const inventoryContainerId = resolveActorInventory(snapshot, actor);

  switch (inventoryContainerId) {
    case undefined:
      return undefined;
    default: {
      const container = findContainer(snapshot, inventoryContainerId);

      switch (container?._tag) {
        case "SlotContainer":
          return container;
        default:
          return undefined;
      }
    }
  }
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

  switch (inventory) {
    case undefined:
      return { changes: [], snapshot };
    default: {
      const placed = putIntoSlotContainer(inventory, stack, undefined);

      switch (placed._tag) {
        case "rejected":
          return { changes: [], snapshot };
        case "placed": {
          const nextSnapshot = replaceContainer(snapshot, placed.container);
          return {
            changes: [
              { _tag: "ContainerChanged", container: placed.container },
            ],
            snapshot: nextSnapshot,
          };
        }
      }
    }
  }
};

const isActorOwnedInventory = (
  container: RuntimeContainer,
  actor: ActorContext,
) =>
  container.owner.kind === "asset" &&
  container.owner.role === "inventory" &&
  container.owner.actorPublicKey === actor.publicKey;

const canManuallyTakeFromContainer = (
  container: RuntimeContainer,
  actor: ActorContext,
) => {
  switch (isActorOwnedInventory(container, actor)) {
    case true:
      return false;
    case false:
      switch (container.owner.role) {
        case "burner_fuel":
        case "machine_input":
        case "quota_storage":
          return false;
        case "machine_output":
        case "starter_box":
          return true;
        default:
          return isSlotContainer(container);
      }
  }
};

const getPortDefinitions = (
  object: RuntimePlacedObject,
): ReadonlyArray<PortDefinition> => {
  switch (object.buildableId) {
    case "modular_storage":
      return MODULAR_STORAGE_PORTS;
    default: {
      const definition = findBuildableDefinition(object.buildableId);

      switch (definition) {
        case undefined:
          return [];
        default: {
          const rotation = object.rotation ?? "east";
          return definition.ports.map((port) => ({
            ...port,
            facing: rotateFacing(port.facing, rotation),
          }));
        }
      }
    }
  }
};

const findPort = (object: RuntimePlacedObject, portId: string) =>
  getPortDefinitions(object).find((port) => port.portId === portId);

const portApproachTile = (object: RuntimePlacedObject, portId: string) => {
  const port = findPort(object, portId);

  switch (port) {
    case undefined:
      return undefined;
    default:
      return moveCoordinate(object.origin, port.facing);
  }
};

const isObjectTileOccupied = (
  snapshot: WorldRuntimeSnapshot,
  coordinate: GridCoordinate,
  ignoredObjectIds: ReadonlyArray<string>,
) =>
  (snapshot.objects ?? []).some(
    (object) =>
      !ignoredObjectIds.includes(object.objectId) &&
      object.origin.x === coordinate.x &&
      object.origin.y === coordinate.y,
  );

const isBeltTileOccupied = (
  snapshot: WorldRuntimeSnapshot,
  coordinate: GridCoordinate,
) =>
  snapshot.transportLanes.some((lane) =>
    (lane.pathTiles ?? []).some(
      (tile) => tile.x === coordinate.x && tile.y === coordinate.y,
    ),
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
  const slot = Match.value(fromSlotIndex).pipe(
    Match.when(Match.undefined, () =>
      container.slots.find(
        (candidate) =>
          candidate.stack?.itemId === itemId &&
          candidate.stack.quantity >= quantity,
      ),
    ),
    Match.orElse((fromSlotIndex) =>
      container.slots.find(
        (candidate) => candidate.slotIndex === fromSlotIndex,
      ),
    ),
  );

  switch (true) {
    case slot === undefined:
    case slot?.stack === undefined:
    case slot.stack.itemId !== itemId:
      return {
        _tag: "rejected",
        message: `Item ${itemId} is not available in ${container.containerId}`,
        reasonCode: "insufficient_items",
      };
  }

  switch (slot.stack.quantity < quantity) {
    case true:
      return {
        _tag: "rejected",
        message: `Item ${itemId} does not have enough quantity in ${container.containerId}`,
        reasonCode: "insufficient_items",
      };
    case false:
      break;
  }

  const remainingQuantity = slot.stack.quantity - quantity;
  const remainingStack = Match.value(remainingQuantity).pipe(
    Match.when(0, () => undefined),
    Match.orElse((quantity) => ({ itemId, quantity })),
  );

  return {
    _tag: "taken",
    container: {
      ...container,
      slots: upsertSlotStack(container.slots, slot.slotIndex, remainingStack),
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
  const quotaStorageRejection = Match.value(isQuotaStorage(container)).pipe(
    Match.when(true, () =>
      rejectContainerMutation(
        `${container.containerId} is input-only in v1`,
        "quota_storage_locked",
      ),
    ),
    Match.orElse(() => undefined),
  );

  return Match.value(quotaStorageRejection).pipe(
    Match.when(Match.defined, (rejected) => rejected),
    Match.orElse(() => {
      const entry = resolveTypedEntryForTake(container, itemId, quantity);
      return typedTakeResultFromEntry(container, itemId, quantity, entry);
    }),
  );
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
  const targetSlot = Match.value(toSlotIndex).pipe(
    Match.when(
      Match.undefined,
      () =>
        container.slots.find((slot) => slot.stack?.itemId === stack.itemId) ??
        container.slots.find((slot) => slot.stack === undefined),
    ),
    Match.orElse((toSlotIndex) =>
      container.slots.find((slot) => slot.slotIndex === toSlotIndex),
    ),
  );

  const slotPlacementContext = Match.value(targetSlot).pipe(
    Match.when(Match.undefined, () => ({ _tag: "missing" as const })),
    Match.orElse((targetSlot) => ({
      _tag: "resolved" as const,
      currentQuantity: targetSlot.stack?.quantity ?? 0,
      isCompatible:
        targetSlot.stack === undefined ||
        targetSlot.stack.itemId === stack.itemId,
      targetSlot,
    })),
  );

  return Match.value(slotPlacementContext).pipe(
    Match.when({ _tag: "missing" }, () => ({
      _tag: "rejected" as const,
      message: `${container.containerId} has no free slot for ${stack.itemId}`,
      reasonCode: "container_full" as const,
    })),
    Match.when({ _tag: "resolved", isCompatible: false }, ({ targetSlot }) => ({
      _tag: "rejected" as const,
      message: `Slot ${targetSlot.slotIndex} in ${container.containerId} is occupied by ${targetSlot.stack?.itemId}`,
      reasonCode: "container_full" as const,
    })),
    Match.orElse(({ currentQuantity, targetSlot }) => ({
      _tag: "placed" as const,
      container: {
        ...container,
        slots: upsertSlotStack(container.slots, targetSlot.slotIndex, {
          itemId: stack.itemId,
          quantity: currentQuantity + stack.quantity,
        }),
      },
    })),
  );
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
  const acceptanceValidation = Match.value({
    acceptsItem: container.acceptedItemIds.includes(stack.itemId),
    hasAcceptedList: container.acceptedItemIds.length > 0,
  }).pipe(
    Match.when({ acceptsItem: false, hasAcceptedList: true }, () =>
      placementRejected(
        `${container.containerId} does not accept ${stack.itemId}`,
        "item_not_accepted",
      ),
    ),
    Match.orElse(() => placementOk),
  );

  const quotaValidation = Match.value(isQuotaStorage(container)).pipe(
    Match.when(true, () => validateQuotaPlacement(snapshot, container, stack)),
    Match.orElse(() => placementOk),
  );

  const validation = Match.value(acceptanceValidation).pipe(
    Match.when({ _tag: "rejected" }, () => acceptanceValidation),
    Match.orElse(() => quotaValidation),
  );

  return Match.value(validation).pipe(
    Match.when({ _tag: "rejected" }, ({ message, reasonCode }) => ({
      _tag: "rejected" as const,
      message,
      reasonCode,
    })),
    Match.orElse(() => finalizeTypedPlacement(snapshot, container, stack)),
  );
};

const applyTransferForDistinctContainers = (
  snapshot: WorldRuntimeSnapshot,
  command: TransferItemsCommand,
): CommandApplication => {
  const sourceContainer = findContainer(snapshot, command.fromContainerId);
  const targetContainer = findContainer(snapshot, command.toContainerId);

  return Match.value({ sourceContainer, targetContainer }).pipe(
    Match.when({ sourceContainer: Match.undefined }, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "container_missing",
        "Source or target container is missing",
      ),
    ),
    Match.when({ targetContainer: Match.undefined }, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "container_missing",
        "Source or target container is missing",
      ),
    ),
    Match.orElse(({ sourceContainer, targetContainer }) =>
      applyTransferWithResolvedContainers(
        snapshot,
        command,
        sourceContainer,
        targetContainer,
      ),
    ),
  );
};

const applyTransferWithResolvedContainers = (
  snapshot: WorldRuntimeSnapshot,
  command: TransferItemsCommand,
  sourceContainer: RuntimeContainer,
  targetContainer: RuntimeContainer,
): CommandApplication => {
  return Match.value(targetContainer.owner.role === "machine_output").pipe(
    Match.when(true, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "item_not_accepted",
        `${targetContainer.containerId} is output-only`,
      ),
    ),
    Match.orElse(() =>
      applyTransferToNonOutputTarget(
        snapshot,
        command,
        sourceContainer,
        targetContainer,
      ),
    ),
  );
};

const applyTransferToNonOutputTarget = (
  snapshot: WorldRuntimeSnapshot,
  command: TransferItemsCommand,
  sourceContainer: RuntimeContainer,
  targetContainer: RuntimeContainer,
): CommandApplication => {
  const machineInputValidation = Match.value(
    targetContainer.owner.role === "machine_input",
  ).pipe(
    Match.when(true, () =>
      validateMachineInputManualTransfer(snapshot, command, targetContainer),
    ),
    Match.orElse(() => undefined),
  );

  return Match.value(machineInputValidation).pipe(
    Match.when(Match.defined, (application) => application),
    Match.orElse(() =>
      applyTransferAfterMachineInputValidation(
        snapshot,
        command,
        sourceContainer,
        targetContainer,
      ),
    ),
  );
};

const machineRecipeSelectionRejection = (
  snapshot: WorldRuntimeSnapshot,
  command: TransferItemsCommand,
  machine: WorldRuntimeSnapshot["machines"][number],
) =>
  Match.value(
    machineStartsWithoutSelectedRecipe(machine.kind) &&
      machine.recipeId === undefined,
  ).pipe(
    Match.when(true, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "recipe_required",
        `${machine.machineId} requires a recipe before accepting manual input`,
      ),
    ),
    Match.orElse(() => undefined),
  );

const machineManualInputAcceptanceRejection = (
  snapshot: WorldRuntimeSnapshot,
  command: TransferItemsCommand,
  targetContainer: TypedContainer,
  machine: WorldRuntimeSnapshot["machines"][number],
) => {
  const recipe = findMachineRecipe(machine.kind, machine.recipeId);
  const acceptedManualItemId = recipe?.input?.itemId;

  return Match.value(
    acceptedManualItemId === undefined ||
      acceptedManualItemId !== command.itemId,
  ).pipe(
    Match.when(true, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "item_not_accepted",
        `${targetContainer.containerId} does not accept ${command.itemId}`,
      ),
    ),
    Match.orElse(() => undefined),
  );
};

const validateOptionalMachineManualTransfer = (
  snapshot: WorldRuntimeSnapshot,
  command: TransferItemsCommand,
  typedTargetContainer: TypedContainer,
  machine: WorldRuntimeSnapshot["machines"][number] | undefined,
) => {
  const recipeSelectionRejection = Match.value(machine).pipe(
    Match.when(Match.undefined, () => undefined),
    Match.orElse((machine) =>
      machineRecipeSelectionRejection(snapshot, command, machine),
    ),
  );
  const manualInputRejection = Match.value(machine).pipe(
    Match.when(Match.undefined, () => undefined),
    Match.orElse((machine) =>
      machineManualInputAcceptanceRejection(
        snapshot,
        command,
        typedTargetContainer,
        machine,
      ),
    ),
  );

  return Match.value(recipeSelectionRejection).pipe(
    Match.when(Match.defined, (rejection) => rejection),
    Match.orElse(() => manualInputRejection),
  );
};

const validateMachineInputManualTransfer = (
  snapshot: WorldRuntimeSnapshot,
  command: TransferItemsCommand,
  targetContainer: RuntimeContainer,
) => {
  return Match.value(isTypedContainer(targetContainer)).pipe(
    Match.when(false, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "invalid_command",
        `${targetContainer.containerId} is not a typed machine input`,
      ),
    ),
    Match.orElse((typedTargetContainer) => {
      const owningObject = findObject(
        snapshot,
        typedTargetContainer.owner.ownerId,
      );
      const machineId = owningObject?.machineId;
      let machine: WorldRuntimeSnapshot["machines"][number] | undefined;
      switch (machineId) {
        case undefined:
          machine = undefined;
          break;
        default:
          machine = findMachine(snapshot, machineId);
          break;
      }

      return validateOptionalMachineManualTransfer(
        snapshot,
        command,
        typedTargetContainer,
        machine,
      );
    }),
  );
};

const applyTransferAfterMachineInputValidation = (
  snapshot: WorldRuntimeSnapshot,
  command: TransferItemsCommand,
  sourceContainer: RuntimeContainer,
  targetContainer: RuntimeContainer,
): CommandApplication => {
  const burnerFuelTargetAcceptsItem = Match.value(
    isTypedContainer(targetContainer),
  ).pipe(
    Match.when(true, () =>
      targetContainer.acceptedItemIds.includes(command.itemId),
    ),
    Match.orElse(() => true),
  );
  const burnerFuelRejection = Match.value({
    accepts: burnerFuelTargetAcceptsItem,
    isBurnerFuel: targetContainer.owner.role === "burner_fuel",
  }).pipe(
    Match.when({ accepts: false, isBurnerFuel: true }, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "item_not_accepted",
        `${targetContainer.containerId} does not accept ${command.itemId}`,
      ),
    ),
    Match.orElse(() => undefined),
  );

  return Match.value(burnerFuelRejection).pipe(
    Match.when(Match.defined, (application) => application),
    Match.orElse(() =>
      applyTransferAfterTargetValidation(
        snapshot,
        command,
        sourceContainer,
        targetContainer,
      ),
    ),
  );
};

const applySlotTransferPlacement = (
  snapshot: WorldRuntimeSnapshot,
  commandId: string,
  withSource: WorldRuntimeSnapshot,
  changes: ReadonlyArray<WorldRuntimeChange>,
  placed: ReturnType<typeof putIntoSlotContainer>,
): CommandApplication =>
  Match.value(placed).pipe(
    Match.when({ _tag: "rejected" }, ({ reasonCode, message }) =>
      rejectCommand(snapshot, commandId, reasonCode, message),
    ),
    Match.orElse((placed) => {
      const nextChanges: Array<WorldRuntimeChange> = [
        ...changes,
        {
          _tag: "ContainerChanged",
          container: placed.container,
        },
      ];

      return acceptCommand(
        replaceContainer(withSource, placed.container),
        commandId,
        nextChanges,
      );
    }),
  );

const applyTypedTransferPlacement = (
  snapshot: WorldRuntimeSnapshot,
  commandId: string,
  withSource: WorldRuntimeSnapshot,
  changes: ReadonlyArray<WorldRuntimeChange>,
  placed: ReturnType<typeof putIntoTypedContainer>,
): CommandApplication =>
  Match.value(placed).pipe(
    Match.when({ _tag: "rejected" }, ({ reasonCode, message }) =>
      rejectCommand(snapshot, commandId, reasonCode, message),
    ),
    Match.orElse((placed) => {
      const observerChanges = observerChangesForTransferPlacement(placed);
      const nextChanges: Array<WorldRuntimeChange> = [
        ...changes,
        {
          _tag: "ContainerChanged",
          container: placed.container,
        },
        ...observerChanges,
      ];

      return acceptCommand(
        {
          ...replaceContainer(withSource, placed.container),
          observers: placed.observers,
        },
        commandId,
        nextChanges,
      );
    }),
  );

const observerChangesForTransferPlacement = (
  placed: Extract<
    ReturnType<typeof putIntoTypedContainer>,
    { readonly _tag: "placed" }
  >,
) =>
  Match.value(placed.observersChanged).pipe(
    Match.when(
      true,
      () =>
        [
          {
            _tag: "ObserversChanged" as const,
            observers: placed.observers,
          },
        ] satisfies ReadonlyArray<WorldRuntimeChange>,
    ),
    Match.orElse(() => []),
  );

const applyTransferAfterTargetValidation = (
  snapshot: WorldRuntimeSnapshot,
  command: TransferItemsCommand,
  sourceContainer: RuntimeContainer,
  targetContainer: RuntimeContainer,
): CommandApplication => {
  const taken = Match.value(isSlotContainer(sourceContainer)).pipe(
    Match.when(true, () =>
      takeFromSlotContainer(
        sourceContainer,
        command.itemId,
        command.quantity,
        command.fromSlotIndex,
      ),
    ),
    Match.orElse(() =>
      takeFromTypedContainer(sourceContainer, command.itemId, command.quantity),
    ),
  );

  switch (taken._tag) {
    case "rejected":
      return rejectCommand(
        snapshot,
        command.commandId,
        taken.reasonCode,
        taken.message,
      );
    case "taken":
      break;
  }

  const withSource = replaceContainer(snapshot, taken.container);
  const changes: Array<WorldRuntimeChange> = [
    {
      _tag: "ContainerChanged",
      container: taken.container,
    },
  ];

  return Match.value(isSlotContainer(targetContainer)).pipe(
    Match.when(true, () => {
      const placed = putIntoSlotContainer(
        targetContainer,
        taken.moved,
        command.toSlotIndex,
      );

      return applySlotTransferPlacement(
        snapshot,
        command.commandId,
        withSource,
        changes,
        placed,
      );
    }),
    Match.orElse(() => {
      const placed = putIntoTypedContainer(
        snapshot,
        targetContainer,
        taken.moved,
      );

      return applyTypedTransferPlacement(
        snapshot,
        command.commandId,
        withSource,
        changes,
        placed,
      );
    }),
  );
};

const applyTransfer = (
  snapshot: WorldRuntimeSnapshot,
  command: TransferItemsCommand,
): CommandApplication =>
  Match.value(command.fromContainerId === command.toContainerId).pipe(
    Match.when(true, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "invalid_command",
        "Source and target containers must differ",
      ),
    ),
    Match.orElse(() => applyTransferForDistinctContainers(snapshot, command)),
  );

const applyTakeFromContainer = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: TakeFromContainerCommand,
): CommandApplication => {
  const inventoryContainerId = resolveActorInventory(snapshot, actor);

  return Match.value(inventoryContainerId).pipe(
    Match.when(Match.undefined, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "no_actor_inventory",
        "Actor has no bound runtime inventory",
      ),
    ),
    Match.orElse((inventoryContainerId) =>
      applyTakeFromContainerWithInventory(
        snapshot,
        actor,
        command,
        inventoryContainerId,
      ),
    ),
  );
};

const applyTakeFromContainerWithSource = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: TakeFromContainerCommand,
  inventoryContainerId: string,
  sourceContainer: RuntimeContainer,
): CommandApplication =>
  Match.value(canManuallyTakeFromContainer(sourceContainer, actor)).pipe(
    Match.when(false, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "invalid_target",
        `${sourceContainer.containerId} does not allow manual withdrawal`,
      ),
    ),
    Match.orElse(() =>
      applyTransfer(snapshot, {
        _tag: "TransferItems",
        commandId: command.commandId,
        fromContainerId: command.fromContainerId,
        fromSlotIndex: command.fromSlotIndex,
        itemId: command.itemId,
        quantity: command.quantity,
        toContainerId: inventoryContainerId,
        toSlotIndex: command.toSlotIndex,
      }),
    ),
  );

const applyTakeFromContainerWithInventory = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: TakeFromContainerCommand,
  inventoryContainerId: string,
): CommandApplication => {
  const sourceContainer = findContainer(snapshot, command.fromContainerId);

  return Match.value(sourceContainer).pipe(
    Match.when(Match.undefined, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "container_missing",
        "Source container is missing",
      ),
    ),
    Match.orElse((sourceContainer) =>
      applyTakeFromContainerWithSource(
        snapshot,
        actor,
        command,
        inventoryContainerId,
        sourceContainer,
      ),
    ),
  );
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

  return Match.value(inventory).pipe(
    Match.when(Match.undefined, () => ({
      _tag: "rejected" as const,
      application: rejectCommand(
        snapshot,
        commandId,
        "no_actor_inventory",
        "Actor has no bound runtime inventory",
      ),
    })),
    Match.orElse((inventory) => {
      const taken = takeFromSlotContainer(
        inventory,
        itemId,
        quantity,
        undefined,
      );

      switch (taken._tag) {
        case "rejected":
          return {
            _tag: "rejected",
            application: rejectCommand(
              snapshot,
              commandId,
              taken.reasonCode,
              taken.message,
            ),
          };
        case "taken":
          return {
            _tag: "taken",
            changes: [{ _tag: "ContainerChanged", container: taken.container }],
            snapshot: replaceContainer(snapshot, taken.container),
          };
      }
    }),
  );
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

    turns += turnDelta(previous, current, next);
  }

  return turns;
};

const turnDeltaFromStepComparison = (isTurn: boolean) =>
  Match.value(isTurn).pipe(
    Match.when(true, () => 1),
    Match.orElse(() => 0),
  );

const preferredDirectionBias = (
  sourceStart: GridCoordinate,
  preferredDirections: ReadonlyArray<Facing>,
  step: GridCoordinate,
) =>
  Match.value(
    preferredDirections.findIndex((direction) => {
      const preferred = moveCoordinate(sourceStart, direction);
      return preferred.x === step.x && preferred.y === step.y;
    }),
  ).pipe(
    Match.when(-1, () => preferredDirections.length),
    Match.orElse((index) => index),
  );

const toRuntimePathTile = (
  snapshot: WorldRuntimeSnapshot,
  step: GridCoordinate,
): RuntimePathTile | undefined =>
  Match.value(findTile(snapshot, step)).pipe(
    Match.when(Match.undefined, () => undefined),
    Match.orElse((tile) => ({
      altitude: tile.altitude,
      x: step.x,
      y: step.y,
    })),
  );

const areEndpointTilesBuildable = (
  startTile: ReturnType<typeof findTile>,
  endTile: ReturnType<typeof findTile>,
) =>
  Match.value({ endTile, startTile }).pipe(
    Match.when({ endTile: Match.undefined }, () => false),
    Match.when({ startTile: Match.undefined }, () => false),
    Match.orElse(
      ({ endTile, startTile }) => startTile.buildable && endTile.buildable,
    ),
  );

const turnDelta = (
  previous: GridCoordinate | undefined,
  current: GridCoordinate | undefined,
  next: GridCoordinate | undefined,
) =>
  Match.value({ current, next, previous }).pipe(
    Match.when({ current: Match.undefined }, () => 0),
    Match.when({ next: Match.undefined }, () => 0),
    Match.when({ previous: Match.undefined }, () => 0),
    Match.orElse(({ current, next, previous }) =>
      turnDeltaFromStepComparison(
        current.x - previous.x !== next.x - current.x ||
          current.y - previous.y !== next.y - current.y,
      ),
    ),
  );

const findBeltPathForOpenApproach = (
  snapshot: WorldRuntimeSnapshot,
  sourceObject: RuntimePlacedObject,
  destinationObject: RuntimePlacedObject,
  sourcePort: PortDefinition,
  sourceStart: GridCoordinate,
  destinationEnd: GridCoordinate,
): Array<RuntimePathTile> | undefined => {
  const queue: Array<ReadonlyArray<GridCoordinate>> = [[sourceStart]];
  const bestByTile = new Map<
    string,
    { readonly length: number; readonly turns: number }
  >();
  const results: Array<ReadonlyArray<GridCoordinate>> = [];
  const preferredDirections = toNeighborDirections(sourcePort.facing);

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path?.at(-1);
    const resolvedSteps = Match.value({ current, path }).pipe(
      Match.when({ path: Match.undefined }, () => []),
      Match.when({ current: Match.undefined }, () => []),
      Match.orElse(({ current, path }) => [{ current, path }]),
    );

    for (const resolvedStep of resolvedSteps) {
      const { current, path } = resolvedStep;
      const expansionStarts = Match.value(
        current.x === destinationEnd.x && current.y === destinationEnd.y,
      ).pipe(
        Match.when(true, () => {
          results.push(path);
          return [];
        }),
        Match.orElse(() => [current]),
      );

      for (const expansionStart of expansionStarts) {
        for (const direction of preferredDirections) {
          const nextCoordinate = moveCoordinate(expansionStart, direction);
          const nextTile = findTile(snapshot, nextCoordinate);
          const currentTile = findTile(snapshot, expansionStart);
          const traversableSteps = Match.value({ currentTile, nextTile }).pipe(
            Match.when({ nextTile: Match.undefined }, () => []),
            Match.when({ currentTile: Match.undefined }, () => []),
            Match.when({ nextTile: { buildable: false } }, () => []),
            Match.orElse(({ currentTile, nextTile }) => [
              { currentTile, nextTile },
            ]),
          );

          for (const traversableStep of traversableSteps) {
            const { currentTile, nextTile } = traversableStep;
            const altitudeCompatibleSteps = Match.value(
              Math.abs(nextTile.altitude - currentTile.altitude) > 1,
            ).pipe(
              Match.when(true, () => []),
              Match.orElse(() => [{}]),
            );

            for (const altitudeCompatibleStep of altitudeCompatibleSteps) {
              const collisionFreeSteps = Match.value(
                isObjectTileOccupied(snapshot, nextCoordinate, [
                  sourceObject.objectId,
                  destinationObject.objectId,
                ]) ||
                  isBeltTileOccupied(snapshot, nextCoordinate) ||
                  path.some(
                    (step) =>
                      step.x === nextCoordinate.x &&
                      step.y === nextCoordinate.y,
                  ),
              ).pipe(
                Match.when(true, () => []),
                Match.orElse(() => [altitudeCompatibleStep]),
              );

              for (const _collisionFreeStep of collisionFreeSteps) {
                void _collisionFreeStep;

                const nextPath = [...path, nextCoordinate];
                const score = {
                  length: nextPath.length,
                  turns: countTurns(nextPath),
                };
                const best = bestByTile.get(tileKey(nextCoordinate));
                const shouldSkipByBest = Match.value({ best, score }).pipe(
                  Match.when({ best: Match.undefined }, () => false),
                  Match.orElse(
                    ({ best, score }) =>
                      best.length < score.length ||
                      (best.length === score.length &&
                        best.turns < score.turns),
                  ),
                );
                const enqueueCandidates = Match.value(shouldSkipByBest).pipe(
                  Match.when(true, () => []),
                  Match.orElse(() => [score]),
                );

                for (const enqueueCandidate of enqueueCandidates) {
                  bestByTile.set(tileKey(nextCoordinate), enqueueCandidate);
                  queue.push(nextPath);
                }
              }
            }
          }
        }
      }
    }
  }

  const sorted = results.sort((left, right) => {
    const lengthDelta = left.length - right.length;
    const turnDelta = countTurns(left) - countTurns(right);
    const firstStepDelta = Match.value({
      leftFirst: left[1],
      rightFirst: right[1],
    }).pipe(
      Match.when({ leftFirst: Match.undefined }, () => 0),
      Match.when({ rightFirst: Match.undefined }, () => 0),
      Match.orElse(
        ({ leftFirst, rightFirst }) =>
          preferredDirectionBias(sourceStart, preferredDirections, leftFirst) -
          preferredDirectionBias(sourceStart, preferredDirections, rightFirst),
      ),
    );

    return Match.value({
      hasLengthDelta: lengthDelta !== 0,
      hasTurnDelta: turnDelta !== 0,
    }).pipe(
      Match.when({ hasLengthDelta: true }, () => lengthDelta),
      Match.when({ hasTurnDelta: true }, () => turnDelta),
      Match.orElse(() => firstStepDelta),
    );
  });

  const bestPath = sorted[0];

  return Match.value(bestPath).pipe(
    Match.when(Match.undefined, () => undefined),
    Match.orElse((bestPath) =>
      bestPath
        .map((step) => toRuntimePathTile(snapshot, step))
        .filter((step): step is RuntimePathTile => step !== undefined),
    ),
  );
};

const findBeltPathForBuildableApproach = (
  snapshot: WorldRuntimeSnapshot,
  sourceObject: RuntimePlacedObject,
  destinationObject: RuntimePlacedObject,
  sourcePort: PortDefinition,
  sourceStart: GridCoordinate,
  destinationEnd: GridCoordinate,
): Array<RuntimePathTile> | undefined => {
  const endpointBlocked =
    isObjectTileOccupied(snapshot, sourceStart, [
      sourceObject.objectId,
      destinationObject.objectId,
    ]) ||
    isObjectTileOccupied(snapshot, destinationEnd, [
      sourceObject.objectId,
      destinationObject.objectId,
    ]) ||
    isBeltTileOccupied(snapshot, sourceStart) ||
    isBeltTileOccupied(snapshot, destinationEnd);

  return Match.value(endpointBlocked).pipe(
    Match.when(true, () => undefined),
    Match.orElse(() =>
      findBeltPathForOpenApproach(
        snapshot,
        sourceObject,
        destinationObject,
        sourcePort,
        sourceStart,
        destinationEnd,
      ),
    ),
  );
};

const findBeltPathForApproach = (
  snapshot: WorldRuntimeSnapshot,
  sourceObject: RuntimePlacedObject,
  destinationObject: RuntimePlacedObject,
  sourcePort: PortDefinition,
  sourceStart: GridCoordinate,
  destinationEnd: GridCoordinate,
): Array<RuntimePathTile> | undefined => {
  const startTile = findTile(snapshot, sourceStart);
  const endTile = findTile(snapshot, destinationEnd);

  return Match.value(areEndpointTilesBuildable(startTile, endTile)).pipe(
    Match.when(false, () => undefined),
    Match.orElse(() =>
      findBeltPathForBuildableApproach(
        snapshot,
        sourceObject,
        destinationObject,
        sourcePort,
        sourceStart,
        destinationEnd,
      ),
    ),
  );
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

  const resolvedApproach = Match.value({
    destinationEnd,
    destinationPort,
    sourcePort,
    sourceStart,
  }).pipe(
    Match.when({ destinationEnd: Match.undefined }, () => undefined),
    Match.when({ destinationPort: Match.undefined }, () => undefined),
    Match.when({ sourcePort: Match.undefined }, () => undefined),
    Match.when({ sourceStart: Match.undefined }, () => undefined),
    Match.orElse((resolved) => resolved),
  );

  return Match.value(resolvedApproach).pipe(
    Match.when(Match.undefined, () => undefined),
    Match.orElse(({ destinationEnd, sourcePort, sourceStart }) =>
      findBeltPathForApproach(
        snapshot,
        sourceObject,
        destinationObject,
        sourcePort,
        sourceStart,
        destinationEnd,
      ),
    ),
  );
};

const applyPlaceBuildingOnFreeTile = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: PlaceBuildingCommand,
  definition: NonNullable<ReturnType<typeof findBuildableDefinition>>,
): CommandApplication => {
  const resourceNode = (snapshot.objects ?? []).find(
    (object) =>
      object.resourceNodeId !== undefined &&
      object.origin.x === command.origin.x &&
      object.origin.y === command.origin.y,
  );
  const occupiedMinerNode = Match.value(resourceNode?.resourceNodeId).pipe(
    Match.when(Match.undefined, () => false),
    Match.orElse((resourceNodeId) =>
      (snapshot.objects ?? []).some(
        (object) =>
          object.buildableId === "miner_v1" &&
          object.resourceNodeId === resourceNodeId,
      ),
    ),
  );
  const minerValidation = Match.value({
    isMiner: command.buildableId === "miner_v1",
    missingResourceNode: resourceNode?.resourceNodeId === undefined,
    occupiedMinerNode,
  }).pipe(
    Match.when({ isMiner: false }, () => undefined),
    Match.when({ isMiner: true, missingResourceNode: true }, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "invalid_location",
        "Miner must be placed on a resource node",
      ),
    ),
    Match.when({ isMiner: true, occupiedMinerNode: true }, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "invalid_location",
        "Resource node already has a miner",
      ),
    ),
    Match.orElse(() => undefined),
  );

  return Match.value(minerValidation).pipe(
    Match.when(Match.defined, (validation) => validation),
    Match.orElse(() =>
      applyPlaceBuildingAfterValidation(
        snapshot,
        actor,
        command,
        definition,
        resourceNode?.resourceNodeId,
      ),
    ),
  );
};

const applyPlaceBuildingAfterValidation = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: PlaceBuildingCommand,
  definition: NonNullable<ReturnType<typeof findBuildableDefinition>>,
  resourceNodeId: string | undefined,
): CommandApplication => {
  const takenCost = consumeActorInventoryItem(
    snapshot,
    actor,
    command.commandId,
    definition.buildCostItemId,
    1,
  );

  return Match.value(takenCost).pipe(
    Match.when({ _tag: "rejected" }, ({ application }) => application),
    Match.orElse((takenCost) =>
      applyPlaceBuildingFromTakenCost(
        snapshot,
        command,
        takenCost,
        resourceNodeId,
      ),
    ),
  );
};

type InventoryConsumeResult = ReturnType<typeof consumeActorInventoryItem>;
type InventoryConsumeTaken = Extract<InventoryConsumeResult, { _tag: "taken" }>;

const applyPlaceBuildingFromTakenCost = (
  snapshot: WorldRuntimeSnapshot,
  command: PlaceBuildingCommand,
  takenCost: InventoryConsumeTaken,
  resourceNodeId: string | undefined,
): CommandApplication => {
  const objectId = crypto.randomUUID();
  const created = createPlacedBuildable(
    command.buildableId,
    objectId,
    command.origin,
    command.rotation,
  );

  return Match.value(created).pipe(
    Match.when(Match.undefined, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "unsupported_command",
        `${command.buildableId} is not supported yet`,
      ),
    ),
    Match.orElse((created) => {
      let object = created.object;
      switch (command.buildableId) {
        case "miner_v1":
          object = {
            ...created.object,
            resourceNodeId,
          };
          break;
        default:
          break;
      }

      let nextSnapshot = takenCost.snapshot;
      const changes: Array<WorldRuntimeChange> = [...takenCost.changes];

      for (const container of created.containers) {
        nextSnapshot = addContainer(nextSnapshot, container);
        changes.push({ _tag: "ContainerChanged", container });
      }

      const createdMachines = [created.machine].filter(
        (machine): machine is NonNullable<typeof machine> =>
          machine !== undefined,
      );

      for (const machine of createdMachines) {
        nextSnapshot = addMachine(nextSnapshot, machine);
        changes.push({ _tag: "MachineChanged", machine });
      }

      const createdGenerators = [created.generator].filter(
        (generator): generator is NonNullable<typeof generator> =>
          generator !== undefined,
      );

      for (const generator of createdGenerators) {
        nextSnapshot = addGenerator(nextSnapshot, generator);
        changes.push({
          _tag: "GeneratorChanged",
          generator,
        });
      }

      nextSnapshot = addObject(nextSnapshot, object);
      changes.push({ _tag: "RuntimeObjectChanged", object });

      return acceptCommand(nextSnapshot, command.commandId, changes);
    }),
  );
};

const fallbackDestinationContainerIdForObject = (
  destinationObject: RuntimePlacedObject,
) =>
  Match.value(destinationObject.buildableId).pipe(
    Match.when("modular_storage", () => modularStorageContainerId()),
    Match.orElse(() => undefined),
  );

const applyPlaceBeltRunForDistinctObjects = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: PlaceBeltRunCommand,
  sourceObject: RuntimePlacedObject,
  destinationObject: RuntimePlacedObject,
): CommandApplication => {
  const sourcePort = findPort(sourceObject, command.sourcePortId);
  const destinationPort = findPort(
    destinationObject,
    command.destinationPortId,
  );

  const resolvedPorts = Match.value({ destinationPort, sourcePort }).pipe(
    Match.when({ destinationPort: Match.undefined }, () => undefined),
    Match.when({ sourcePort: Match.undefined }, () => undefined),
    Match.orElse((resolved) => resolved),
  );

  return Match.value(resolvedPorts).pipe(
    Match.when(Match.undefined, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "invalid_target",
        "Source or destination port is missing",
      ),
    ),
    Match.orElse(({ destinationPort, sourcePort }) =>
      applyPlaceBeltRunWithResolvedPorts(
        snapshot,
        actor,
        command,
        sourceObject,
        destinationObject,
        sourcePort,
        destinationPort,
      ),
    ),
  );
};

const applyPlaceBeltRunWithResolvedPorts = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: PlaceBeltRunCommand,
  sourceObject: RuntimePlacedObject,
  destinationObject: RuntimePlacedObject,
  sourcePort: PortDefinition,
  destinationPort: PortDefinition,
): CommandApplication => {
  return Match.value(
    sourcePort.role === "output" && destinationPort.role === "input",
  ).pipe(
    Match.when(false, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "invalid_target",
        "Belts must connect one output port to one input port",
      ),
    ),
    Match.orElse(() =>
      applyPlaceBeltRunWithValidPortRoles(
        snapshot,
        actor,
        command,
        sourceObject,
        destinationObject,
      ),
    ),
  );
};

const applyPlaceBeltRunWithValidPortRoles = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: PlaceBeltRunCommand,
  sourceObject: RuntimePlacedObject,
  destinationObject: RuntimePlacedObject,
): CommandApplication => {
  const sourceOccupied = snapshot.transportLanes.some(
    (lane) =>
      lane.sourceObjectId === sourceObject.objectId &&
      lane.sourcePortId === command.sourcePortId,
  );
  const destinationOccupied = snapshot.transportLanes.some(
    (lane) =>
      lane.destinationObjectId === destinationObject.objectId &&
      lane.destinationPortId === command.destinationPortId,
  );

  return Match.value(sourceOccupied || destinationOccupied).pipe(
    Match.when(true, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "port_occupied",
        "Source or destination port already has a belt",
      ),
    ),
    Match.orElse(() =>
      applyPlaceBeltRunWithOpenPorts(
        snapshot,
        actor,
        command,
        sourceObject,
        destinationObject,
      ),
    ),
  );
};

const applyPlaceBeltRunWithOpenPorts = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: PlaceBeltRunCommand,
  sourceObject: RuntimePlacedObject,
  destinationObject: RuntimePlacedObject,
): CommandApplication => {
  const pathTiles = findBeltPath(
    snapshot,
    sourceObject,
    command.sourcePortId,
    destinationObject,
    command.destinationPortId,
  );
  const resolvedPathTiles = Match.value(pathTiles).pipe(
    Match.when(Match.undefined, () => []),
    Match.orElse((pathTiles) => pathTiles),
  );

  return Match.value(resolvedPathTiles.length === 0).pipe(
    Match.when(true, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "path_blocked",
        "No valid belt route exists between the selected ports",
      ),
    ),
    Match.orElse(() =>
      applyPlaceBeltRunWithPathTiles(
        snapshot,
        actor,
        command,
        sourceObject,
        destinationObject,
        resolvedPathTiles,
      ),
    ),
  );
};

const applyPlaceBeltRunWithPathTiles = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: PlaceBeltRunCommand,
  sourceObject: RuntimePlacedObject,
  destinationObject: RuntimePlacedObject,
  pathTiles: Array<RuntimePathTile>,
): CommandApplication => {
  const takenCost = consumeActorInventoryItem(
    snapshot,
    actor,
    command.commandId,
    "belt_v1",
    pathTiles.length,
  );

  return Match.value(takenCost).pipe(
    Match.when({ _tag: "rejected" }, ({ application }) => application),
    Match.orElse((takenCost) => {
      const sourceContainerId = sourceObject.containerIds.find(
        (containerId) => {
          const container = findContainer(snapshot, containerId);
          return (
            container?.owner.role === "machine_output" ||
            container?.owner.role === "container_output"
          );
        },
      );
      const fallbackDestinationContainerId =
        fallbackDestinationContainerIdForObject(destinationObject);
      const destinationContainerId =
        destinationObject.containerIds.find((containerId) => {
          const container = findContainer(snapshot, containerId);
          return (
            container?.owner.role === "machine_input" ||
            container?.owner.role === "quota_storage" ||
            container?.owner.role === "container_input"
          );
        }) ?? fallbackDestinationContainerId;

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

      return acceptCommand(nextSnapshot, command.commandId, [
        ...takenCost.changes,
        { _tag: "TransportLaneChanged", lane },
      ]);
    }),
  );
};

const applyPlaceBeltRunWithResolvedObjects = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: PlaceBeltRunCommand,
  sourceObject: RuntimePlacedObject,
  destinationObject: RuntimePlacedObject,
): CommandApplication =>
  Match.value(sourceObject.objectId === destinationObject.objectId).pipe(
    Match.when(true, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "invalid_command",
        "A belt cannot connect an object to itself",
      ),
    ),
    Match.orElse(() =>
      applyPlaceBeltRunForDistinctObjects(
        snapshot,
        actor,
        command,
        sourceObject,
        destinationObject,
      ),
    ),
  );

const applyPlaceBuildingOnBuildableTile = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: PlaceBuildingCommand,
  definition: NonNullable<ReturnType<typeof findBuildableDefinition>>,
): CommandApplication => {
  const occupiedByBlockingObject = (snapshot.objects ?? []).some((object) => {
    const isSameOrigin =
      object.origin.x === command.origin.x &&
      object.origin.y === command.origin.y;
    const isMinerOnResourceNode =
      command.buildableId === "miner_v1" && object.resourceNodeId !== undefined;

    return isSameOrigin && !isMinerOnResourceNode;
  });

  return Match.value(
    occupiedByBlockingObject || isBeltTileOccupied(snapshot, command.origin),
  ).pipe(
    Match.when(true, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "invalid_location",
        "Target tile is already occupied",
      ),
    ),
    Match.orElse(() =>
      applyPlaceBuildingOnFreeTile(snapshot, actor, command, definition),
    ),
  );
};

const applyPlaceBuildingForDefinition = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: PlaceBuildingCommand,
  definition: NonNullable<ReturnType<typeof findBuildableDefinition>>,
): CommandApplication => {
  const tile = findTile(snapshot, command.origin);

  return Match.value(tile).pipe(
    Match.when(Match.undefined, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "invalid_location",
        "Target tile is not buildable",
      ),
    ),
    Match.when({ buildable: false }, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "invalid_location",
        "Target tile is not buildable",
      ),
    ),
    Match.orElse(() =>
      applyPlaceBuildingOnBuildableTile(snapshot, actor, command, definition),
    ),
  );
};

const applyPlaceBuilding = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: PlaceBuildingCommand,
): CommandApplication => {
  const definition = findBuildableDefinition(command.buildableId);

  return Match.value(definition).pipe(
    Match.when(Match.undefined, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "unsupported_command",
        `${command.buildableId} is not supported yet`,
      ),
    ),
    Match.orElse((definition) =>
      applyPlaceBuildingForDefinition(snapshot, actor, command, definition),
    ),
  );
};

const applyPlaceBeltRun = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: PlaceBeltRunCommand,
): CommandApplication => {
  const sourceObject = findObject(snapshot, command.sourceObjectId);
  const destinationObject = findObject(snapshot, command.destinationObjectId);
  const resolvedObjects = Match.value({ destinationObject, sourceObject }).pipe(
    Match.when({ destinationObject: Match.undefined }, () => undefined),
    Match.when({ sourceObject: Match.undefined }, () => undefined),
    Match.orElse((resolved) => resolved),
  );

  return Match.value(resolvedObjects).pipe(
    Match.when(Match.undefined, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "object_missing",
        "Source or destination object is missing",
      ),
    ),
    Match.orElse(({ destinationObject, sourceObject }) =>
      applyPlaceBeltRunWithResolvedObjects(
        snapshot,
        actor,
        command,
        sourceObject,
        destinationObject,
      ),
    ),
  );
};

const applyRemoveBeltRun = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: RemoveBeltRunCommand,
): CommandApplication => {
  const lane = snapshot.transportLanes.find(
    (candidate) => candidate.laneId === command.beltRunId,
  );

  return Match.value(lane).pipe(
    Match.when(Match.undefined, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "object_missing",
        "Belt run is missing",
      ),
    ),
    Match.orElse((lane) => {
      const refunded = placeIntoInventoryOrDestroy(snapshot, actor, {
        itemId: "belt_v1",
        quantity: (lane.pathTiles ?? []).length,
      });
      const nextSnapshot = removeTransportLane(refunded.snapshot, lane.laneId);

      return acceptCommand(nextSnapshot, command.commandId, [
        ...refunded.changes,
        { _tag: "TransportLaneRemoved", laneId: lane.laneId },
      ]);
    }),
  );
};

const applyRemoveBuilding = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: RemoveBuildingCommand,
): CommandApplication => {
  const object = findObject(snapshot, command.objectId);

  if (object === undefined) {
    return rejectCommand(
      snapshot,
      command.commandId,
      "object_missing",
      "Object is missing",
    );
  }

  if (!object.removable) {
    return rejectCommand(
      snapshot,
      command.commandId,
      "object_not_removable",
      "Object is not removable",
    );
  }

  let nextSnapshot = snapshot;
  const changes: Array<WorldRuntimeChange> = [];

  for (const lane of snapshot.transportLanes.filter(
    (candidate) =>
      candidate.sourceObjectId === object.objectId ||
      candidate.destinationObjectId === object.objectId,
  )) {
    nextSnapshot = removeTransportLane(nextSnapshot, lane.laneId);
    changes.push({ _tag: "TransportLaneRemoved", laneId: lane.laneId });
    const refund = placeIntoInventoryOrDestroy(nextSnapshot, actor, {
      itemId: "belt_v1",
      quantity: (lane.pathTiles ?? []).length,
    });
    nextSnapshot = refund.snapshot;
    changes.push(...refund.changes);
  }

  for (const containerId of object.containerIds) {
    const container = findContainer(nextSnapshot, containerId);

    if (container !== undefined) {
      const stacks = Match.value(isSlotContainer(container)).pipe(
        Match.when(true, () => container.slots.flatMap(stackListFromSlot)),
        Match.orElse(() => container.entries),
      );

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

  const generator = findGenerator(nextSnapshot, object.objectId);

  const removedGeneratorId = Match.value(generator).pipe(
    Match.when(Match.undefined, () => undefined),
    Match.orElse((definedGenerator) => definedGenerator.generatorId),
  );

  nextSnapshot = Match.value(removedGeneratorId).pipe(
    Match.when(Match.undefined, () => nextSnapshot),
    Match.orElse((generatorId) => removeGenerator(nextSnapshot, generatorId)),
  );
  changes.push(
    ...Match.value(removedGeneratorId).pipe(
      Match.when(Match.undefined, () => []),
      Match.orElse((generatorId) => [
        {
          _tag: "GeneratorRemoved" as const,
          generatorId,
        },
      ]),
    ),
  );

  nextSnapshot = removeObject(nextSnapshot, object.objectId);
  changes.push({ _tag: "RuntimeObjectRemoved", objectId: object.objectId });

  const refund = placeIntoInventoryOrDestroy(nextSnapshot, actor, {
    itemId: object.buildableId,
    quantity: 1,
  });
  nextSnapshot = refund.snapshot;
  changes.push(...refund.changes);

  return acceptCommand(nextSnapshot, command.commandId, changes);
};

const updateTypedContainerAcceptedItems = (
  container: RuntimeContainer,
  acceptedItemIds: ReadonlyArray<string>,
) =>
  Match.value(isTypedContainer(container)).pipe(
    Match.when(true, () => ({
      ...container,
      acceptedItemIds: [...acceptedItemIds],
    })),
    Match.orElse(() => container),
  );

const applySetMachineRecipe = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: SetMachineRecipeCommand,
): CommandApplication => {
  const machine = findMachine(snapshot, command.machineId);

  if (machine === undefined) {
    return rejectCommand(
      snapshot,
      command.commandId,
      "object_missing",
      "Machine is missing",
    );
  }

  const machineDefinition = findMachineDefinition(machine.kind);

  if (machineDefinition === undefined) {
    return rejectCommand(
      snapshot,
      command.commandId,
      "invalid_command",
      `${machine.kind} has no machine definition`,
    );
  }

  if (
    machineDefinition.defaultRecipeId !== undefined &&
    machineDefinition.recipes.length <= 1
  ) {
    return rejectCommand(
      snapshot,
      command.commandId,
      "invalid_command",
      `${machine.kind} does not support recipe switching`,
    );
  }

  const nextRecipe = findMachineRecipe(machine.kind, command.recipeId);

  if (nextRecipe === undefined) {
    return rejectCommand(
      snapshot,
      command.commandId,
      "invalid_command",
      `Unsupported recipe ${command.recipeId}`,
    );
  }

  const inputContainerId = machine.inputContainerIds[0];
  const outputContainerId = machine.outputContainerIds[0];
  const inputContainer = findOptionalContainer(snapshot, inputContainerId);
  const outputContainer = findOptionalContainer(snapshot, outputContainerId);

  if (
    inputContainer === undefined ||
    outputContainer === undefined ||
    !isTypedContainer(inputContainer) ||
    !isTypedContainer(outputContainer)
  ) {
    return rejectCommand(
      snapshot,
      command.commandId,
      "container_missing",
      "Machine buffers are missing",
    );
  }

  let nextSnapshot = snapshot;
  const changes: Array<WorldRuntimeChange> = [];

  for (const entry of inputContainer.entries) {
    if (
      nextRecipe.input === undefined ||
      entry.itemId !== nextRecipe.input.itemId
    ) {
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

  const nextInputEntries = Match.value(nextRecipe.input).pipe(
    Match.when(Match.undefined, () => []),
    Match.orElse((input) =>
      inputContainer.entries.filter((entry) => entry.itemId === input.itemId),
    ),
  );
  const nextInputAcceptedItemIds = Match.value(nextRecipe.input).pipe(
    Match.when(Match.undefined, () => []),
    Match.orElse((input) => [input.itemId]),
  );

  const nextInputContainer = updateTypedContainerAcceptedItems(
    {
      ...inputContainer,
      entries: nextInputEntries,
    },
    nextInputAcceptedItemIds,
  );
  const nextOutputContainer = updateTypedContainerAcceptedItems(
    {
      ...outputContainer,
      entries: outputContainer.entries.filter(
        (entry) => entry.itemId === nextRecipe.output.itemId,
      ),
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

const activeRuntimePlayerCount = (snapshot: WorldRuntimeSnapshot) =>
  Math.max(
    1,
    snapshot.inventories.filter(
      (inventory) => inventory.actorPublicKey !== undefined,
    ).length,
  );

const skipVoteThreshold = (playerCount: number) => Math.ceil(playerCount / 2);

const applyInsertFuel = (
  snapshot: WorldRuntimeSnapshot,
  command: Extract<WorldCommand, { readonly _tag: "InsertFuel" }>,
): CommandApplication => {
  const directObject = findObject(snapshot, command.machineId);
  const machineObject = findMachine(snapshot, command.machineId)?.objectId;
  const machineTargetObject = Match.value(machineObject).pipe(
    Match.when(Match.undefined, () => undefined),
    Match.orElse((machineObject) => findObject(snapshot, machineObject)),
  );
  const targetObject = directObject ?? machineTargetObject;

  if (targetObject === undefined) {
    return rejectCommand(
      snapshot,
      command.commandId,
      "object_missing",
      "Fuel target is missing",
    );
  }

  const fuelContainerId = targetObject.containerIds.find((containerId) => {
    const container = findContainer(snapshot, containerId);
    return container?.owner.role === "burner_fuel";
  });

  if (fuelContainerId === undefined) {
    return rejectCommand(
      snapshot,
      command.commandId,
      "invalid_target",
      `${targetObject.objectId} has no fuel buffer`,
    );
  }

  return applyTransfer(snapshot, {
    _tag: "TransferItems",
    commandId: command.commandId,
    fromContainerId: command.fromContainerId,
    fromSlotIndex: command.fromSlotIndex,
    itemId: command.fuelItemId,
    quantity: command.quantity,
    toContainerId: fuelContainerId,
    toSlotIndex: undefined,
  });
};

const applyAdvanceBossChat = (
  snapshot: WorldRuntimeSnapshot,
  command: Extract<WorldCommand, { readonly _tag: "AdvanceBossChat" }>,
): CommandApplication => {
  if (command.phraseIndex !== snapshot.observers.bossChat.currentPhraseIndex) {
    return rejectCommand(
      snapshot,
      command.commandId,
      "invalid_command",
      `Boss chat is already at phrase ${snapshot.observers.bossChat.currentPhraseIndex}`,
    );
  }

  const observers: RuntimeObservers = {
    ...snapshot.observers,
    bossChat: {
      ...snapshot.observers.bossChat,
      currentPhraseIndex: snapshot.observers.bossChat.currentPhraseIndex + 1,
      skipVotes: [],
    },
  };

  return acceptCommand(
    {
      ...snapshot,
      observers,
    },
    command.commandId,
    [{ _tag: "ObserversChanged", observers }],
  );
};

const applyVoteSkipBossChat = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: Extract<WorldCommand, { readonly _tag: "VoteSkipBossChat" }>,
): CommandApplication => {
  const currentVotes = snapshot.observers.bossChat.skipVotes;

  if (currentVotes.includes(actor.publicKey)) {
    return acceptCommand(snapshot, command.commandId, []);
  }

  const nextVotes = [...currentVotes, actor.publicKey];
  const shouldAdvance =
    nextVotes.length >= skipVoteThreshold(activeRuntimePlayerCount(snapshot));
  const bossChatTransition = Match.value(shouldAdvance).pipe(
    Match.when(true, () => ({
      currentPhraseIndex: snapshot.observers.bossChat.currentPhraseIndex + 1,
      skipVotes: [] as Array<string>,
    })),
    Match.orElse(() => ({
      currentPhraseIndex: snapshot.observers.bossChat.currentPhraseIndex,
      skipVotes: nextVotes,
    })),
  );
  const observers: RuntimeObservers = {
    ...snapshot.observers,
    bossChat: {
      ...snapshot.observers.bossChat,
      currentPhraseIndex: bossChatTransition.currentPhraseIndex,
      skipVotes: bossChatTransition.skipVotes,
    },
  };

  return acceptCommand(
    {
      ...snapshot,
      observers,
    },
    command.commandId,
    [{ _tag: "ObserversChanged", observers }],
  );
};

const applyRestartPowerNetwork = (
  snapshot: WorldRuntimeSnapshot,
  command: RestartPowerNetworkCommand,
): CommandApplication => {
  const object = findObject(snapshot, command.objectId);

  return Match.value(object).pipe(
    Match.when(Match.undefined, () =>
      rejectCommand(
        snapshot,
        command.commandId,
        "object_missing",
        "Power restart target is missing",
      ),
    ),
    Match.orElse((object) =>
      applyRestartPowerNetworkForObject(snapshot, command, object),
    ),
  );
};

const applyRestartPowerNetworkForObject = (
  snapshot: WorldRuntimeSnapshot,
  command: RestartPowerNetworkCommand,
  object: RuntimePlacedObject,
): CommandApplication => {
  const network = snapshot.powerNetworks.find((candidate) =>
    candidate.memberObjectIds.includes(object.objectId),
  );

  if (network === undefined) {
    return rejectCommand(
      snapshot,
      command.commandId,
      "network_missing",
      `${object.objectId} is not on a power network`,
    );
  }

  const nextNetwork: RuntimePowerNetwork = {
    ...network,
    restartRequested: true,
  };
  const powerNetworks = snapshot.powerNetworks.map((candidate) =>
    Match.value(candidate.networkId === nextNetwork.networkId).pipe(
      Match.when(true, () => nextNetwork),
      Match.orElse(() => candidate),
    ),
  );

  return acceptCommand(
    replacePowerNetworks(snapshot, powerNetworks),
    command.commandId,
    [{ _tag: "PowerNetworkChanged", network: nextNetwork }],
  );
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
    case "InsertFuel":
      return applyInsertFuel(snapshot, command);
    case "TakeFromContainer":
      return applyTakeFromContainer(snapshot, actor, command);
    case "AdvanceBossChat":
      return applyAdvanceBossChat(snapshot, command);
    case "RestartPowerNetwork":
      return applyRestartPowerNetwork(snapshot, command);
    case "VoteSkipBossChat":
      return applyVoteSkipBossChat(snapshot, actor, command);
  }
};

export const applyWorldCommand = Effect.fn("api.worldRuntime.applyWorldCommand")(function* (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: WorldCommand,
) {
  return yield* Effect.succeed(applyCommand(snapshot, actor, command));
});

const machineRecipeFor = (machine: WorldRuntimeSnapshot["machines"][number]) =>
  findMachineRecipe(machine.kind, machine.recipeId);

const machineChanged = (
  left: WorldRuntimeSnapshot["machines"][number],
  right: WorldRuntimeSnapshot["machines"][number],
) =>
  left.networkId !== right.networkId ||
  left.status !== right.status ||
  left.powerState !== right.powerState ||
  left.progress !== right.progress ||
  left.recipeId !== right.recipeId;

const generatorChanged = (left: RuntimeGenerator, right: RuntimeGenerator) =>
  left.currentOutputMw !== right.currentOutputMw ||
  left.fuelBurnProgress !== right.fuelBurnProgress ||
  left.networkId !== right.networkId ||
  left.status !== right.status;

const powerNetworkChanged = (
  left: RuntimePowerNetwork,
  right: RuntimePowerNetwork,
) => JSON.stringify(left) !== JSON.stringify(right);

const machinePowerDrawMw = (
  machine: WorldRuntimeSnapshot["machines"][number],
) => findMachineDefinition(machine.kind)?.powerDrawMw ?? 0;

const tileCoveredByRadius = (
  origin: GridCoordinate,
  coordinate: GridCoordinate,
  radius: number,
) =>
  Math.abs(origin.x - coordinate.x) + Math.abs(origin.y - coordinate.y) <=
  radius;

const coverageTilesForGenerator = (
  snapshot: WorldRuntimeSnapshot,
  generator: RuntimeGenerator,
) => {
  const object = findObject(snapshot, generator.objectId);

  return Match.value(object).pipe(
    Match.when(Match.undefined, () => []),
    Match.orElse((object) =>
      (snapshot.tiles ?? [])
        .filter((tile) =>
          tileCoveredByRadius(
            object.origin,
            tile.coordinate,
            generator.powerRadius,
          ),
        )
        .map((tile) => tile.coordinate),
    ),
  );
};

const containerCanAccept = (
  snapshot: WorldRuntimeSnapshot,
  container: RuntimeContainer,
  stack: RuntimeItemStack,
) => {
  return Match.value(isSlotContainer(container)).pipe(
    Match.when(true, () =>
      container.slots.some(
        (slot) =>
          slot.stack === undefined || slot.stack.itemId === stack.itemId,
      ),
    ),
    Match.orElse(
      () => putIntoTypedContainer(snapshot, container, stack)._tag === "placed",
    ),
  );
};

const machineCouldRunThisTick = (
  snapshot: WorldRuntimeSnapshot,
  machine: WorldRuntimeSnapshot["machines"][number],
) => {
  const recipe = machineRecipeFor(machine);

  if (recipe === undefined) {
    return false;
  }

  const outputContainerId = machine.outputContainerIds[0];
  const outputContainer = Match.value(outputContainerId).pipe(
    Match.when(Match.undefined, () => undefined),
    Match.orElse((outputContainerId) =>
      findContainer(snapshot, outputContainerId),
    ),
  );

  if (
    outputContainer === undefined ||
    !containerCanAccept(snapshot, outputContainer, recipe.output)
  ) {
    return false;
  }

  if (machine.progress > 0) {
    return true;
  }

  if (recipe.input === undefined) {
    return true;
  }

  const recipeInput = recipe.input;

  const inputContainerId = machine.inputContainerIds[0];
  const inputContainer = Match.value(inputContainerId).pipe(
    Match.when(Match.undefined, () => undefined),
    Match.orElse((inputContainerId) =>
      findContainer(snapshot, inputContainerId),
    ),
  );

  if (inputContainer === undefined) {
    return false;
  }

  const availableQuantity = availableQuantityInContainer(
    inputContainer,
    recipeInput.itemId,
  );

  return availableQuantity >= recipeInput.quantity;
};

const generatorFuelEntry = (
  snapshot: WorldRuntimeSnapshot,
  generator: RuntimeGenerator,
) => {
  const container = findContainer(snapshot, generator.fuelContainerId);

  if (container === undefined || !isTypedContainer(container)) {
    return undefined;
  }

  const entry = container.entries.find(
    (candidate) =>
      candidate.quantity > 0 &&
      container.acceptedItemIds.includes(candidate.itemId),
  );

  if (entry === undefined) {
    return undefined;
  }

  return {
    container,
    entry,
  };
};

const progressMachineWork = (
  snapshot: WorldRuntimeSnapshot,
): {
  readonly changes: ReadonlyArray<WorldRuntimeChange>;
  readonly snapshot: WorldRuntimeSnapshot;
} => {
  let nextSnapshot = snapshot;
  const changes: Array<WorldRuntimeChange> = [];

  for (const machine of snapshot.machines) {
    const recipe = machineRecipeFor(machine);

    if (recipe === undefined) {
      if (machine.status !== "idle" || machine.progress !== 0) {
        const nextStatus = Match.value(machine.powerState === "connected").pipe(
          Match.when(true, () => "idle" as const),
          Match.orElse(() => "unpowered" as const),
        );
        const nextMachine = {
          ...machine,
          progress: 0,
          status: nextStatus,
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
      const inputContainer = findOptionalContainer(
        nextSnapshot,
        inputContainerId,
      );

      if (inputContainer === undefined) {
        nextMachine = {
          ...machine,
          status: "idle",
        };
      } else {
        const taken = Match.value(isSlotContainer(inputContainer)).pipe(
          Match.when(true, () =>
            takeFromSlotContainer(
              inputContainer,
              recipe.input.itemId,
              recipe.input.quantity,
              undefined,
            ),
          ),
          Match.orElse(() =>
            takeFromTypedContainer(
              inputContainer,
              recipe.input.itemId,
              recipe.input.quantity,
            ),
          ),
        );

        if (taken._tag === "rejected") {
          nextMachine = {
            ...machine,
            status: "idle",
          };
        } else {
          nextSnapshot = replaceContainer(nextSnapshot, taken.container);
          changes.push({
            _tag: "ContainerChanged",
            container: taken.container,
          });
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
      const outputContainer = findOptionalContainer(
        nextSnapshot,
        outputContainerId,
      );

      if (outputContainer === undefined) {
        nextMachine = {
          ...nextMachine,
          progress: 1,
          status: "blocked",
        };
      } else {
        const placed = Match.value(isSlotContainer(outputContainer)).pipe(
          Match.when(true, () =>
            putIntoSlotContainer(outputContainer, recipe.output, undefined),
          ),
          Match.orElse(() =>
            putIntoTypedContainer(nextSnapshot, outputContainer, recipe.output),
          ),
        );

        if (placed._tag === "rejected") {
          nextMachine = {
            ...nextMachine,
            progress: 1,
            status: "blocked",
          };
        } else {
          nextSnapshot = replaceContainer(nextSnapshot, placed.container);
          changes.push({
            _tag: "ContainerChanged",
            container: placed.container,
          });

          if ("observersChanged" in placed && placed.observersChanged) {
            nextSnapshot = {
              ...nextSnapshot,
              observers: placed.observers,
            };
            changes.push({
              _tag: "ObserversChanged",
              observers: placed.observers,
            });
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

const sortLaneItems = (
  items: WorldRuntimeSnapshot["transportLanes"][number]["items"],
) => [...items].sort((left, right) => right.progress - left.progress);

const laneProgressStep = (
  lane: WorldRuntimeSnapshot["transportLanes"][number],
) =>
  Match.value(lane.length <= 0).pipe(
    Match.when(true, () => lane.speed),
    Match.orElse(() => lane.speed / lane.length),
  );

const laneDidChange = (
  left: WorldRuntimeSnapshot["transportLanes"][number],
  right: WorldRuntimeSnapshot["transportLanes"][number],
) =>
  left.items.length !== right.items.length ||
  left.items.some((item, index) => {
    const other = right.items[index];
    return (
      other === undefined ||
      other.itemId !== item.itemId ||
      other.progress !== item.progress
    );
  });

const advanceLaneItems = (
  lane: WorldRuntimeSnapshot["transportLanes"][number],
) => {
  const sortedItems = sortLaneItems(lane.items);
  const progressStep = laneProgressStep(lane);
  let leadProgress = Number.POSITIVE_INFINITY;

  return sortedItems.map((item) => {
    const maxProgress = Match.value(Number.isFinite(leadProgress)).pipe(
      Match.when(true, () => Math.max(0, leadProgress - lane.itemSpacing)),
      Match.orElse(() => 1),
    );
    const progress = Math.min(
      1,
      Math.min(item.progress + progressStep, maxProgress),
    );
    leadProgress = progress;
    return {
      ...item,
      progress,
    };
  });
};

const executeTransport = (
  snapshot: WorldRuntimeSnapshot,
): {
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

    const destinationContainer = findOptionalContainer(
      nextSnapshot,
      nextLane.destinationId,
    );
    const headItem = sortLaneItems(nextLane.items)[0];

    if (
      destinationContainer !== undefined &&
      headItem !== undefined &&
      headItem.progress >= 1
    ) {
      const placed = Match.value(isSlotContainer(destinationContainer)).pipe(
        Match.when(true, () =>
          putIntoSlotContainer(
            destinationContainer,
            { itemId: headItem.itemId, quantity: 1 },
            undefined,
          ),
        ),
        Match.orElse(() =>
          putIntoTypedContainer(nextSnapshot, destinationContainer, {
            itemId: headItem.itemId,
            quantity: 1,
          }),
        ),
      );

      if (placed._tag === "placed") {
        nextSnapshot = replaceContainer(nextSnapshot, placed.container);
        changes.push({ _tag: "ContainerChanged", container: placed.container });

        if ("observersChanged" in placed && placed.observersChanged) {
          nextSnapshot = {
            ...nextSnapshot,
            observers: placed.observers,
          };
          changes.push({
            _tag: "ObserversChanged",
            observers: placed.observers,
          });
        }

        nextLane = {
          ...nextLane,
          items: sortLaneItems(nextLane.items).slice(1),
        };
      }
    }

    const tailProgress = sortLaneItems(nextLane.items).at(-1)?.progress;
    const canPull =
      tailProgress === undefined || tailProgress >= nextLane.itemSpacing;
    const sourceContainer = findOptionalContainer(
      nextSnapshot,
      nextLane.sourceId,
    );

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

const shouldCheckpoint = (snapshot: WorldRuntimeSnapshot) =>
  snapshot.tick > 0 && snapshot.tick % checkpointEveryTicks === 0;

const startTickPhase = (
  snapshot: WorldRuntimeSnapshot,
  now: number,
): TickPhaseState => ({
  changes: [],
  pendingReceipts: [],
  snapshot: {
    ...snapshot,
    lastTickAt: new Date(now).toISOString(),
    tick: snapshot.tick + 1,
  },
});

const applyCommandPhase = (
  state: TickPhaseState,
  commands: ReadonlyArray<QueuedWorldCommand>,
): TickPhaseState => {
  let nextState = state;

  for (const queued of commands) {
    const applied = applyCommand(
      nextState.snapshot,
      queued.actor,
      queued.command,
    );
    nextState = {
      changes: [...nextState.changes, ...applied.changes],
      pendingReceipts: [
        ...nextState.pendingReceipts,
        {
          cacheKey: queued.cacheKey,
          deferred: queued.result,
          pendingReceipt: applied.pendingReceipt,
        },
      ],
      snapshot: applied.snapshot,
    };
  }

  return nextState;
};

const recomputePowerPhase = (state: TickPhaseState): TickPhaseState => {
  const previousSnapshot = state.snapshot;
  const previousNetworks = new Map(
    previousSnapshot.powerNetworks.map((network) => [
      network.networkId,
      network,
    ]),
  );
  const updatedGenerators = new Map<string, RuntimeGenerator>(
    previousSnapshot.generators.map((generator) => {
      const nextStatus = Match.value(
        generatorFuelEntry(previousSnapshot, generator),
      ).pipe(
        Match.when(Match.undefined, () => "out_of_fuel" as const),
        Match.orElse(() => "idle" as const),
      );

      return [
        generator.generatorId,
        {
          ...generator,
          currentOutputMw: 0,
          networkId: undefined,
          status: nextStatus,
        },
      ] as const;
    }),
  );
  const updatedMachines = new Map<
    string,
    WorldRuntimeSnapshot["machines"][number]
  >(
    previousSnapshot.machines.map((machine) => [
      machine.machineId,
      {
        ...machine,
        networkId: undefined,
        powerState: "disconnected" as const,
        status: "unpowered" as const,
      },
    ]),
  );
  const poweredGenerators = previousSnapshot.generators.flatMap((generator) => {
    const fuel = generatorFuelEntry(previousSnapshot, generator);

    if (fuel === undefined) {
      return [];
    }

    const coverage = coverageTilesForGenerator(previousSnapshot, generator);

    return Match.value(coverage.length === 0).pipe(
      Match.when(true, () => []),
      Match.orElse(
        () =>
          [
            {
              coverage,
              coverageKeys: new Set(coverage.map(tileKey)),
              generator,
            },
          ] as const,
      ),
    );
  });
  const visited = new Set<string>();
  const components: Array<ReadonlyArray<(typeof poweredGenerators)[number]>> =
    [];

  for (const candidate of poweredGenerators) {
    if (visited.has(candidate.generator.generatorId)) {
      continue;
    }

    const component: Array<(typeof poweredGenerators)[number]> = [];
    const queue = [candidate];
    visited.add(candidate.generator.generatorId);

    while (queue.length > 0) {
      const current = queue.shift();

      if (current === undefined) {
        continue;
      }

      component.push(current);

      for (const neighbor of poweredGenerators) {
        if (visited.has(neighbor.generator.generatorId)) {
          continue;
        }

        const overlaps = [...current.coverageKeys].some((coordinateKey) =>
          neighbor.coverageKeys.has(coordinateKey),
        );

        if (!overlaps) {
          continue;
        }

        visited.add(neighbor.generator.generatorId);
        queue.push(neighbor);
      }
    }

    components.push(component);
  }

  const nextNetworks: Array<RuntimePowerNetwork> = [];

  for (const component of components) {
    const energizedTilesMap = new Map<string, GridCoordinate>();

    for (const entry of component) {
      for (const coordinate of entry.coverage) {
        energizedTilesMap.set(tileKey(coordinate), coordinate);
      }
    }

    const energizedTiles = [...energizedTilesMap.values()];
    const coverageKeys = new Set(energizedTiles.map(tileKey));
    const generators = component.map((entry) => entry.generator);
    const networkId = `network:${generators
      .map((generator) => generator.generatorId)
      .sort()
      .join("|")}`;
    const memberObjects = (previousSnapshot.objects ?? []).flatMap((object) =>
      Match.value(coverageKeys.has(tileKey(object.origin))).pipe(
        Match.when(true, () => [object]),
        Match.orElse(() => []),
      ),
    );
    const machines = previousSnapshot.machines.flatMap((machine) => {
      const objectId = machine.objectId;

      if (objectId === undefined) {
        return [];
      }

      return Match.value(
        memberObjects.some((object) => object.objectId === objectId),
      ).pipe(
        Match.when(true, () => [machine]),
        Match.orElse(() => []),
      );
    });
    const maxPotentialCapacity = generators.reduce(
      (total, generator) => total + generator.maxCapacityMw,
      0,
    );
    const maxPotentialConsumption = machines.reduce(
      (total, machine) => total + machinePowerDrawMw(machine),
      0,
    );
    const currentConsumption = machines.reduce(
      (total, machine) =>
        total +
        Match.value(machineCouldRunThisTick(previousSnapshot, machine)).pipe(
          Match.when(true, () => machinePowerDrawMw(machine)),
          Match.orElse(() => 0),
        ),
      0,
    );
    const previousNetwork = previousNetworks.get(networkId);
    const shouldTryRestart =
      previousNetwork === undefined ||
      previousNetwork.status !== "tripped" ||
      previousNetwork.restartRequested;
    const status = Match.value(
      shouldTryRestart && currentConsumption <= maxPotentialCapacity,
    ).pipe(
      Match.when(true, (): RuntimePowerNetwork["status"] => "energized"),
      Match.orElse((): RuntimePowerNetwork["status"] => "tripped"),
    );
    const currentProduction = Match.value(status).pipe(
      Match.when("energized", () => currentConsumption),
      Match.orElse(() => 0),
    );

    const network: RuntimePowerNetwork = {
      currentConsumption,
      currentProduction,
      energizedTiles,
      maxPotentialCapacity,
      maxPotentialConsumption,
      memberObjectIds: memberObjects.map((object) => object.objectId),
      networkId,
      restartRequested: false,
      status,
    };

    nextNetworks.push(network);

    for (const machine of machines) {
      const nextMachine = updatedMachines.get(machine.machineId);

      if (nextMachine === undefined) {
        continue;
      }

      const nextPowerState = Match.value(status).pipe(
        Match.when("energized", () => "connected"),
        Match.orElse(() => "unpowered"),
      );
      const nextMachineStatus = Match.value({
        previousStatus: nextMachine.status,
        status,
      }).pipe(
        Match.when({ status: "tripped" }, () => "unpowered"),
        Match.when(
          { previousStatus: "unpowered", status: "energized" },
          () => "idle",
        ),
        Match.orElse(({ previousStatus }) => previousStatus),
      );

      updatedMachines.set(machine.machineId, {
        ...nextMachine,
        networkId,
        powerState: nextPowerState,
        status: nextMachineStatus,
      });
    }

    for (const generator of generators) {
      const nextGenerator = updatedGenerators.get(generator.generatorId);

      if (nextGenerator === undefined) {
        continue;
      }

      const outputShare = Match.value({
        hasCapacity: maxPotentialCapacity > 0,
        status,
      }).pipe(
        Match.when(
          { hasCapacity: true, status: "energized" },
          () =>
            currentProduction *
            (generator.maxCapacityMw / maxPotentialCapacity),
        ),
        Match.orElse(() => 0),
      );
      const nextGeneratorStatus = Match.value({
        hasOutput: outputShare > 0,
        status,
      }).pipe(
        Match.when({ status: "tripped" }, () => "tripped"),
        Match.when({ hasOutput: true, status: "energized" }, () => "running"),
        Match.orElse(() => "idle"),
      );
      updatedGenerators.set(generator.generatorId, {
        ...nextGenerator,
        currentOutputMw: outputShare,
        networkId,
        status: nextGeneratorStatus,
      });
    }
  }

  let nextSnapshot: WorldRuntimeSnapshot = {
    ...previousSnapshot,
    generators: previousSnapshot.generators.map(
      (generator) => updatedGenerators.get(generator.generatorId) ?? generator,
    ),
    machines: previousSnapshot.machines.map(
      (machine) => updatedMachines.get(machine.machineId) ?? machine,
    ),
    powerNetworks: nextNetworks,
  };
  const changes: Array<WorldRuntimeChange> = [...state.changes];

  for (const { definition, generator } of nextSnapshot.generators.flatMap(
    (generator) =>
      Match.value({
        definition: findGeneratorDefinition(generator.kind),
        generator,
        shouldProcess: generator.currentOutputMw > 0,
      }).pipe(
        Match.when(
          {
            definition: Match.defined,
            generator: Match.defined,
            shouldProcess: true,
          },
          ({ definition, generator }) => [{ definition, generator }],
        ),
        Match.orElse(() => []),
      ),
  )) {
    const container = findContainer(nextSnapshot, generator.fuelContainerId);

    if (container === undefined || !isTypedContainer(container)) {
      continue;
    }

    const nextFuelBurnProgress =
      generator.fuelBurnProgress +
      generator.currentOutputMw /
        generator.maxCapacityMw /
        definition.fuelTicksPerItemAtFullLoad;
    const consumedFuel = Math.floor(nextFuelBurnProgress);
    const remainingFuelBurnProgress = nextFuelBurnProgress - consumedFuel;
    const nextGenerator = {
      ...generator,
      fuelBurnProgress: remainingFuelBurnProgress,
    };

    if (consumedFuel > 0) {
      const fuelEntry = container.entries.find(
        (entry) =>
          entry.quantity > 0 &&
          container.acceptedItemIds.includes(entry.itemId),
      );

      if (fuelEntry !== undefined) {
        const nextQuantity = Math.max(0, fuelEntry.quantity - consumedFuel);
        const nextEntries = Match.value(nextQuantity === 0).pipe(
          Match.when(true, () =>
            container.entries.filter(
              (entry) => entry.itemId !== fuelEntry.itemId,
            ),
          ),
          Match.orElse(() =>
            container.entries.map((entry) => {
              if (entry.itemId === fuelEntry.itemId) {
                return {
                  itemId: entry.itemId,
                  quantity: nextQuantity,
                };
              }

              return entry;
            }),
          ),
        );
        const nextContainer: TypedContainer = {
          ...container,
          entries: nextEntries,
        };
        nextSnapshot = replaceContainer(nextSnapshot, nextContainer);
        changes.push({ _tag: "ContainerChanged", container: nextContainer });
      }
    }

    const previousGenerator = previousSnapshot.generators.find(
      (candidate) => candidate.generatorId === generator.generatorId,
    );

    if (
      previousGenerator !== undefined &&
      generatorChanged(previousGenerator, nextGenerator)
    ) {
      nextSnapshot = replaceGenerator(nextSnapshot, nextGenerator);
    }
  }

  for (const machine of nextSnapshot.machines) {
    const previousMachine = previousSnapshot.machines.find(
      (candidate) => candidate.machineId === machine.machineId,
    );

    if (
      previousMachine !== undefined &&
      machineChanged(previousMachine, machine)
    ) {
      changes.push({ _tag: "MachineChanged", machine });
    }
  }

  for (const generator of nextSnapshot.generators) {
    const previousGenerator = previousSnapshot.generators.find(
      (candidate) => candidate.generatorId === generator.generatorId,
    );

    if (
      previousGenerator !== undefined &&
      generatorChanged(previousGenerator, generator)
    ) {
      changes.push({ _tag: "GeneratorChanged", generator });
    }
  }

  for (const network of nextNetworks) {
    const previousNetwork = previousNetworks.get(network.networkId);

    if (
      previousNetwork === undefined ||
      powerNetworkChanged(previousNetwork, network)
    ) {
      changes.push({ _tag: "PowerNetworkChanged", network });
    }
  }

  for (const previousNetwork of previousSnapshot.powerNetworks) {
    if (
      !nextNetworks.some(
        (network) => network.networkId === previousNetwork.networkId,
      )
    ) {
      changes.push({
        _tag: "PowerNetworkRemoved",
        networkId: previousNetwork.networkId,
      });
    }
  }

  return {
    ...state,
    changes,
    snapshot: nextSnapshot,
  };
};

const recomputePowerState = (snapshot: WorldRuntimeSnapshot) => {
  const result = recomputePowerPhase({
    changes: [],
    pendingReceipts: [],
    snapshot,
  });

  return {
    changes: result.changes,
    snapshot: result.snapshot,
  };
};

export const progressWorldMachineWork = Effect.fn("api.worldRuntime.progressWorldMachineWork")(function* (
  snapshot: WorldRuntimeSnapshot,
) {
  return yield* Effect.succeed(progressMachineWork(snapshot));
});

export const executeWorldTransport = Effect.fn("api.worldRuntime.executeWorldTransport")(function* (
  snapshot: WorldRuntimeSnapshot,
) {
  return yield* Effect.succeed(executeTransport(snapshot));
});

export const recomputeWorldPowerState = Effect.fn("api.worldRuntime.recomputeWorldPowerState")(function* (
  snapshot: WorldRuntimeSnapshot,
) {
  return yield* Effect.succeed(recomputePowerState(snapshot));
});

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
  const afterCommands = applyCommandPhase(
    startTickPhase(currentSnapshot, now),
    commands,
  );
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
    receipts: finalPhaseState.pendingReceipts.map(
      ({ cacheKey, deferred, pendingReceipt }) => ({
        cacheKey,
        deferred,
        receipt: materializeReceipt(
          worldId,
          finalSnapshot.tick,
          deltaSequence,
          pendingReceipt,
        ),
      }),
    ),
    snapshot: finalSnapshot,
  };
};

const applyCommandPhaseWithSpans = Effect.fn(
  "api.worldRuntime.phase.apply_command",
)(function* (
  state: TickPhaseState,
  commands: ReadonlyArray<QueuedWorldCommand>,
  now: number,
) {
  let nextState = state;

  for (const queued of commands) {
    const queueWaitMs = Math.max(0, now - queued.enqueuedAtMs);
    const applied = yield* Effect.sync(() =>
      applyCommand(nextState.snapshot, queued.actor, queued.command),
    ).pipe(
      Effect.withSpan(`api.worldRuntime.command.apply.${queued.command._tag}`, {
        attributes: {
          "command.id": queued.command.commandId,
          "command.tag": queued.command._tag,
          "command.queue_wait_ms": queueWaitMs,
          "world.id": nextState.snapshot.worldId,
        },
      }),
    );
    nextState = {
      changes: [...nextState.changes, ...applied.changes],
      pendingReceipts: [
        ...nextState.pendingReceipts,
        {
          cacheKey: queued.cacheKey,
          deferred: queued.result,
          pendingReceipt: applied.pendingReceipt,
        },
      ],
      snapshot: applied.snapshot,
    };
  }

  return nextState;
});

const recomputePowerPhaseWithSpans = Effect.fn(
  "api.worldRuntime.phase.recompute_power",
)(function* (
  state: TickPhaseState,
) {
  return yield* Effect.sync(() => recomputePowerPhase(state));
});

const progressMachinesPhaseWithSpans = Effect.fn(
  "api.worldRuntime.phase.progress_machines",
)(function* (
  state: TickPhaseState,
) {
  return yield* Effect.sync(() => progressMachinesPhase(state));
});

const transportPhaseWithSpans = Effect.fn(
  "api.worldRuntime.phase.transport",
)(function* (
  state: TickPhaseState,
) {
  return yield* Effect.sync(() => transportPhase(state));
});

const materializeReceiptWithSpan = Effect.fn(
  "api.worldRuntime.command.receipt.materialize",
)(function* (
  worldId: string,
  tick: number,
  deltaSequence: number,
  pendingReceipt: PendingCommandReceipt,
) {
  const receipt = materializeReceipt(worldId, tick, deltaSequence, pendingReceipt);
  yield* Effect.annotateCurrentSpan({
    "command.id": pendingReceipt.commandId,
    "command.tag": receipt._tag,
    "receipt.status": receipt.status,
    tick,
    "world.id": worldId,
  });
  return receipt;
});

const applyTickWithSpans = Effect.fn(
  "api.worldRuntime.tick.compute",
)(function* (
  currentSnapshot: WorldRuntimeSnapshot,
  commands: ReadonlyArray<QueuedWorldCommand>,
  now: number,
  worldId: string,
) {
  const afterCommands = yield* applyCommandPhaseWithSpans(
    startTickPhase(currentSnapshot, now),
    commands,
    now,
  );
  const afterPower = yield* recomputePowerPhaseWithSpans(afterCommands);
  const afterMachines = yield* progressMachinesPhaseWithSpans(afterPower);
  const afterTransport = yield* transportPhaseWithSpans(afterMachines);
  const afterStorage = storageAcceptancePhase(afterTransport);
  const finalPhaseState = observerUpdatePhase(afterStorage);

  if (finalPhaseState.changes.length === 0) {
    return {
      delta: undefined,
      receipts: [],
      snapshot: finalPhaseState.snapshot,
    } satisfies TickResult;
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
  const receipts = yield* Effect.forEach(
    finalPhaseState.pendingReceipts,
    ({ cacheKey, deferred, pendingReceipt }) =>
      Effect.map(
        materializeReceiptWithSpan(
          worldId,
          finalSnapshot.tick,
          deltaSequence,
          pendingReceipt,
        ),
        (receipt) => ({
          cacheKey,
          deferred,
          receipt,
        }),
      ),
    {
      concurrency: "unbounded",
    },
  );

  return {
    delta,
    receipts,
    snapshot: finalSnapshot,
  } satisfies TickResult;
});

const runWorldLoop = Effect.fn("api.worldRuntime.runWorldLoop")(function* (
  runtime: LoadedWorldRuntime,
  checkpoints: RuntimeCheckpointStore["Service"],
) {
  while (true) {
    yield* Effect.sleep("100 millis");
    const now = yield* Clock.currentTimeMillis;
    const commands = yield* Queue.takeAll(runtime.commandQueue);
    const result = yield* Match.value(commands.length > 0).pipe(
      Match.when(true, () =>
        Effect.gen(function* () {
          const snapshot = yield* Ref.get(runtime.state);
          const commandTags = commandTagSummary(commands);
          const tickResult = yield* applyTickWithSpans(
            snapshot,
            commands,
            now,
            runtime.worldId,
          ).pipe(
            Effect.withSpan("api.worldRuntime.tick", {
              attributes: {
                "command.count": commands.length,
                "command.tags": commandTags,
                "world.id": runtime.worldId,
              },
            }),
            Effect.tap((computed) =>
              Effect.annotateCurrentSpan({
                "delta.emitted": computed.delta !== undefined,
                tick: computed.snapshot.tick,
              }),
            ),
          );

          yield* Ref.set(runtime.state, tickResult.snapshot);
          return tickResult;
        }),
      ),
      Match.orElse(() =>
        Ref.modify(runtime.state, (snapshot) => {
          const next = applyTick(snapshot, commands, now, runtime.worldId);
          return [next, next.snapshot] as const;
        }),
      ),
    );

    if (commands.length === 0 && result.delta !== undefined) {
      yield* Effect.void.pipe(
        Effect.withSpan("api.worldRuntime.tick", {
          attributes: {
            "command.count": 0,
            "command.tags": "",
            "delta.emitted": true,
            tick: result.snapshot.tick,
            "world.id": runtime.worldId,
          },
        }),
      );
    }

    if (result.delta !== undefined) {
      yield* SubscriptionRef.set(runtime.liveSnapshot, result.snapshot);
      yield* PubSub.publish(runtime.deltas, result.delta);
    }

    if (shouldCheckpoint(result.snapshot)) {
      yield* checkpoints
        .save(result.snapshot, new Date(now).toISOString())
        .pipe(
          Effect.catchTag("StorageError", (error) =>
            Effect.logWarning(
              `runtime checkpoint save failed: ${error.operation}`,
            ),
          ),
        );
    }

    yield* Effect.forEach(
      result.receipts,
      ({ cacheKey, deferred, receipt }) =>
        Effect.flatMap(
          SynchronizedRef.update(runtime.commandReceipts, (current) => {
            const existing = current.get(cacheKey);

            if (existing === undefined) {
              return current;
            }

            const next = new Map(current);
            next.set(cacheKey, {
              _tag: "resolved",
              payloadKey: existing.payloadKey,
              receipt,
            });
            return next;
          }),
          () => Deferred.succeed(deferred, receipt),
        ),
      {
        concurrency: 1,
        discard: true,
      },
    );
  }
});

const hasRuntimeMembership = (snapshot: WorldSnapshot, actor: ActorContext) =>
  snapshot.roster.some((slot) => slot.reservedByProfileId === actor.publicKey);

const makeWorldRuntimeService = Effect.gen(function* () {
  const scope = yield* Effect.scope;
  const checkpoints = yield* RuntimeCheckpointStore;
  const worlds = yield* WorldRepository;
  const registry = yield* SynchronizedRef.make<
    ReadonlyMap<string, LoadedWorldRuntime>
  >(new Map<string, LoadedWorldRuntime>());
  const toRuntimeFailure = (
    worldId: string,
    message: string,
    error: PersistenceDecodeError | StorageError,
  ) =>
    new RuntimeEngineError({
      cause: error.cause,
      message,
      worldId,
    });

  const failIfDefined = (
    error: WorldAccessDeniedError | WorldRuntimeUnavailableError | undefined,
  ) =>
    Match.value(error).pipe(
      Match.when(Match.undefined, () => Effect.void),
      Match.orElse((definedError) => Effect.fail(definedError)),
    );

  const buildLoadedRuntime = Effect.fn("api.worldRuntime.buildLoadedRuntime")(function* (
    current: ReadonlyMap<string, LoadedWorldRuntime>,
    world: ReadyWorld,
  ) {
    const checkpointOption = yield* checkpoints
      .loadLatest(world.worldId)
      .pipe(
        Effect.mapError((error) =>
          toRuntimeFailure(
            world.worldId,
            "Failed to load runtime checkpoint",
            error,
          ),
        ),
      );
    const initialState = yield* Option.match(checkpointOption, {
      onNone: () => buildInitialRuntimeSnapshot(world),
      onSome: (checkpoint: WorldRuntimeCheckpoint) =>
        Effect.succeed(normalizeRuntimeSnapshot(checkpoint.snapshot)),
    });
    const state = yield* Ref.make(initialState);
    const liveSnapshot = yield* SubscriptionRef.make(initialState);
    const commandQueue = yield* Queue.make<QueuedWorldCommand>({
      capacity: commandQueueCapacity,
      strategy: "dropping",
    });
    const commandReceipts = yield* SynchronizedRef.make<
      ReadonlyMap<string, RememberedCommand>
    >(new Map());
    const deltas = yield* PubSub.bounded<WorldRuntimeDelta>(64);
    const runtime: LoadedWorldRuntime = {
      commandQueue,
      commandReceipts,
      deltas,
      liveSnapshot,
      state,
      worldId: world.worldId,
    };

    yield* runWorldLoop(runtime, checkpoints).pipe(
      Effect.forkScoped,
      Scope.provide(scope),
    );

    const next = new Map(current);
    next.set(world.worldId, runtime);
    return [runtime, next] as const;
  });

  const succeedResolutionUpdate = (
    resolution: CommandSubmissionResolution,
    next: ReadonlyMap<string, RememberedCommand>,
  ) =>
    Effect.succeed<
      readonly [
        CommandSubmissionResolution,
        ReadonlyMap<string, RememberedCommand>,
      ]
    >([resolution, next]);

  const buildPendingResolution = Effect.fn("api.worldRuntime.buildPendingResolution")(function* (
    current: ReadonlyMap<string, RememberedCommand>,
    cacheKey: string,
    payloadKey: string,
  ) {
    const deferred = yield* Deferred.make<WorldCommandReceipt>();
    const next = new Map(current);
    next.set(cacheKey, {
      _tag: "pending",
      deferred,
      payloadKey,
    });
    const enqueue: CommandSubmissionResolution = {
      _tag: "enqueue",
      deferred,
    };
    return yield* succeedResolutionUpdate(enqueue, next);
  });

  const resolveExistingResolution = (
    remembered: RememberedCommand,
    current: ReadonlyMap<string, RememberedCommand>,
    payloadKey: string,
  ) => {
    const rememberedResolution = Match.value(remembered).pipe(
      Match.when(
        { _tag: "resolved" },
        ({ receipt }) =>
          ({
            _tag: "resolved",
            receipt,
          }) satisfies CommandSubmissionResolution,
      ),
      Match.orElse(
        ({ deferred }) =>
          ({
            _tag: "pending",
            deferred,
          }) satisfies CommandSubmissionResolution,
      ),
    );

    return Match.value(remembered.payloadKey === payloadKey).pipe(
      Match.when(false, () =>
        succeedResolutionUpdate(
          {
            _tag: "conflict",
          },
          current,
        ),
      ),
      Match.orElse(() =>
        succeedResolutionUpdate(rememberedResolution, current),
      ),
    );
  };

  const authorizeWorld = Effect.fn("api.worldRuntime.authorizeWorld")(function* (options: {
    readonly actor: ActorContext;
    readonly requireWrite: boolean;
    readonly worldId: string;
  }) {
    const worldOption = yield* worlds
      .findById(options.worldId)
      .pipe(
        Effect.mapError((error) =>
          toRuntimeFailure(
            options.worldId,
            "Failed to load world metadata",
            error,
          ),
        ),
      );
    const world = yield* Option.match(worldOption, {
      onNone: () =>
        Effect.fail(new WorldNotFoundError({ worldId: options.worldId })),
      onSome: Effect.succeed,
    });

    const isOwner = world.hostPublicKey === options.actor.publicKey;
    const isMember = Match.value(world.snapshot).pipe(
      Match.when(Match.undefined, () => false),
      Match.orElse((snapshot) => hasRuntimeMembership(snapshot, options.actor)),
    );
    const isPublicReadable = world.visibility === "public";

    const denied = Match.value(options.requireWrite).pipe(
      Match.when(true, () => !isOwner && !isMember),
      Match.orElse(() => !isOwner && !isMember && !isPublicReadable),
    );

    yield* failIfDefined(
      Match.value(denied).pipe(
        Match.when(
          true,
          () =>
            new WorldAccessDeniedError({
              worldId: options.worldId,
            }),
        ),
        Match.orElse(() => undefined),
      ),
    );

    return world;
  });

  const resolveReadyWorld = Effect.fn("api.worldRuntime.resolveReadyWorld")(function* (
    actor: ActorContext,
    worldId: string,
    requireWrite: boolean,
  ) {
    const world = yield* authorizeWorld({ actor, requireWrite, worldId });

    return yield* Match.value({
      hostPublicKey: world.hostPublicKey,
      snapshot: world.snapshot,
      spec: world.spec,
      visibility: world.visibility,
      worldId: world.worldId,
    }).pipe(
      Match.when(
        {
          hostPublicKey: Match.defined,
          snapshot: Match.defined,
          spec: Match.defined,
          visibility: Match.defined,
          worldId: Match.defined,
        },
        ({ hostPublicKey, snapshot, spec, visibility, worldId }) =>
          Effect.succeed({
            hostPublicKey,
            snapshot,
            spec,
            visibility,
            worldId,
          } satisfies ReadyWorld),
      ),
      Match.orElse(() =>
        Effect.fail(
          new WorldRuntimeUnavailableError({
            message: "World runtime is not available until the world is ready",
            worldId,
          }),
        ),
      ),
    );
  });

  const ensureRuntime = Effect.fn("api.worldRuntime.ensureRuntime")(function* (world: ReadyWorld) {
    return yield* SynchronizedRef.modifyEffect(registry, (current) => {
      const existing = current.get(world.worldId);

      return Match.value(existing).pipe(
        Match.when(Match.defined, (runtime) =>
          Effect.succeed([runtime, current] as const),
        ),
        Match.orElse(() => buildLoadedRuntime(current, world)),
      );
    });
  });

  const getWorldRuntime = Effect.fn("api.worldRuntime.getWorldRuntime")(function* (
    actor: ActorContext,
    worldId: string,
  ) {
    const world = yield* resolveReadyWorld(actor, worldId, false);
    const runtime = yield* ensureRuntime(world);
    return yield* Ref.get(runtime.state);
  });

  const getWorldRuntimeCheckpoint = Effect.fn("api.worldRuntime.getWorldRuntimeCheckpoint")(function* (
    actor: ActorContext,
    worldId: string,
  ) {
    yield* authorizeWorld({ actor, requireWrite: false, worldId });
    const checkpointOption = yield* checkpoints
      .loadLatest(worldId)
      .pipe(
        Effect.mapError((error) =>
          toRuntimeFailure(worldId, "Failed to load runtime checkpoint", error),
        ),
      );

    return Option.getOrUndefined(checkpointOption);
  });

  const openWorldRuntimeFeed = Effect.fn("api.worldRuntime.openWorldRuntimeFeed")(function* (
    actor: ActorContext,
    worldId: string,
  ) {
    const world = yield* resolveReadyWorld(actor, worldId, false);
    const runtime = yield* ensureRuntime(world);

    return {
      deltas: Stream.fromPubSub(runtime.deltas),
      snapshot: yield* SubscriptionRef.get(runtime.liveSnapshot),
    };
  });

  const openWorldRuntimeMessageStream = Effect.fn("api.worldRuntime.openWorldRuntimeMessageStream")(function* (
    actor: ActorContext,
    worldId: string,
  ) {
    const feed = yield* openWorldRuntimeFeed(actor, worldId);
    const deltaMessages = Stream.map(
      feed.deltas,
      (delta): WorldRuntimeMessage => ({
        _tag: "WorldRuntimeDeltaMessage",
        delta,
      }),
    );

    return Stream.make({
      _tag: "WorldRuntimeSnapshotMessage",
      snapshot: feed.snapshot,
    }).pipe(Stream.concat(deltaMessages));
  });

  const queueWorldCommand = Effect.fn("api.worldRuntime.queueWorldCommand")(function* (
    actor: ActorContext,
    worldId: string,
    command: WorldCommand,
  ) {
    const world = yield* resolveReadyWorld(actor, worldId, true);
    const runtime = yield* ensureRuntime(world);
    const cacheKey = commandCacheKey(actor, command.commandId);
    const payloadKey = commandPayloadKey(command);
    const resolution: CommandSubmissionResolution =
      yield* SynchronizedRef.modifyEffect(
        runtime.commandReceipts,
        (current) => {
          const existing = current.get(cacheKey);

          return Match.value(existing).pipe(
            Match.when(Match.undefined, () =>
              buildPendingResolution(current, cacheKey, payloadKey),
            ),
            Match.orElse((remembered) =>
              resolveExistingResolution(remembered, current, payloadKey),
            ),
          );
        },
      ).pipe(
        Effect.withSpan("api.worldRuntime.command.resolve", {
          attributes: {
            "command.id": command.commandId,
            "command.tag": command._tag,
            "world.id": worldId,
          },
        }),
      );

    switch (resolution._tag) {
      case "conflict":
        return {
          _tag: "resolved",
          receipt: {
            _tag: "WorldCommandRejected",
            commandId: command.commandId,
            message: `commandId ${command.commandId} was reused with a different payload`,
            reasonCode: "idempotency_conflict",
            rejectedTick: 0,
            status: "rejected",
            worldId,
          },
        } satisfies QueuedCommandResult;
      case "resolved":
        return {
          _tag: "resolved",
          receipt: resolution.receipt,
        } satisfies QueuedCommandResult;
      case "pending":
        return {
          _tag: "queued",
          commandId: command.commandId,
          receipt: resolution.deferred,
        } satisfies QueuedCommandResult;
      case "enqueue": {
        const enqueuedAtMs = yield* Clock.currentTimeMillis;
        const accepted = yield* Queue.offer(runtime.commandQueue, {
          actor,
          cacheKey,
          command,
          enqueuedAtMs,
          result: resolution.deferred,
        }).pipe(
          Effect.tap((offered) =>
            Effect.annotateCurrentSpan({
              "command.queue.accepted": offered,
            }),
          ),
          Effect.withSpan("api.worldRuntime.command.queue", {
            attributes: {
              "command.id": command.commandId,
              "command.tag": command._tag,
              "world.id": worldId,
            },
          }),
        );

        if (!accepted) {
          yield* SynchronizedRef.update(runtime.commandReceipts, (current) => {
            const next = new Map(current);
            next.delete(cacheKey);
            return next;
          });
          return yield* new WorldCommandQueueFullError({
            message: "World command queue is full",
            worldId,
          });
        }

        return {
          _tag: "queued",
          commandId: command.commandId,
          receipt: resolution.deferred,
        } satisfies QueuedCommandResult;
      }
    }
  });

  const submitWorldCommand = Effect.fn("api.worldRuntime.submitWorldCommand")(function* (
    actor: ActorContext,
    worldId: string,
    command: WorldCommand,
  ) {
    const queued = yield* queueWorldCommand(actor, worldId, command);

    if (queued._tag === "resolved") {
      return queued.receipt;
    }

    return yield* Deferred.await(queued.receipt);
  });

  return {
    getWorldRuntime,
    getWorldRuntimeCheckpoint,
    openWorldRuntimeFeed,
    openWorldRuntimeMessageStream,
    queueWorldCommand,
    submitWorldCommand,
  };
});

type WorldRuntimeServiceShape = Effect.Success<typeof makeWorldRuntimeService>;

export class WorldRuntimeService extends ServiceMap.Service<
  WorldRuntimeService,
  WorldRuntimeServiceShape
>()("refactory/WorldRuntimeService") {
  static readonly Live = Layer.effect(
    WorldRuntimeService,
    makeWorldRuntimeService,
  );
}
