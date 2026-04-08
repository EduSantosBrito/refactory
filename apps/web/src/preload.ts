import { logWorldLoadEventOnce } from "./world/worldLoadLog";

let worldExperiencePromise: Promise<void> | undefined;
let vossPortraitPromise: Promise<void> | undefined;

export function preloadWorldExperience(): Promise<void> {
  if (!worldExperiencePromise) {
    logWorldLoadEventOnce("world-starts-to-load", "World starts to load");
    worldExperiencePromise = Promise.all([
      import("./World"),
      import("./world/WorldScene").then((module) => {
        module.preloadInitialWorldSceneData();
      }),
      import("./world/WorldNature"),
      import("./world/PlayerController"),
    ]).then(() => undefined);
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
