import { expect, test } from "bun:test";
import type { ActorContext } from "@refactory/contracts/auth";
import type { WorldRuntimeSnapshot } from "@refactory/contracts/runtime";
import { Effect, Match } from "effect";
import {
  applyWorldCommand,
  executeWorldTransport,
  progressWorldMachineWork,
  recomputeWorldPowerState,
} from "./world-runtime.ts";

const runSync = Effect.runSync;

const fail = (message: string): never => {
  throw new Error(message);
};

const actor: ActorContext = {
  displayName: "Host",
  publicKey: "host-public-key",
};

const applyWorldCommandSync = (
  snapshot: WorldRuntimeSnapshot,
  actor: ActorContext,
  command: Parameters<typeof applyWorldCommand>[2],
) => runSync(applyWorldCommand(snapshot, actor, command));

const progressMachineWork = (snapshot: WorldRuntimeSnapshot) =>
  runSync(progressWorldMachineWork(snapshot));

const executeTransport = (snapshot: WorldRuntimeSnapshot) =>
  runSync(executeWorldTransport(snapshot));

const recomputePowerState = (snapshot: WorldRuntimeSnapshot) =>
  runSync(recomputeWorldPowerState(snapshot));

const buildTiles = () =>
  Array.from({ length: 12 }, (_, y) =>
    Array.from({ length: 12 }, (_, x) => ({
      altitude: 0,
      buildable: true,
      coordinate: { x, y },
    })),
  ).flat();

const baseSnapshot = (): WorldRuntimeSnapshot => ({
  containers: [
    {
      _tag: "SlotContainer",
      containerId: "asset:BAR-001:inventory",
      owner: {
        actorPublicKey: actor.publicKey,
        kind: "asset",
        ownerId: "BAR-001",
        role: "inventory",
      },
      slotCount: 24,
      slots: Array.from({ length: 24 }, (_, slotIndex) => ({ slotIndex })),
    },
    {
      _tag: "TypedContainer",
      acceptedItemIds: ["iron_ingot"],
      capacity: undefined,
      containerId: "system:modular-storage",
      entries: [],
      owner: {
        kind: "system",
        ownerId: "system:modular-storage",
        role: "quota_storage",
      },
    },
  ],
  deltaSequence: 0,
  generators: [],
  inventories: [
    {
      actorPublicKey: actor.publicKey,
      assetId: "BAR-001",
      containerId: "asset:BAR-001:inventory",
    },
  ],
  lastTickAt: "2026-04-06T00:00:00.000Z",
  machines: [],
  mode: "solo",
  observers: {
    bossChat: {
      currentPhraseIndex: 0,
      introMessageId: "solo-intro",
      skipVotes: [],
    },
    quota: [{ delivered: 0, itemId: "iron_ingot", required: 60, reserved: 0 }],
    tutorial: {
      completedObjectiveIds: [],
      currentObjectiveId: "place-miner",
      phase: "bootstrap",
      variant: "solo",
    },
  },
  objects: [
    {
      buildableId: "iron_node_impure",
      containerIds: [],
      fixed: true,
      objectId: "node:iron:1",
      origin: { x: 2, y: 5 },
      removable: false,
      resourceNodeId: "node:iron:1",
    },
    {
      buildableId: "iron_node_impure",
      containerIds: [],
      fixed: true,
      objectId: "node:iron:2",
      origin: { x: 2, y: 8 },
      removable: false,
      resourceNodeId: "node:iron:2",
    },
    {
      buildableId: "modular_storage",
      containerIds: ["system:modular-storage"],
      fixed: true,
      objectId: "system:modular-storage-object",
      origin: { x: 9, y: 5 },
      removable: false,
    },
  ],
  powerNetworks: [],
  runtimeVersion: 2,
  tick: 0,
  tiles: buildTiles(),
  transportLanes: [],
  worldId: "00000000-0000-0000-0000-000000000001",
});

