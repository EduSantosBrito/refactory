import { memo } from "react";
import { Bush } from "../models/nature/Bush";
import { DeadTree } from "../models/nature/DeadTree";
import { DetailedTree } from "../models/nature/DetailedTree";
import { FlatTopTree } from "../models/nature/FlatTopTree";
import { Flower } from "../models/nature/Flower";
import { GrassClump } from "../models/nature/GrassClump";
import { Log } from "../models/nature/Log";
import { Mushroom } from "../models/nature/Mushroom";
import { OakTree } from "../models/nature/OakTree";
import { PineTree } from "../models/nature/PineTree";
import { Rock } from "../models/nature/Rock";
import { RockFormation } from "../models/nature/RockFormation";
import { Stump } from "../models/nature/Stump";

type NatureRenderable = {
  readonly id: number;
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly ry: number;
  readonly sc: number;
  readonly size: "sm" | "md" | "lg";
};

const NatureItem = memo(function NatureItem({
  el,
}: {
  readonly el: NatureRenderable;
}) {
  const pos: [number, number, number] = [el.x, el.y, el.z];
  const rot: [number, number, number] = [0, el.ry, 0];

  switch (el.type) {
    case "oak":
      return (
        <OakTree position={pos} rotation={rot} scale={el.sc} size={el.size} />
      );
    case "pine":
      return (
        <PineTree position={pos} rotation={rot} scale={el.sc} size={el.size} />
      );
    case "detailed":
      return (
        <DetailedTree
          position={pos}
          rotation={rot}
          scale={el.sc}
          size={el.size}
        />
      );
    case "flattop":
      return (
        <FlatTopTree
          position={pos}
          rotation={rot}
          scale={el.sc}
          size={el.size}
        />
      );
    case "dead":
      return (
        <DeadTree position={pos} rotation={rot} scale={el.sc} size={el.size} />
      );
    case "bush":
      return (
        <Bush position={pos} rotation={rot} scale={el.sc} size={el.size} />
      );
    case "rock":
      return (
        <Rock position={pos} rotation={rot} scale={el.sc} size={el.size} />
      );
    case "formation":
      return (
        <RockFormation
          position={pos}
          rotation={rot}
          scale={el.sc}
          size={el.size}
        />
      );
    case "stump":
      return (
        <Stump position={pos} rotation={rot} scale={el.sc} size={el.size} />
      );
    case "grass":
      return <GrassClump position={pos} rotation={rot} scale={el.sc} />;
    case "flower":
      return <Flower position={pos} rotation={rot} scale={el.sc} />;
    case "mushroom":
      return <Mushroom position={pos} rotation={rot} scale={el.sc} />;
    case "log":
      return <Log position={pos} rotation={rot} scale={el.sc} />;
    default:
      return null;
  }
});

export const WorldNature = memo(function WorldNature({
  elements,
}: {
  readonly elements: readonly NatureRenderable[];
}) {
  return (
    <group>
      {elements.map((el) => (
        <NatureItem key={el.id} el={el} />
      ))}
    </group>
  );
});
