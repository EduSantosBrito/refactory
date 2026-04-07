import { expect, test } from "bun:test";
import type { ActorContext } from "@refactory/contracts/auth";
import type { WorldRuntimeSnapshot } from "@refactory/contracts/runtime";
import { applyWorldCommand, executeTransport, progressMachineWork } from "./world-runtime.ts";

const actor: ActorContext = {
  displayName: "Host",
  publicKey: "host-public-key",
};

const buildTiles = () =>
  Array.from({ length: 12 }, (_, y) =>
    Array.from({ length: 12 }, (_, x) => ({
      altitude: 0,
      buildable: true,
      coordinate: { x, y },
    }))
  ).flat();

const baseSnapshot = (): WorldRuntimeSnapshot => ({
  containers: [
    {
      _tag: "SlotContainer",
      containerId: "asset:BAR-001:inventory",
      owner: { actorPublicKey: actor.publicKey, kind: "asset", ownerId: "BAR-001", role: "inventory" },
      slotCount: 24,
      slots: Array.from({ length: 24 }, (_, slotIndex) => ({ slotIndex })),
    },
    {
      _tag: "TypedContainer",
      acceptedItemIds: ["iron_ingot"],
      capacity: undefined,
      containerId: "system:modular-storage",
      entries: [],
      owner: { kind: "system", ownerId: "system:modular-storage", role: "quota_storage" },
    },
  ],
  deltaSequence: 0,
  inventories: [{ actorPublicKey: actor.publicKey, assetId: "BAR-001", containerId: "asset:BAR-001:inventory" }],
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
  runtimeVersion: 2,
  tick: 0,
  tiles: buildTiles(),
  transportLanes: [],
  worldId: "00000000-0000-0000-0000-000000000001",
});

const withInventoryStack = (snapshot: WorldRuntimeSnapshot, slotIndex: number, itemId: string, quantity: number): WorldRuntimeSnapshot => {
  const inventory = snapshot.containers[0];

  if (inventory === undefined || inventory._tag !== "SlotContainer") {
    throw new Error("expected slot inventory container");
  }

  return {
    ...snapshot,
    containers: [
      {
        ...inventory,
        slots: inventory.slots.map((slot) =>
          slot.slotIndex === slotIndex ? { slotIndex, stack: { itemId, quantity } } : slot
        ),
      },
      ...snapshot.containers.slice(1),
    ],
  };
};

test("applyWorldCommand places a smelter and consumes the build item", () => {
  const snapshot = withInventoryStack(baseSnapshot(), 0, "smelter_v1", 1);
  const result = applyWorldCommand(snapshot, actor, {
    _tag: "PlaceBuilding",
    buildableId: "smelter_v1",
    commandId: "00000000-0000-0000-0000-000000000010",
    origin: { x: 4, y: 5 },
    rotation: "east",
  });

  expect(result.pendingReceipt._tag).toBe("accepted");
  expect(result.snapshot.objects?.some((object) => object.buildableId === "smelter_v1")).toBe(true);
  expect(result.snapshot.machines.some((machine) => machine.kind === "smelter_v1")).toBe(true);

  const inventory = result.snapshot.containers[0];
  expect(inventory).toBeDefined();
  if (inventory === undefined || inventory._tag !== "SlotContainer") {
    throw new Error("expected inventory container");
  }

  expect(inventory.slots[0]?.stack).toBeUndefined();
});

