import type { ModelProps } from "../colors";
import { FOUNDATION_HALF_H, BODY_HALF_H_MAP, LEG_H, type BodyHeight } from "./palette";
import { Foundation } from "./Foundation";
import { Body } from "./Body";
import {
  PowerUnit,
  AntennaModule,
  ChimneyStack,
  TurbinePlate,
  DrillHead,
  TankCluster,
  HeatSinkArray,
  SortingFrame,
} from "./TopModules";
import {
  SideTank,
  SideVent,
  SidePipe,
  SidePanel,
  SideLamp,
} from "./SideAttachments";

export type TopModuleType =
  | "power"
  | "antenna"
  | "chimney"
  | "turbine"
  | "drill"
  | "tanks"
  | "heatsink"
  | "sorting";

export type SideAttachmentDef = {
  type: "tank" | "vent" | "pipe" | "panel" | "lamp";
  /** Octagon face index 0-7. Face 0 points roughly +Z. */
  face: number;
  /** Vertical offset on body (default 0 = body center) */
  y?: number;
};

export type ModularBuildingProps = ModelProps & {
  topModule?: TopModuleType;
  sideAttachments?: SideAttachmentDef[];
  legSize?: "sm" | "md";
  bodyHeight?: BodyHeight;
};

const TOP = {
  power: PowerUnit,
  antenna: AntennaModule,
  chimney: ChimneyStack,
  turbine: TurbinePlate,
  drill: DrillHead,
  tanks: TankCluster,
  heatsink: HeatSinkArray,
  sorting: SortingFrame,
} as const;

const SIDE = {
  tank: SideTank,
  vent: SideVent,
  pipe: SidePipe,
  panel: SidePanel,
  lamp: SideLamp,
} as const;

/** Body main-volume apothem — flush distance to flat octagon faces */
const FACE_R = 0.265 * Math.cos(Math.PI / 8);

export function ModularBuilding({
  topModule = "power",
  sideAttachments = [
    { type: "tank", face: 1 },
    { type: "vent", face: 5 },
  ],
  legSize = "sm",
  bodyHeight = "standard",
  ...props
}: ModularBuildingProps) {
  const bodyHalfH = BODY_HALF_H_MAP[bodyHeight];
  const legH = LEG_H[legSize];
  const foundY = legH + FOUNDATION_HALF_H;
  const bodyY = legH + FOUNDATION_HALF_H * 2 + bodyHalfH;
  const topY = legH + FOUNDATION_HALF_H * 2 + bodyHalfH * 2;

  const TopMod = TOP[topModule];

  return (
    <group {...props}>
      <group position={[0, foundY, 0]}>
        <Foundation legSize={legSize} />
      </group>

      <group position={[0, bodyY, 0]}>
        <Body height={bodyHeight} />
      </group>

      <group position={[0, topY, 0]}>
        <TopMod />
      </group>

      {sideAttachments.map((att, i) => {
        const a = (att.face / 8) * Math.PI * 2 + Math.PI / 8;
        const Comp = SIDE[att.type];
        return (
          <group
            key={`sa-${i}`}
            position={[
              Math.sin(a) * FACE_R,
              bodyY + (att.y ?? 0),
              Math.cos(a) * FACE_R,
            ]}
            rotation={[0, -a, 0]}
          >
            <Comp />
          </group>
        );
      })}
    </group>
  );
}
