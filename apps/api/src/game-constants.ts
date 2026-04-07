import type { Facing, RuntimeItemStack } from "@refactory/contracts/runtime";

export type PortDefinition = {
  readonly facing: Facing;
  readonly portId: string;
  readonly role: "input" | "output";
};

export type MachineRecipeDefinition = {
  readonly cycleProgressPerTick: number;
  readonly input: RuntimeItemStack | undefined;
  readonly output: RuntimeItemStack;
  readonly recipeId: string;
};

export type BuildableDefinition = {
  readonly buildCostItemId: string;
  readonly buildableId: string;
  readonly fuelAcceptedItemIds: ReadonlyArray<string>;
  readonly generator:
    | {
        readonly fuelTicksPerItemAtFullLoad: number;
        readonly maxCapacityMw: number;
        readonly powerRadius: number;
      }
    | undefined;
  readonly machineKind: string | undefined;
  readonly ports: ReadonlyArray<PortDefinition>;
};

export type MachineDefinition = {
  readonly defaultRecipeId: string | undefined;
  readonly kind: string;
  readonly powerDrawMw: number;
  readonly recipes: ReadonlyArray<MachineRecipeDefinition>;
};

const earlyCycleProgressPerTick = 30 / 60 / 10;

export const MODULAR_STORAGE_PORTS: ReadonlyArray<PortDefinition> = [
  { facing: "north", portId: "in-north", role: "input" },
  { facing: "east", portId: "in-east", role: "input" },
  { facing: "south", portId: "in-south", role: "input" },
  { facing: "west", portId: "in-west", role: "input" },
];

export const BUILDABLE_DEFINITIONS: ReadonlyArray<BuildableDefinition> = [
  {
    buildCostItemId: "miner_v1",
    buildableId: "miner_v1",
    fuelAcceptedItemIds: [],
    generator: undefined,
    machineKind: "miner_v1",
    ports: [{ facing: "east", portId: "out-0", role: "output" }],
  },
  {
    buildCostItemId: "smelter_v1",
    buildableId: "smelter_v1",
    fuelAcceptedItemIds: [],
    generator: undefined,
    machineKind: "smelter_v1",
    ports: [
      { facing: "west", portId: "in-0", role: "input" },
      { facing: "east", portId: "out-0", role: "output" },
    ],
  },
  {
    buildCostItemId: "processor",
    buildableId: "processor",
    fuelAcceptedItemIds: [],
    generator: undefined,
    machineKind: "processor",
    ports: [
      { facing: "west", portId: "in-0", role: "input" },
      { facing: "east", portId: "out-0", role: "output" },
    ],
  },
  {
    buildCostItemId: "burner_v1",
    buildableId: "burner_v1",
    fuelAcceptedItemIds: ["wood"],
    generator: {
      fuelTicksPerItemAtFullLoad: 1800,
      maxCapacityMw: 30,
      powerRadius: 4,
    },
    machineKind: undefined,
    ports: [],
  },
];

export const MACHINE_DEFINITIONS: ReadonlyArray<MachineDefinition> = [
  {
    defaultRecipeId: "iron_ore",
    kind: "miner_v1",
    powerDrawMw: 10,
    recipes: [
      {
        cycleProgressPerTick: earlyCycleProgressPerTick,
        input: undefined,
        output: { itemId: "iron_ore", quantity: 1 },
        recipeId: "iron_ore",
      },
    ],
  },
  {
    defaultRecipeId: undefined,
    kind: "smelter_v1",
    powerDrawMw: 15,
    recipes: [
      {
        cycleProgressPerTick: earlyCycleProgressPerTick,
        input: { itemId: "iron_ore", quantity: 1 },
        output: { itemId: "iron_ingot", quantity: 1 },
        recipeId: "iron_ingot",
      },
    ],
  },
  {
    defaultRecipeId: undefined,
    kind: "processor",
    powerDrawMw: 10,
    recipes: [
      {
        cycleProgressPerTick: earlyCycleProgressPerTick,
        input: { itemId: "iron_ingot", quantity: 2 },
        output: { itemId: "iron_plate", quantity: 1 },
        recipeId: "iron_plate",
      },
      {
        cycleProgressPerTick: earlyCycleProgressPerTick,
        input: { itemId: "iron_ingot", quantity: 1 },
        output: { itemId: "iron_rod", quantity: 1 },
        recipeId: "iron_rod",
      },
    ],
  },
];

const unique = (values: ReadonlyArray<string>) => values.filter((value, index) => values.indexOf(value) === index);

export const findBuildableDefinition = (buildableId: string) =>
  BUILDABLE_DEFINITIONS.find((definition) => definition.buildableId === buildableId);

export const findGeneratorDefinition = (buildableId: string) =>
  findBuildableDefinition(buildableId)?.generator;

export const findMachineDefinition = (kind: string) =>
  MACHINE_DEFINITIONS.find((definition) => definition.kind === kind);

export const machineStartsWithoutSelectedRecipe = (kind: string) =>
  findMachineDefinition(kind)?.defaultRecipeId === undefined;

export const findMachineRecipe = (kind: string, recipeId: string | undefined) =>
  findMachineDefinition(kind)?.recipes.find((recipe) => recipe.recipeId === recipeId);

export const inputAcceptedItemIdsForKind = (kind: string) =>
  unique(
    (findMachineDefinition(kind)?.recipes ?? []).flatMap((recipe) =>
      recipe.input === undefined ? [] : [recipe.input.itemId]
    ),
  );

export const outputAcceptedItemIdsForKind = (kind: string) =>
  unique((findMachineDefinition(kind)?.recipes ?? []).map((recipe) => recipe.output.itemId));
