import { Data, Effect } from "effect";
import type {
  ChunkGenerationPayload,
  ChunkGenerationRequestMessage,
  ChunkGenerationResponseMessage,
} from "./chunkGeneration.types";

type PendingRequest = {
  readonly reject: (reason?: unknown) => void;
  readonly resolve: (payload: ChunkGenerationPayload) => void;
};

export class ChunkWorkerCreationError extends Data.TaggedError(
  "ChunkWorkerCreationError",
)<{
  readonly cause: unknown;
}> {}

export class ChunkWorkerRequestError extends Data.TaggedError(
  "ChunkWorkerRequestError",
)<{
  readonly cause: unknown;
}> {}

export class ChunkWorkerUnavailableError extends Data.TaggedError(
  "ChunkWorkerUnavailableError",
)<{
  readonly reason: string;
}> {}

export class ChunkWorkerClient {
  private nextRequestId = 0;
  private readonly pending = new Map<number, PendingRequest>();
  private worker: Worker | null;

  private constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener("message", this.handleMessage);
    this.worker.addEventListener("error", this.handleError);
  }

  static readonly make = Effect.try({
    try: () =>
      new Worker(new URL("./chunkGeneration.worker.ts", import.meta.url), {
        type: "module",
      }),
    catch: (cause) => new ChunkWorkerCreationError({ cause }),
  }).pipe(Effect.map((worker) => new ChunkWorkerClient(worker)));

  private readonly handleMessage = (
    event: MessageEvent<ChunkGenerationResponseMessage>,
  ) => {
    const message = event.data;
    const pending = this.pending.get(message.id);
    if (pending === undefined) {
      return;
    }

    this.pending.delete(message.id);

    if (message._tag === "generated") {
      pending.resolve(message.payload);
      return;
    }

    pending.reject(new Error(message.message));
  };

  private readonly handleError = (event: ErrorEvent) => {
    for (const pending of this.pending.values()) {
      pending.reject(
        new Error(event.message || "Chunk worker terminated unexpectedly"),
      );
    }
    this.pending.clear();
  };

  generate = Effect.fn("web.world.chunk_worker.generate")(function* (
    this: ChunkWorkerClient,
    cx: number,
    cz: number,
  ) {
    const worker = this.worker;
    if (worker === null) {
      return yield* new ChunkWorkerUnavailableError({
        reason: "Chunk worker unavailable",
      });
    }

    const id = this.nextRequestId++;

    return yield* Effect.tryPromise({
      try: () =>
        new Promise<ChunkGenerationPayload>((resolve, reject) => {
          this.pending.set(id, { reject, resolve });

          const message: ChunkGenerationRequestMessage = {
            _tag: "generate",
            cx,
            cz,
            id,
          };
          worker.postMessage(message);
        }),
      catch: (cause) => new ChunkWorkerRequestError({ cause }),
    }).pipe(
      Effect.tapError(() =>
        Effect.sync(() => {
          this.pending.delete(id);
        }),
      ),
    );
  });

  dispose = Effect.fn("web.world.chunk_worker.dispose")(function* (this: ChunkWorkerClient) {
    const worker = this.worker;
    if (worker === null) {
      return;
    }

    worker.removeEventListener("message", this.handleMessage);
    worker.removeEventListener("error", this.handleError);
    worker.terminate();
    this.worker = null;

    for (const pending of this.pending.values()) {
      pending.reject(new Error("Chunk worker disposed"));
    }
    this.pending.clear();
  });
}
