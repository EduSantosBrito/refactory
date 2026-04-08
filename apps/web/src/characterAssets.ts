import type { AssetId } from "@refactory/contracts/worlds";
import type { CharacterName } from "./models/Character";

export const DEFAULT_ASSET_ID: AssetId = "BAR-001";

const CHARACTER_ASSET_META: Record<
  AssetId,
  {
    readonly characterName: CharacterName;
    readonly tagColor: string;
  }
> = {
  "BAR-001": {
    characterName: "Barbara",
    tagColor: "#ffc000",
  },
  "FLA-002": {
    characterName: "Fernando",
    tagColor: "#ff0066",
  },
  "FRO-003": {
    characterName: "Finn",
    tagColor: "#00e639",
  },
  "RPA-004": {
    characterName: "Rae",
    tagColor: "#ff3300",
  },
};

export const getCharacterAssetMeta = (assetId: AssetId) =>
  CHARACTER_ASSET_META[assetId];