test("applyWorldCommand rejects miner placement off a resource node", () => {
  const snapshot = withInventoryStack(baseSnapshot(), 0, "miner_v1", 1);
  const result = applyWorldCommand(snapshot, actor, {
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
  const seeded = withInventoryStack(withInventoryStack(withInventoryStack(baseSnapshot(), 0, "miner_v1", 1), 1, "smelter_v1", 1), 2, "belt_v1", 4);
  const minerPlaced = applyWorldCommand(seeded, actor, {
    _tag: "PlaceBuilding",
    buildableId: "miner_v1",
    commandId: "00000000-0000-0000-0000-000000000012",
    origin: { x: 2, y: 5 },
    rotation: "east",
  }).snapshot;
  const smelterPlaced = applyWorldCommand(minerPlaced, actor, {
    _tag: "PlaceBuilding",
    buildableId: "smelter_v1",
    commandId: "00000000-0000-0000-0000-000000000013",
    origin: { x: 5, y: 5 },
    rotation: "east",
  }).snapshot;
  const miner = smelterPlaced.objects?.find((object) => object.buildableId === "miner_v1");
  const smelter = smelterPlaced.objects?.find((object) => object.buildableId === "smelter_v1");

  expect(miner).toBeDefined();
  expect(smelter).toBeDefined();
  if (miner === undefined || smelter === undefined) {
    throw new Error("expected placed miner and smelter");
  }

  const result = applyWorldCommand(smelterPlaced, actor, {
    _tag: "PlaceBeltRun",
    commandId: "00000000-0000-0000-0000-000000000014",
    destinationObjectId: smelter.objectId,
    destinationPortId: "in-0",
    sourceObjectId: miner.objectId,
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
  const seeded = withInventoryStack(withInventoryStack(withInventoryStack(baseSnapshot(), 0, "miner_v1", 1), 1, "smelter_v1", 1), 2, "belt_v1", 4);
  const minerPlaced = applyWorldCommand(seeded, actor, {
    _tag: "PlaceBuilding",
    buildableId: "miner_v1",
    commandId: "00000000-0000-0000-0000-000000000015",
    origin: { x: 2, y: 5 },
    rotation: "east",
  }).snapshot;
  const smelterPlaced = applyWorldCommand(minerPlaced, actor, {
    _tag: "PlaceBuilding",
    buildableId: "smelter_v1",
    commandId: "00000000-0000-0000-0000-000000000016",
    origin: { x: 5, y: 5 },
    rotation: "east",
  }).snapshot;
  const miner = smelterPlaced.objects?.find((object) => object.buildableId === "miner_v1");
  const smelter = smelterPlaced.objects?.find((object) => object.buildableId === "smelter_v1");

  if (miner === undefined || smelter === undefined) {
    throw new Error("expected placed miner and smelter");
  }

  const belted = applyWorldCommand(smelterPlaced, actor, {
    _tag: "PlaceBeltRun",
    commandId: "00000000-0000-0000-0000-000000000017",
    destinationObjectId: smelter.objectId,
    destinationPortId: "in-0",
    sourceObjectId: miner.objectId,
    sourcePortId: "out-0",
  }).snapshot;
  const removed = applyWorldCommand(belted, actor, {
    _tag: "RemoveBuilding",
    commandId: "00000000-0000-0000-0000-000000000018",
    objectId: smelter.objectId,
  });

  expect(removed.pendingReceipt._tag).toBe("accepted");
  expect(removed.snapshot.objects?.some((object) => object.objectId === smelter.objectId)).toBe(false);
  expect(removed.snapshot.transportLanes).toHaveLength(0);

  const inventory = removed.snapshot.containers[0];
  if (inventory === undefined || inventory._tag !== "SlotContainer") {
    throw new Error("expected inventory container");
  }

  expect(inventory.slots.some((slot) => slot.stack?.itemId === "smelter_v1")).toBe(true);
  expect(inventory.slots.some((slot) => slot.stack?.itemId === "belt_v1" && slot.stack.quantity >= 2)).toBe(true);
});

test("applyWorldCommand updates processor recipe and returns incompatible outputs to inventory", () => {
  const snapshot = withInventoryStack(baseSnapshot(), 0, "processor", 1);
  const placed = applyWorldCommand(snapshot, actor, {
    _tag: "PlaceBuilding",
    buildableId: "processor",
    commandId: "00000000-0000-0000-0000-000000000019",
    origin: { x: 4, y: 6 },
    rotation: "east",
  }).snapshot;
  const processor = placed.objects?.find((object) => object.buildableId === "processor");

  if (processor?.machineId === undefined) {
    throw new Error("expected placed processor machine");
  }

  const outputContainerId = processor.containerIds[1];
  if (outputContainerId === undefined) {
    throw new Error("expected processor output container");
  }

  const processorOutput = placed.containers.find((container) => container.containerId === outputContainerId);
  if (processorOutput === undefined || processorOutput._tag !== "TypedContainer") {
    throw new Error("expected processor output container");
  }

  const seededOutput: WorldRuntimeSnapshot = {
    ...placed,
    containers: placed.containers.map((container) =>
      container.containerId === outputContainerId
        ? {
            ...processorOutput,
            entries: [{ itemId: "iron_plate", quantity: 1 }],
          }
        : container
    ),
    machines: placed.machines.map((machine) =>
      machine.machineId === processor.machineId
        ? {
            ...machine,
            progress: 0.5,
            recipeId: "iron_plate",
          }
        : machine
    ),
  };

  const result = applyWorldCommand(seededOutput, actor, {
    _tag: "SetMachineRecipe",
    commandId: "00000000-0000-0000-0000-000000000020",
    machineId: processor.machineId,
    recipeId: "iron_rod",
  });

  expect(result.pendingReceipt._tag).toBe("accepted");
  expect(result.snapshot.machines.find((machine) => machine.machineId === processor.machineId)?.recipeId).toBe("iron_rod");
  expect(result.snapshot.machines.find((machine) => machine.machineId === processor.machineId)?.progress).toBe(0);

  const inventory = result.snapshot.containers[0];
  if (inventory === undefined || inventory._tag !== "SlotContainer") {
    throw new Error("expected inventory container");
  }

  expect(inventory.slots.some((slot) => slot.stack?.itemId === "iron_plate")).toBe(true);
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
  const inputContainer = result.snapshot.containers[0];
  const machine = result.snapshot.machines[0];

  expect(inputContainer).toBeDefined();
  expect(machine).toBeDefined();

  if (inputContainer === undefined || machine === undefined) {
    throw new Error("expected smelter input container and machine");
  }

  expect(inputContainer._tag).toBe("TypedContainer");
  if (inputContainer._tag !== "TypedContainer") {
    throw new Error("expected typed input container");
  }

  expect(inputContainer.entries).toEqual([]);
  expect(machine.progress).toBeCloseTo(0.05);
  expect(machine.status).toBe("running");
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
  const outputContainer = result.snapshot.containers[1];
  const machine = result.snapshot.machines[0];

  expect(outputContainer).toBeDefined();
  expect(machine).toBeDefined();

  if (outputContainer === undefined || machine === undefined) {
    throw new Error("expected smelter output container and machine");
  }

  expect(outputContainer._tag).toBe("TypedContainer");
  if (outputContainer._tag !== "TypedContainer") {
    throw new Error("expected typed output container");
  }

  expect(outputContainer.entries).toEqual([{ itemId: "iron_ingot", quantity: 1 }]);
  expect(machine.progress).toBeCloseTo(0.03);
  expect(machine.status).toBe("running");
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
        owner: { kind: "system", ownerId: "system:modular-storage", role: "quota_storage" },
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
  const storage = result.snapshot.containers[0];
  const lane = result.snapshot.transportLanes[0];

  expect(storage).toBeDefined();
  expect(lane).toBeDefined();

  if (storage === undefined || lane === undefined) {
    throw new Error("expected storage and lane");
  }

  expect(storage._tag).toBe("TypedContainer");
  if (storage._tag !== "TypedContainer") {
    throw new Error("expected typed storage container");
  }

  expect(storage.entries).toEqual([{ itemId: "iron_ingot", quantity: 1 }]);
  expect(result.snapshot.observers.quota[0]).toEqual({
    delivered: 1,
    itemId: "iron_ingot",
    required: 60,
    reserved: 1,
  });
  expect(lane.items).toEqual([]);
});