const withInventoryStack = (
  snapshot: WorldRuntimeSnapshot,
  slotIndex: number,
  itemId: string,
  quantity: number,
): WorldRuntimeSnapshot => {
  const inventory = snapshot.containers[0];

  switch (true) {
    case inventory === undefined:
    case inventory?._tag !== "SlotContainer":
      throw new Error("expected slot inventory container");
  }

  return {
    ...snapshot,
    containers: [
      {
        ...inventory,
        slots: inventory.slots.map((slot) => {
          switch (slot.slotIndex) {
            case slotIndex:
              return { slotIndex, stack: { itemId, quantity } };
            default:
              return slot;
          }
        }),
      },
      ...snapshot.containers.slice(1),
    ],
  };
};

test("applyWorldCommand places a smelter and consumes the build item", () => {
  const snapshot = withInventoryStack(baseSnapshot(), 0, "smelter_v1", 1);
  const result = applyWorldCommandSync(snapshot, actor, {
    _tag: "PlaceBuilding",
    buildableId: "smelter_v1",
    commandId: "00000000-0000-0000-0000-000000000010",
    origin: { x: 4, y: 5 },
    rotation: "east",
  });

  expect(result.pendingReceipt._tag).toBe("accepted");
  expect(
    result.snapshot.objects?.some(
      (object) => object.buildableId === "smelter_v1",
    ),
  ).toBe(true);
  expect(
    result.snapshot.machines.some((machine) => machine.kind === "smelter_v1"),
  ).toBe(true);

  const inventory = result.snapshot.containers[0];
  expect(inventory).toBeDefined();
  switch (true) {
    case inventory === undefined:
    case inventory?._tag !== "SlotContainer":
      throw new Error("expected inventory container");
  }

  expect(inventory.slots[0]?.stack).toBeUndefined();
});

test("applyWorldCommand rejects miner placement off a resource node", () => {
  const snapshot = withInventoryStack(baseSnapshot(), 0, "miner_v1", 1);
  const result = applyWorldCommandSync(snapshot, actor, {
    _tag: "PlaceBuilding",
    buildableId: "miner_v1",
    commandId: "00000000-0000-0000-0000-000000000011",
    origin: { x: 4, y: 4 },
    rotation: "east",
  });

  expect(result.pendingReceipt).toEqual({
    _tag: "rejected",
    commandId: "00000000-0000-0000-0000-000000000011",
    message: "Miner must be placed on a resource node",
    reasonCode: "invalid_location",
  });
});

test("applyWorldCommand places a belt run between placed machines", () => {
  const seeded = withInventoryStack(
    withInventoryStack(
      withInventoryStack(baseSnapshot(), 0, "miner_v1", 1),
      1,
      "smelter_v1",
      1,
    ),
    2,
    "belt_v1",
    4,
  );
  const minerPlaced = applyWorldCommandSync(seeded, actor, {
    _tag: "PlaceBuilding",
    buildableId: "miner_v1",
    commandId: "00000000-0000-0000-0000-000000000012",
    origin: { x: 2, y: 5 },
    rotation: "east",
  }).snapshot;
  const smelterPlaced = applyWorldCommandSync(minerPlaced, actor, {
    _tag: "PlaceBuilding",
    buildableId: "smelter_v1",
    commandId: "00000000-0000-0000-0000-000000000013",
    origin: { x: 5, y: 5 },
    rotation: "east",
  }).snapshot;
  const miner = smelterPlaced.objects?.find(
    (object) => object.buildableId === "miner_v1",
  );
  const smelter = smelterPlaced.objects?.find(
    (object) => object.buildableId === "smelter_v1",
  );
  const placedObjects = Match.value({ miner, smelter }).pipe(
    Match.when(
      { miner: Match.defined, smelter: Match.defined },
      ({ miner, smelter }) => ({ miner, smelter }),
    ),
    Match.orElse(() => fail("expected placed miner and smelter")),
  );

  const result = applyWorldCommandSync(smelterPlaced, actor, {
    _tag: "PlaceBeltRun",
    commandId: "00000000-0000-0000-0000-000000000014",
    destinationObjectId: placedObjects.smelter.objectId,
    destinationPortId: "in-0",
    sourceObjectId: placedObjects.miner.objectId,
    sourcePortId: "out-0",
  });

  expect(result.pendingReceipt._tag).toBe("accepted");
  expect(result.snapshot.transportLanes).toHaveLength(1);
  expect(result.snapshot.transportLanes[0]?.pathTiles).toEqual([
    { altitude: 0, x: 3, y: 5 },
    { altitude: 0, x: 4, y: 5 },
  ]);
});

