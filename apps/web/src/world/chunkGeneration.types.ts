export type ChunkBounds = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
};

export type ChunkGenerationElement = {
  readonly id: number;
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly ry: number;
  readonly sc: number;
  readonly size: "sm" | "md" | "lg";
  readonly bounds: ChunkBounds;
};

export type ChunkGenerationPayload = {
  readonly cx: number;
  readonly cz: number;
  readonly colors: Float32Array;
  readonly elements: ReadonlyArray<ChunkGenerationElement>;
  readonly heights: Float32Array;
  readonly terrainBounds: ChunkBounds;
};

export type ChunkGenerationRequestMessage = {
  readonly _tag: "generate";
  readonly cx: number;
  readonly cz: number;
  readonly id: number;
};

export type ChunkGenerationResponseMessage =
  | {
      readonly _tag: "generated";
      readonly id: number;
      readonly payload: ChunkGenerationPayload;
    }
  | {
      readonly _tag: "failed";
      readonly id: number;
      readonly message: string;
    };
