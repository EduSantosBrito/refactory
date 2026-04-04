import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AtomRegistry } from "effect/unstable/reactivity";
import type { Group } from "three";
import type { ModelProps } from "./colors";
import { syncMinerMotion } from "./Miner.state";
import type { StatusPoleStatus } from "./StatusPole";
import { MinerFoundation } from "./MinerFoundation";
import { MinerTop } from "./MinerTop";

type MinerProps = ModelProps & {
  status?: StatusPoleStatus;
};

export function Miner({ status = "green", ...props }: MinerProps) {
  const chassisRef = useRef<Group>(null);
  const registryRef = useRef<AtomRegistry.AtomRegistry | null>(null);

  if (registryRef.current === null) {
    registryRef.current = AtomRegistry.make();
  }

  const registry = registryRef.current;

  useEffect(() => {
    return () => {
      registry.dispose();
    };
  }, [registry]);

  useFrame(({ clock }) => {
    if (!chassisRef.current) return;

    const { drop } = syncMinerMotion(registry, clock.elapsedTime);
    chassisRef.current.position.y = -drop;
  });

  return (
    <group {...props}>
      <group ref={chassisRef}>
        <group position={[0, 0.42, 0]}>
          <MinerFoundation registry={registry} />
          <MinerTop position={[0, 0.105, 0]} status={status} />
        </group>
      </group>
    </group>
  );
}