test("applyWorldCommand removes a building, attached belts, and refunds items", () => {
  const seeded = withInventoryStack(
    withInventoryStack(
      withInventoryStack(baseSnapshot(), 0, "miner_v1", 1),
      1,
      "smelter_v1",
      1,
    ),
    2,
    "belt_v1",
    4,
  );
  const minerPlaced = applyWorldCommandSync(seeded, actor, {
    _tag: "PlaceBuilding",
    buildableId: "miner_v1",
    commandId: "00000000-0000-0000-0000-000000000015",
    origin: { x: 2, y: 5 },
    rotation: "east",
  }).snapshot;
  const smelterPlaced = applyWorldCommandSync(minerPlaced, actor, {
    _tag: "PlaceBuilding",
    buildableId: "smelter_v1",
    commandId: "00000000-0000-0000-0000-000000000016",
    origin: { x: 5, y: 5 },
    rotation: "east",
  }).snapshot;
  const miner = smelterPlaced.objects?.find(
    (object) => object.buildableId === "miner_v1",
  );
  const smelter = smelterPlaced.objects?.find(
    (object) => object.buildableId === "smelter_v1",
  );
  const placedObjects = Match.value({ miner, smelter }).pipe(
    Match.when(
      { miner: Match.defined, smelter: Match.defined },
      ({ miner, smelter }) => ({ miner, smelter }),
    ),
    Match.orElse(() => fail("expected placed miner and smelter")),
  );

  const belted = applyWorldCommandSync(smelterPlaced, actor, {
    _tag: "PlaceBeltRun",
    commandId: "00000000-0000-0000-0000-000000000017",
    destinationObjectId: placedObjects.smelter.objectId,
    destinationPortId: "in-0",
    sourceObjectId: placedObjects.miner.objectId,
    sourcePortId: "out-0",
  }).snapshot;
  const removed = applyWorldCommandSync(belted, actor, {
    _tag: "RemoveBuilding",
    commandId: "00000000-0000-0000-0000-000000000018",
    objectId: placedObjects.smelter.objectId,
  });

  expect(removed.pendingReceipt._tag).toBe("accepted");
  expect(
    removed.snapshot.objects?.some(
      (object) => object.objectId === placedObjects.smelter.objectId,
    ),
  ).toBe(false);
  expect(removed.snapshot.transportLanes).toHaveLength(0);

  const inventory = removed.snapshot.containers[0];
  switch (true) {
    case inventory === undefined:
    case inventory?._tag !== "SlotContainer":
      throw new Error("expected inventory container");
  }

  expect(
    inventory.slots.some((slot) => slot.stack?.itemId === "smelter_v1"),
  ).toBe(true);
  expect(
    inventory.slots.some(
      (slot) => slot.stack?.itemId === "belt_v1" && slot.stack.quantity >= 2,
    ),
  ).toBe(true);
});

