export type ModelProps = {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  visible?: boolean;
};

export type TreeSize = "sm" | "md" | "lg";

/**
 * Animal Crossing-inspired warm palette.
 * Smooth, saturated, toylike. Everything should feel like painted wood or soft plastic.
 * roughness 0.5-0.65 across the board for that matte-plastic feel.
 */
export const COLORS = {
  // Smelter — warm terracotta / coral
  smelter: "#e8845a",
  smelterDark: "#c4633a",
  smelterLight: "#f2a67d",

  // Processor — soft mint
  processor: "#5ec4b6",
  processorDark: "#3da396",
  processorLight: "#8ad8cd",

  // Burner — warm wine / burgundy
  burner: "#c95d5d",
  burnerDark: "#9c3f3f",
  burnerLight: "#e08585",

  // Storage — warm cream / ivory
  storage: "#f0e8dc",
  storageDark: "#c9bfb0",
  storageAccent: "#7ec8c8",

  // Iron node
  rock: "#9a8e82",
  rockLight: "#b5a898",
  ore: "#e8945a",
  oreGlow: "#f0b070",

  // Player
  hardHat: "#f5d24a",
  hardHatDark: "#d4b032",
  skin: "#f5cba0",
  overalls: "#5b9bd5",
  overallsDark: "#4680b8",
  hair: "#e8756a",
  backpack: "#e8845a",
  backpackDark: "#c4633a",

  // Nature
  canopy: "#5cb85c",
  canopyDark: "#3e8e3e",
  canopyLight: "#7ecf7e",
  trunk: "#a0724a",
  trunkDark: "#7a5535",
  trunkPalm: "#c4886a",
  trunkPalmDark: "#a06848",

  // Flowers
  flowerPurple: "#b06cc8",
  flowerRed: "#e85858",
  flowerYellow: "#f0c830",
  stem: "#4a9e5c",

  // Ground cover
  mushroomCap: "#d44040",
  mushroomStem: "#f0e6d4",

  // Rocks / stones
  stone: "#8a8580",
  stoneDark: "#6e6a66",
  stoneLight: "#a8a4a0",

  // Power
  pole: "#8b6b4a",
  poleDark: "#6b4e35",
  electric: "#5cc8e8",
  electricGlow: "#90e0f0",

  // Rocket
  rocketBody: "#f0ece6",
  rocketNose: "#e86050",

  // Fire / glow
  glow: "#f5a842",
  glowHot: "#f07830",
  flame: "#f5d060",

  // Environment
  pedestal: "#3a4a3a",
  pedestalEdge: "#4a5c4a",
  ground: "#2a3828",
  groundLight: "#3a4a38",
} as const;

/** Shared material props for the warm plastic-toy look */
export const MAT = { roughness: 0.55, metalness: 0 } as const;

/** Flat-shaded matte material for foliage — faceted low-poly look */
export const FOLIAGE = {
  roughness: 0.85,
  metalness: 0,
  flatShading: true,
} as const;

/** Flat-shaded matte material for bark/trunks */
export const BARK = {
  roughness: 0.9,
  metalness: 0,
  flatShading: true,
} as const;

/** Flat-shaded matte material for stone/rock */
export const STONE_MAT = {
  roughness: 0.92,
  metalness: 0,
  flatShading: true,
} as const;
