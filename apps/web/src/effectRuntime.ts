import { Layer, ManagedRuntime } from "effect";
import { BrowserStorage } from "./browserStorage.service";
import { TelemetryLive } from "./telemetry";

const appMemoMap = Layer.makeMemoMapUnsafe();

const runtime = ManagedRuntime.make(Layer.mergeAll(BrowserStorage.Live, TelemetryLive), {
  memoMap: appMemoMap,
});

export const runPromise = runtime.runPromise.bind(runtime);
export const runFork = runtime.runFork.bind(runtime);
export const runSync = runtime.runSync.bind(runtime);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void runtime.dispose();
  });
}