test("applyWorldCommand updates processor recipe and returns incompatible outputs to inventory", () => {
  const snapshot = withInventoryStack(baseSnapshot(), 0, "processor", 1);
  const placed = applyWorldCommandSync(snapshot, actor, {
    _tag: "PlaceBuilding",
    buildableId: "processor",
    commandId: "00000000-0000-0000-0000-000000000019",
    origin: { x: 4, y: 6 },
    rotation: "east",
  }).snapshot;
  const processor = placed.objects?.find(
    (object) => object.buildableId === "processor",
  );
  const processorOutput = Match.value(processor?.containerIds[1]).pipe(
    Match.when(Match.undefined, () => undefined),
    Match.orElse((outputContainerId) =>
      placed.containers.find(
        (container) => container.containerId === outputContainerId,
      ),
    ),
  );
  const placedProcessor = Match.value({
    outputContainerId: processor?.containerIds[1],
    processor,
    processorOutput,
  }).pipe(
    Match.when(
      {
        outputContainerId: Match.defined,
        processor: { machineId: Match.defined },
        processorOutput: { _tag: "TypedContainer" },
      },
      ({ outputContainerId, processor, processorOutput }) => ({
        outputContainerId,
        processor,
        processorOutput,
      }),
    ),
    Match.orElse(() => fail("expected placed processor machine and output")),
  );

  const seededOutput: WorldRuntimeSnapshot = {
    ...placed,
    containers: placed.containers.map((container) => {
      switch (container.containerId) {
        case placedProcessor.outputContainerId:
          return {
            ...placedProcessor.processorOutput,
            entries: [{ itemId: "iron_plate", quantity: 1 }],
          };
        default:
          return container;
      }
    }),
    machines: placed.machines.map((machine) => {
      switch (machine.machineId) {
        case placedProcessor.processor.machineId:
          return {
            ...machine,
            progress: 0.5,
            recipeId: "iron_plate",
          };
        default:
          return machine;
      }
    }),
  };

  const result = applyWorldCommandSync(seededOutput, actor, {
    _tag: "SetMachineRecipe",
    commandId: "00000000-0000-0000-0000-000000000020",
    machineId: placedProcessor.processor.machineId,
    recipeId: "iron_rod",
  });

  expect(result.pendingReceipt._tag).toBe("accepted");
  expect(
    result.snapshot.machines.find(
      (machine) => machine.machineId === placedProcessor.processor.machineId,
    )?.recipeId,
  ).toBe("iron_rod");
  expect(
    result.snapshot.machines.find(
      (machine) => machine.machineId === placedProcessor.processor.machineId,
    )?.progress,
  ).toBe(0);

  const inventory = result.snapshot.containers[0];
  switch (true) {
    case inventory === undefined:
    case inventory?._tag !== "SlotContainer":
      throw new Error("expected inventory container");
  }

  expect(
    inventory.slots.some((slot) => slot.stack?.itemId === "iron_plate"),
  ).toBe(true);
});

test("progressMachineWork consumes input and advances smelter batch", () => {
  const snapshot: WorldRuntimeSnapshot = {
    ...baseSnapshot(),
    containers: [
      {
        _tag: "TypedContainer",
        acceptedItemIds: ["iron_ore"],
        capacity: 200,
        containerId: "machine:smelter:input",
        entries: [{ itemId: "iron_ore", quantity: 1 }],
        owner: { kind: "entity", ownerId: "smelter-1", role: "machine_input" },
      },
      {
        _tag: "TypedContainer",
        acceptedItemIds: ["iron_ingot"],
        capacity: 200,
        containerId: "machine:smelter:output",
        entries: [],
        owner: { kind: "entity", ownerId: "smelter-1", role: "machine_output" },
      },
    ],
    machines: [
      {
        inputContainerIds: ["machine:smelter:input"],
        kind: "smelter_v1",
        machineId: "smelter-1",
        outputContainerIds: ["machine:smelter:output"],
        powerState: "connected",
        progress: 0,
        recipeId: "iron_ingot",
        status: "idle",
      },
    ],
  };

  const result = progressMachineWork(snapshot);
  const progressed = Match.value({
    inputContainer: result.snapshot.containers[0],
    machine: result.snapshot.machines[0],
  }).pipe(
    Match.when(
      {
        inputContainer: { _tag: "TypedContainer" },
        machine: Match.defined,
      },
      ({ inputContainer, machine }) => ({ inputContainer, machine }),
    ),
    Match.orElse(() =>
      fail("expected typed smelter input container and machine"),
    ),
  );

  expect(progressed.inputContainer).toBeDefined();
  expect(progressed.machine).toBeDefined();
  expect(progressed.inputContainer._tag).toBe("TypedContainer");

  expect(progressed.inputContainer.entries).toEqual([]);
  expect(progressed.machine.progress).toBeCloseTo(0.05);
  expect(progressed.machine.status).toBe("running");
});

