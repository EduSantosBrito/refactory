import { expect, test } from "bun:test";
import { buildBackPortalUrl, buildExitUrl } from "../src/portal/portalRedirect";

test("forward portal defaults to the canonical Refactory play route as ref", () => {
  const originalWindow = globalThis.window;

  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          href: "http://localhost:3000/play?worldId=portal-world-1&ref=previous-game.example",
        },
      },
    });

    const url = new URL(
      buildExitUrl({
        debug: "ignored",
        portal: "true",
        ref: "previous-game.example",
        username: "Operator",
      }),
    );

    expect(url.searchParams.has("debug")).toBe(false);
    expect(url.searchParams.has("portal")).toBe(false);
    expect(url.searchParams.get("username")).toBe("Operator");
    expect(url.searchParams.get("ref")).toBe(
      "https://refactory.fun/play?worldId=portal-world-1",
    );
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
});

test("forward portal uses Refactory as ref while preserving forwarded params", () => {
  const url = new URL(
    buildExitUrl(
      {
        color: "red",
        ref: "previous-game.example",
        username: "Operator",
      },
      "https://refactory.example/play?worldId=portal-world-1",
    ),
  );

  expect(url.origin + url.pathname).toBe("https://vibej.am/portal/2026");
  expect(url.searchParams.get("color")).toBe("red");
  expect(url.searchParams.get("username")).toBe("Operator");
  expect(url.searchParams.get("ref")).toBe(
    "https://refactory.example/play?worldId=portal-world-1",
  );
});

test("back portal returns to ref without forcing portal=true", () => {
  const backUrl = buildBackPortalUrl(
    {
      portal: "true",
      ref: "previous-game.example/play?portal=true",
      unsupported: "ignored",
      username: "Operator",
    },
    "https://refactory.example/play?worldId=portal-world-1",
  );

  expect(backUrl).not.toBeNull();

  const url = new URL(backUrl ?? "");
  expect(url.origin + url.pathname).toBe("https://previous-game.example/play");
  expect(url.searchParams.has("portal")).toBe(false);
  expect(url.searchParams.has("unsupported")).toBe(false);
  expect(url.searchParams.get("username")).toBe("Operator");
  expect(url.searchParams.get("ref")).toBe(
    "https://refactory.example/play?worldId=portal-world-1",
  );
});
