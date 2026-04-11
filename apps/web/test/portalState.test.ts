import { expect, test } from "bun:test";
import { isPortalHandoff, parsePortalParams } from "../src/portal/portalState";

test("portal params only include the Vibe Jam forwarded keys", () => {
  const params = parsePortalParams(
    new URLSearchParams({
      color: "red",
      portal: "true",
      ref: "previous-game.example",
      scene: "debug",
      username: "Operator",
      worldId: "portal-world-1",
      unknown: "ignored",
    }),
  );

  expect(params).toEqual({
    color: "red",
    ref: "previous-game.example",
    username: "Operator",
  });
});

test("portal handoff is detected from portal=true with ref optional", () => {
  expect(isPortalHandoff(new URLSearchParams("portal=true"))).toBe(true);
  expect(
    isPortalHandoff(
      new URLSearchParams("portal=true&username=Operator&color=red"),
    ),
  ).toBe(true);
  expect(
    isPortalHandoff(new URLSearchParams("ref=previous-game.example")),
  ).toBe(true);
  expect(isPortalHandoff(new URLSearchParams("portal=false"))).toBe(false);
  expect(isPortalHandoff(new URLSearchParams("ref="))).toBe(false);
  expect(isPortalHandoff(new URLSearchParams("username=Operator"))).toBe(false);
});