test("progressMachineWork emits finished output into machine output buffer", () => {
  const snapshot: WorldRuntimeSnapshot = {
    ...baseSnapshot(),
    containers: [
      {
        _tag: "TypedContainer",
        acceptedItemIds: ["iron_ore"],
        capacity: 200,
        containerId: "machine:smelter:input",
        entries: [],
        owner: { kind: "entity", ownerId: "smelter-1", role: "machine_input" },
      },
      {
        _tag: "TypedContainer",
        acceptedItemIds: ["iron_ingot"],
        capacity: 200,
        containerId: "machine:smelter:output",
        entries: [],
        owner: { kind: "entity", ownerId: "smelter-1", role: "machine_output" },
      },
    ],
    machines: [
      {
        inputContainerIds: ["machine:smelter:input"],
        kind: "smelter_v1",
        machineId: "smelter-1",
        outputContainerIds: ["machine:smelter:output"],
        powerState: "connected",
        progress: 0.98,
        recipeId: "iron_ingot",
        status: "running",
      },
    ],
  };

  const result = progressMachineWork(snapshot);
  const progressed = Match.value({
    machine: result.snapshot.machines[0],
    outputContainer: result.snapshot.containers[1],
  }).pipe(
    Match.when(
      {
        machine: Match.defined,
        outputContainer: { _tag: "TypedContainer" },
      },
      ({ machine, outputContainer }) => ({ machine, outputContainer }),
    ),
    Match.orElse(() =>
      fail("expected typed smelter output container and machine"),
    ),
  );

  expect(progressed.outputContainer).toBeDefined();
  expect(progressed.machine).toBeDefined();
  expect(progressed.outputContainer._tag).toBe("TypedContainer");

  expect(progressed.outputContainer.entries).toEqual([
    { itemId: "iron_ingot", quantity: 1 },
  ]);
  expect(progressed.machine.progress).toBeCloseTo(0.03);
  expect(progressed.machine.status).toBe("running");
});

test("executeTransport delivers to modular storage and updates quota", () => {
  const snapshot: WorldRuntimeSnapshot = {
    ...baseSnapshot(),
    containers: [
      {
        _tag: "TypedContainer",
        acceptedItemIds: ["iron_ingot"],
        capacity: undefined,
        containerId: "system:modular-storage",
        entries: [],
        owner: {
          kind: "system",
          ownerId: "system:modular-storage",
          role: "quota_storage",
        },
      },
    ],
    transportLanes: [
      {
        destinationId: "system:modular-storage",
        itemSpacing: 0.2,
        items: [{ itemId: "iron_ingot", progress: 0.9 }],
        laneId: "lane-1",
        length: 1,
        sourceId: undefined,
        speed: 1,
      },
    ],
  };

  const result = executeTransport(snapshot);
  const delivered = Match.value({
    lane: result.snapshot.transportLanes[0],
    storage: result.snapshot.containers[0],
  }).pipe(
    Match.when(
      {
        lane: Match.defined,
        storage: { _tag: "TypedContainer" },
      },
      ({ lane, storage }) => ({ lane, storage }),
    ),
    Match.orElse(() => fail("expected typed storage container and lane")),
  );

  expect(delivered.storage).toBeDefined();
  expect(delivered.lane).toBeDefined();
  expect(delivered.storage._tag).toBe("TypedContainer");
  expect(delivered.storage.entries).toEqual([
    { itemId: "iron_ingot", quantity: 1 },
  ]);
  expect(result.snapshot.observers.quota[0]).toEqual({
    delivered: 1,
    itemId: "iron_ingot",
    required: 60,
    reserved: 1,
  });
  expect(lane.items).toEqual([]);
});

test("TakeFromContainer rejects manual withdrawal from machine input", () => {
  const snapshot: WorldRuntimeSnapshot = {
    ...baseSnapshot(),
    containers: [
      ...baseSnapshot().containers,
      {
        _tag: "TypedContainer",
        acceptedItemIds: ["iron_ore"],
        capacity: 200,
        containerId: "machine:smelter:input",
        entries: [{ itemId: "iron_ore", quantity: 1 }],
        owner: { kind: "entity", ownerId: "smelter-1", role: "machine_input" },
      },
    ],
  };

  const result = applyWorldCommandSync(snapshot, actor, {
    _tag: "TakeFromContainer",
    commandId: "00000000-0000-0000-0000-000000000021",
    fromContainerId: "machine:smelter:input",
    itemId: "iron_ore",
    quantity: 1,
  });

  expect(result.pendingReceipt).toEqual({
    _tag: "rejected",
    commandId: "00000000-0000-0000-0000-000000000021",
    message: "machine:smelter:input does not allow manual withdrawal",
    reasonCode: "invalid_target",
  });
});

