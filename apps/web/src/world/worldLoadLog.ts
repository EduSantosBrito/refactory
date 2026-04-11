import { Effect, Exit, Match } from "effect";
import type { AnySpan, Span } from "effect/Tracer";
import { runSync } from "../effectRuntime";

const loggedEventKeys = new Set<string>();

type ActiveWorldRenderFlow = {
  readonly span: Span;
  readonly startedAtMs: number;
};

let activeWorldRenderFlow: ActiveWorldRenderFlow | undefined;

const finishKeys = new Set(["world-visual-ready", "world-visual-ready-timeout"]);
const isWorldMilestoneKey = (key: string) => key.startsWith("world-");

const startWorldRenderFlow = Effect.fn("web.world.render.flow.start")(function* (
  triggerKey: string,
) {
  if (activeWorldRenderFlow !== undefined) {
    return activeWorldRenderFlow;
  }

  const startedAtMs = Date.now();
  const span = yield* Effect.makeSpan("web.world.render.flow", {
    attributes: {
      "world.flow.trigger_key": triggerKey,
      "world.flow.triggered_at": new Date(startedAtMs).toISOString(),
    },
  });

  const flow = {
    span,
    startedAtMs,
  } as const;

  activeWorldRenderFlow = flow;

  return flow;
});

const traceWorldRenderMilestone = Effect.fn("web.world.render.milestone")(function* (
  flow: ActiveWorldRenderFlow,
  key: string,
  message: string,
) {
  const elapsedMs = Date.now() - flow.startedAtMs;

  yield* Effect.void.pipe(
    Effect.withSpan("web.world.render.milestone", {
      attributes: {
        "world.milestone.elapsed_ms": elapsedMs,
        "world.milestone.key": key,
        "world.milestone.message": message,
      },
      parent: flow.span as AnySpan,
    }),
  );
});

const completeWorldRenderFlow = Effect.fn("web.world.render.flow.complete")(function* (
  flow: ActiveWorldRenderFlow,
  completedKey: string,
) {
  const completedAtMs = Date.now();
  const totalRenderMs = completedAtMs - flow.startedAtMs;

  flow.span.attribute("world.flow.completed", true);
  flow.span.attribute("world.flow.completed_key", completedKey);
  flow.span.attribute("world.flow.total_render_ms", totalRenderMs);
  flow.span.end(BigInt(completedAtMs) * 1_000_000n, Exit.void);

  activeWorldRenderFlow = undefined;
  loggedEventKeys.clear();
});

const traceWorldLoadEventEffect = Effect.fn("web.world.render.event")(function* (
  key: string,
  message: string,
) {
  if (!isWorldMilestoneKey(key)) {
    yield* Effect.void.pipe(
      Effect.withSpan("web.world.render.event.misc", {
        attributes: {
          "world.render.milestone.key": key,
          "world.render.milestone.message": message,
        },
      }),
    );
    return;
  }

  const flow = yield* startWorldRenderFlow(key);
  yield* traceWorldRenderMilestone(flow, key, message);

  yield* Match.value(finishKeys.has(key)).pipe(
    Match.when(true, () => completeWorldRenderFlow(flow, key)),
    Match.orElse(() => Effect.void),
  );
});

export const withWorldFlowSpan = <A, E, R>(
  name: string,
  attributes: Record<string, unknown>,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => {
  const parent = activeWorldRenderFlow?.span;

  return effect.pipe(
    Effect.withSpan(
      name,
      parent === undefined
        ? { attributes }
        : { attributes, parent: parent as AnySpan },
    ),
  );
};

export function logWorldLoadEvent(key: string, message: string): void {
  runSync(traceWorldLoadEventEffect(key, message));
}

export function logWorldLoadEventOnce(
  key: string,
  message: string,
): void {
  if (loggedEventKeys.has(key)) {
    return;
  }

  loggedEventKeys.add(key);
  logWorldLoadEvent(key, message);
}
