import { Effect } from "effect";
import { runPromise } from "./effectRuntime";
import { logWorldLoadEventOnce, withWorldFlowSpan } from "./world/worldLoadLog";

let worldExperiencePromise: Promise<void> | undefined;
let vossPortraitPromise: Promise<void> | undefined;

export function preloadWorldExperience(): Promise<void> {
  if (!worldExperiencePromise) {
    logWorldLoadEventOnce("world-starts-to-load", "World starts to load");
    worldExperiencePromise = runPromise(
      withWorldFlowSpan(
        "web.world.preload.bundle",
        {
          operation: "world.preload.bundle",
        },
        Effect.all(
          [
            withWorldFlowSpan(
              "web.world.preload.world",
              {
                operation: "world.preload.module",
                module: "World",
              },
              Effect.tryPromise({
                try: () => import("./World"),
                catch: (error) => new Error(String(error)),
              }),
            ),
            withWorldFlowSpan(
              "web.world.preload.worldScene",
              {
                operation: "world.preload.module",
                module: "WorldScene",
              },
              Effect.tryPromise({
                try: () =>
                  import("./world/WorldScene").then((module) => {
                    module.preloadInitialWorldSceneData();
                  }),
                catch: (error) => new Error(String(error)),
              }),
            ),
            withWorldFlowSpan(
              "web.world.preload.worldNature",
              {
                operation: "world.preload.module",
                module: "WorldNature",
              },
              Effect.tryPromise({
                try: () => import("./world/WorldNature"),
                catch: (error) => new Error(String(error)),
              }),
            ),
            withWorldFlowSpan(
              "web.world.preload.playerController",
              {
                operation: "world.preload.module",
                module: "PlayerController",
              },
              Effect.tryPromise({
                try: () => import("./world/PlayerController"),
                catch: (error) => new Error(String(error)),
              }),
            ),
          ],
          { concurrency: "unbounded" },
        ).pipe(Effect.asVoid),
      ),
    );
  }

  return worldExperiencePromise;
}

export function preloadVossPortrait(): Promise<void> {
  vossPortraitPromise ??= Promise.all([
    import("./components/VossPortrait"),
    import("./models/DirectorVoss"),
  ]).then(() => undefined);

  return vossPortraitPromise;
}