test("InsertFuel moves wood into a burner fuel buffer", () => {
  const snapshot: WorldRuntimeSnapshot = {
    ...withInventoryStack(baseSnapshot(), 0, "wood", 2),
    containers: [
      ...withInventoryStack(baseSnapshot(), 0, "wood", 2).containers,
      {
        _tag: "TypedContainer",
        acceptedItemIds: ["wood"],
        capacity: 200,
        containerId: "entity:burner-1:fuel",
        entries: [],
        owner: { kind: "entity", ownerId: "burner-1", role: "burner_fuel" },
      },
    ],
    generators: [
      {
        currentOutputMw: 0,
        fuelBurnProgress: 0,
        fuelContainerId: "entity:burner-1:fuel",
        generatorId: "burner-1",
        kind: "burner_v1",
        maxCapacityMw: 30,
        objectId: "burner-1",
        powerRadius: 4,
        status: "out_of_fuel",
      },
    ],
    objects: [
      ...(baseSnapshot().objects ?? []),
      {
        buildableId: "burner_v1",
        containerIds: ["entity:burner-1:fuel"],
        fixed: false,
        objectId: "burner-1",
        origin: { x: 4, y: 4 },
        removable: true,
        rotation: "east",
      },
    ],
  };

  const result = applyWorldCommandSync(snapshot, actor, {
    _tag: "InsertFuel",
    commandId: "00000000-0000-0000-0000-000000000022",
    fuelItemId: "wood",
    fromContainerId: "asset:BAR-001:inventory",
    machineId: "burner-1",
    quantity: 1,
  });

  expect(result.pendingReceipt._tag).toBe("accepted");
  const fuelContainer = result.snapshot.containers.find(
    (container) => container.containerId === "entity:burner-1:fuel",
  );

  const typedFuelContainer = Match.value(fuelContainer).pipe(
    Match.when({ _tag: "TypedContainer" }, (fuelContainer) => fuelContainer),
    Match.orElse(() => fail("expected burner fuel container")),
  );

  expect(typedFuelContainer).toBeDefined();

  expect(typedFuelContainer.entries).toEqual([{ itemId: "wood", quantity: 1 }]);
});

