import { expect, test } from "bun:test";
import { DefaultFixturePlacement, GPY_7 } from "./maps.ts";

const tileKey = (coordinate: { readonly x: number; readonly y: number }) =>
  `${coordinate.x}:${coordinate.y}`;

test("GPY-7 default fixtures occupy unique buildable tiles", () => {
  const occupied = new Set<string>();

  for (const node of GPY_7.resourceNodes) {
    occupied.add(tileKey(node.origin));
  }

  for (const fixture of GPY_7.defaultFixtures) {
    expect(
      DefaultFixturePlacement.isGoodTile({
        coordinate: fixture.origin,
        occupied,
        tiles: GPY_7.tiles,
      }),
    ).toBe(true);
    occupied.add(tileKey(fixture.origin));
  }
});

test("GPY-7 places progression fixtures around spawn", () => {
  expect(
    GPY_7.defaultFixtures.map((fixture) => [
      fixture.buildableId,
      fixture.origin,
    ]),
  ).toEqual([
    ["rocket", { x: 6, y: 3 }],
    ["portal_entry", { x: 8, y: 4 }],
    ["portal_exit", { x: 9, y: 2 }],
    ["wip_sign", { x: 4, y: 4 }],
    ["modular_storage", { x: 9, y: 5 }],
  ]);
});
