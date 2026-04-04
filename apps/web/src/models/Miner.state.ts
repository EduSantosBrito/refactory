import { Atom } from "effect/unstable/reactivity";
import type { AtomRegistry } from "effect/unstable/reactivity";

export const SQUAT_PERIOD = 3;
export const SQUAT_DROP = 0.1;

export function squatDrop(elapsedTime: number) {
  return SQUAT_DROP * (1 - Math.cos(elapsedTime * ((2 * Math.PI) / SQUAT_PERIOD))) / 2;
}

export interface MinerMotionState {
  readonly elapsedTime: number;
  readonly drop: number;
  readonly nearBottom: boolean;
}

export interface GrinderSmokeSpawn {
  readonly time: number;
  readonly idx: number;
  readonly angle: number;
  readonly radius: number;
  readonly scale: number;
}

export interface GrinderSmokeState {
  readonly wasAtBottom: boolean;
  readonly spawnQueue: ReadonlyArray<GrinderSmokeSpawn>;
}

const minerElapsedTimeAtom = Atom.make(0).pipe(
  Atom.keepAlive,
  Atom.withLabel("miner.elapsedTime"),
);

const minerMotionAtom = Atom.make((get): MinerMotionState => {
  const elapsedTime = get(minerElapsedTimeAtom);
  const drop = squatDrop(elapsedTime);

  return {
    elapsedTime,
    drop,
    nearBottom: drop > SQUAT_DROP * 0.7,
  };
}).pipe(Atom.keepAlive, Atom.withLabel("miner.motion"));

export const syncMinerMotion = (
  registry: AtomRegistry.AtomRegistry,
  elapsedTime: number,
) => {
  if (registry.get(minerElapsedTimeAtom) !== elapsedTime) {
    registry.set(minerElapsedTimeAtom, elapsedTime);
  }

  return registry.get(minerMotionAtom);
};