test("recomputePowerState powers machines and trips overloaded networks until restart", () => {
  const snapshot: WorldRuntimeSnapshot = {
    ...baseSnapshot(),
    containers: [
      ...baseSnapshot().containers,
      {
        _tag: "TypedContainer",
        acceptedItemIds: ["wood"],
        capacity: 200,
        containerId: "entity:burner-1:fuel",
        entries: [{ itemId: "wood", quantity: 1 }],
        owner: { kind: "entity", ownerId: "burner-1", role: "burner_fuel" },
      },
      {
        _tag: "TypedContainer",
        acceptedItemIds: ["iron_ingot"],
        capacity: 200,
        containerId: "entity:processor-1:input",
        entries: [{ itemId: "iron_ingot", quantity: 2 }],
        owner: {
          kind: "entity",
          ownerId: "processor-1",
          role: "machine_input",
        },
      },
      {
        _tag: "TypedContainer",
        acceptedItemIds: ["iron_plate"],
        capacity: 200,
        containerId: "entity:processor-1:output",
        entries: [],
        owner: {
          kind: "entity",
          ownerId: "processor-1",
          role: "machine_output",
        },
      },
      {
        _tag: "TypedContainer",
        acceptedItemIds: ["iron_ore"],
        capacity: 200,
        containerId: "entity:smelter-1:input",
        entries: [{ itemId: "iron_ore", quantity: 1 }],
        owner: { kind: "entity", ownerId: "smelter-1", role: "machine_input" },
      },
      {
        _tag: "TypedContainer",
        acceptedItemIds: ["iron_ingot"],
        capacity: 200,
        containerId: "entity:smelter-1:output",
        entries: [],
        owner: { kind: "entity", ownerId: "smelter-1", role: "machine_output" },
      },
      {
        _tag: "TypedContainer",
        acceptedItemIds: ["iron_ore"],
        capacity: 200,
        containerId: "entity:miner-1:output",
        entries: [],
        owner: { kind: "entity", ownerId: "miner-1", role: "machine_output" },
      },
    ],
    generators: [
      {
        currentOutputMw: 0,
        fuelBurnProgress: 0,
        fuelContainerId: "entity:burner-1:fuel",
        generatorId: "burner-1",
        kind: "burner_v1",
        maxCapacityMw: 30,
        objectId: "burner-1",
        powerRadius: 4,
        status: "out_of_fuel",
      },
    ],
    machines: [
      {
        inputContainerIds: ["entity:processor-1:input"],
        kind: "processor",
        machineId: "processor-1",
        objectId: "processor-1",
        outputContainerIds: ["entity:processor-1:output"],
        powerState: "disconnected",
        progress: 0,
        recipeId: "iron_plate",
        status: "idle",
      },
      {
        inputContainerIds: [],
        kind: "miner_v1",
        machineId: "miner-1",
        objectId: "miner-1",
        outputContainerIds: ["entity:miner-1:output"],
        powerState: "disconnected",
        progress: 0,
        recipeId: "iron_ore",
        status: "idle",
      },
      {
        inputContainerIds: ["entity:smelter-1:input"],
        kind: "smelter_v1",
        machineId: "smelter-1",
        objectId: "smelter-1",
        outputContainerIds: ["entity:smelter-1:output"],
        powerState: "disconnected",
        progress: 0,
        recipeId: "iron_ingot",
        status: "idle",
      },
    ],
    objects: [
      ...(baseSnapshot().objects ?? []),
      {
        buildableId: "burner_v1",
        containerIds: ["entity:burner-1:fuel"],
        fixed: false,
        objectId: "burner-1",
        origin: { x: 4, y: 4 },
        removable: true,
        rotation: "east",
      },
      {
        buildableId: "processor",
        containerIds: ["entity:processor-1:input", "entity:processor-1:output"],
        fixed: false,
        machineId: "processor-1",
        objectId: "processor-1",
        origin: { x: 5, y: 4 },
        removable: true,
        rotation: "east",
      },
      {
        buildableId: "miner_v1",
        containerIds: ["entity:miner-1:output"],
        fixed: false,
        machineId: "miner-1",
        objectId: "miner-1",
        origin: { x: 5, y: 5 },
        removable: true,
        rotation: "east",
      },
      {
        buildableId: "smelter_v1",
        containerIds: ["entity:smelter-1:input", "entity:smelter-1:output"],
        fixed: false,
        machineId: "smelter-1",
        objectId: "smelter-1",
        origin: { x: 4, y: 5 },
        removable: true,
        rotation: "east",
      },
    ],
  };

  const tripped = recomputePowerState(snapshot).snapshot;
  expect(tripped.powerNetworks[0]?.status).toBe("tripped");
  expect(
    tripped.machines.every((machine) => machine.powerState === "unpowered"),
  ).toBe(true);

  const restarted = applyWorldCommandSync(tripped, actor, {
    _tag: "RestartPowerNetwork",
    commandId: "00000000-0000-0000-0000-000000000023",
    objectId: "burner-1",
  }).snapshot;
  const afterRestart = recomputePowerState(restarted).snapshot;

  expect(afterRestart.powerNetworks[0]?.status).toBe("tripped");

  const relieved: WorldRuntimeSnapshot = {
    ...restarted,
    machines: restarted.machines.filter(
      (machine) =>
        machine.machineId !== "smelter-1" && machine.machineId !== "miner-1",
    ),
    objects: restarted.objects?.filter(
      (object) =>
        object.objectId !== "smelter-1" && object.objectId !== "miner-1",
    ),
    containers: restarted.containers.filter(
      (container) =>
        !container.containerId.startsWith("entity:smelter-1") &&
        !container.containerId.startsWith("entity:miner-1"),
    ),
  };
  const restartedAgain = applyWorldCommandSync(relieved, actor, {
    _tag: "RestartPowerNetwork",
    commandId: "00000000-0000-0000-0000-000000000024",
    objectId: "burner-1",
  }).snapshot;
  const energized = recomputePowerState(restartedAgain).snapshot;

  expect(energized.powerNetworks[0]?.status).toBe("energized");
  expect(energized.machines[0]?.powerState).toBe("connected");
});
