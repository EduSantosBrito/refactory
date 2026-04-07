# Backend Design

## Goal

Define the backend architecture for Refactory's world simulation.

This document covers:

- how world state stays in sync
- how item flow should work across machines, belts, inventories, storage, and quotas
- which Effect v4 APIs to use for each backend scenario
- which Effect APIs are a poor fit for the hot simulation path

It is based on:

- `GAME_DESIGN.md`
- the current API/backend work already done in `apps/api`
- `effect-smol` patterns and docs

## Scope

This is the design for the runtime backend, not the UI.

Design ownership is split like this:

- `GAME_DESIGN.md` owns gameplay goals, tier structure, narrative triggers, and tuning values such as machine throughput, machine MW draw, generator MW output, and target friction.
- `BACKEND_DESIGN.md` owns authoritative runtime mechanics, command semantics, persistence, replication, and transport.
- When this document depends on concrete balance numbers, it should reference `GAME_DESIGN.md` instead of duplicating the values.

It assumes:

- world creation already exists
- initial world snapshots already exist
- the next backend step is authoritative runtime simulation

## Core Decisions

These are now locked unless we discover a major contradiction.

- World simulation is server-authoritative.
- The server runs a fixed-step tick.
- Initial target tick rate is `10 Hz`.
- Clients render visuals smoothly between server updates.
- Clients do not invent factory truth locally.
- Snapshot fetch, world creation, and other non-latency-sensitive control-plane actions use HTTP.
- Latency-sensitive world interaction uses one authenticated duplex websocket per joined world session.
- World mutations are expressed as commands, not client-side state patches.
- Runtime state uses stable world-local object ids.
- Conflicting commands resolve by authoritative server enqueue order inside the per-world queue.
- `commandId` is idempotent per actor and world.
- Most player-built buildings occupy `1` grid tile plus a cardinal facing.
- Ports are defined in local space and rotate with building facing.
- Items are discrete whole units.
- Fractional progress is allowed only inside accumulators like machine work progress.
- Belts are transport lanes in a graph, not physics objects.
- Belt construction is endpoint-to-endpoint from one output port to one input port.
- The server computes canonical belt routes; clients may show local preview ghosts.
- Belt items have continuous progress plus a minimum spacing rule.
- Containers share one core item-transfer model.
- Player inventory and general storage are slot/stack based.
- Machine buffers are process-oriented typed/count buffers.
- Inter-object transfer is mostly pull/accept based.
- Manual gameplay transfers still use the same atomic transfer model, but legal source/target roles are restricted by gameplay rules.
- Machines block when output is full.
- Power uses both coverage and total generation capacity.
- Generators and poles project powered ranges onto tiles.
- Overlapping powered ranges form one continuous energized network.
- Only currently running machines consume power in v1.
- If active machine demand exceeds current generated supply, the whole connected network trips.
- A tripped network stays down until a player explicitly restarts it, and a bad restart may trip again immediately.
- Burners scale fuel burn to current production demand instead of always burning at max rate.
- Delivery quota progress increments when modular storage accepts valid items.
- Quota-counted items remain reserved in modular storage in v1.
- Players do not withdraw accepted quota items in v1.
- Shipment launch is a separate progression action, not the moment quota counts.
- The handcrafted map is data-driven and instantiates fixed fixtures like resource nodes, modular storage anchors, and environmental validation zones.
- Grid tiles carry altitude, and belt steps may change altitude by at most `1` per adjacent move.
- Modular storage is a fixed world object with `4` input ports in v1.
- Joining or resyncing a world uses a full runtime snapshot fetched over HTTP.
- Ongoing sync uses websocket deltas after the snapshot.
- Any missed delta sequence triggers full snapshot resync.
- Runtime state survives restarts via periodic checkpoints.
- The simulation should be implemented with domain modules, not a generic ECS-first engine.

## Why Server Authority

The game design requires one shared truth for:

- shared factories
- shared world progression
- shared tutorial state
- late join
- shared quota progress
- natural backpressure

If the client simulates truth locally, these cases become fragile:

- two players taking the same stack
- one player removing a belt while another item is entering it
- storage counting an item that a client only predicted
- quota/UI drift between clients

Server authority solves those by making the backend the only source of gameplay truth.

## Smoothness Model

Server authority does not mean choppy visuals.

The split is:

- server owns gameplay state
- client owns presentation smoothing

Examples:

- The server says a belt item moved from `0.40` to `0.50` progress between ticks.
- The client interpolates that smoothly at render rate.
- The server says a miner is `running` with an animation phase.
- The client renders smooth motion from that phase.
- The server says storage now contains `38 iron_ingot`.
- The client updates UI from authoritative state, not a guessed local number.

Client prediction should stay limited to:

- local avatar movement feel
- placement ghosts and UI affordances

Client prediction should not own:

- belts
- machine outputs
- storage counts
- inventory truth
- quota progress

## Runtime Item Model

All user-facing item state is discrete.

Example with `120 items/min`:

- `120/min = 2/sec`
- at `10 Hz`, the producer adds `0.2` work per tick
- after `5` ticks, it emits `1` whole item

This means:

- inventories store integer item counts/stacks
- storage stores integer item counts/stacks
- belts carry whole item units
- quotas count whole accepted items
- machines may keep fractional internal progress

This avoids weird states like:

- `59.4 / 60 iron_ingot`
- a storage holding `13.7` items
- a player carrying a partial ingot

## World Object Model

The runtime should separate the world into three categories.

### 1. Containers

Containers hold items.

Examples:

- player inventory
- starter box
- normal container
- modular storage
- machine input buffer
- machine output buffer
- burner fuel buffer

### 2. Transport Lanes

Transport lanes move items between containers.

Examples:

- straight belts
- curved belts
- splitter outputs
- merger outputs

### 3. Observers / Sinks

These react to accepted transfers but do not own normal item movement rules.

Examples:

- tutorial objective progress
- quota progress
- boss chat triggers
- future achievements

Quests should observe state transitions.
Quests should not own items.

## Container Rules

All manual item movement should be modeled as an atomic transfer between containers.

Examples:

- starter box -> player inventory
- player inventory -> burner fuel buffer
- machine output buffer -> player inventory
- player inventory -> normal container

That gives one backend rule shape instead of a custom rule per screen.

Recommended split:

- player inventory and general storage: slot/stack containers
- machine buffers: typed/count buffers

This matches game semantics better than making every machine behave like a backpack.

Gameplay legality matrix for v1:

- manual put is allowed only into `machine_input` and `burner_fuel`
- manual take is allowed from ordinary containers and machine output buffers
- manual put is forbidden into `machine_output`
- manual put is forbidden into `quota_storage`
- manual take is forbidden from `quota_storage`
- manual insertion into machine input must respect the machine's currently selected recipe
- manual insertion into fuel buffers must respect that generator's accepted fuel rules

This keeps one backend transfer primitive while still preserving the intended automation loop.

## Machine Rules

Each processing machine should have:

- stable object id
- recipe / configuration
- power state
- work progress accumulator
- input buffer(s)
- output buffer(s)
- status like `running`, `idle`, `blocked`, `unpowered`

Flow:

1. machine pulls needed input into its input buffer
2. machine progresses work over time
3. when work completes, it tries to place whole output items in output buffer
4. if output buffer is full, it blocks

This is required for:

- natural backpressure
- honest throughput
- useful efficiency metrics
- deterministic sync

Additional v1 rules:

- single-recipe machines auto-configure on placement
- multi-recipe machines require explicit recipe selection before accepting manual input
- changing recipe clears incompatible buffered contents into the acting player's inventory when possible
- recipe-change overflow is destroyed if the acting inventory cannot hold it
- recipe changes cancel partial work progress

## Power Network Rules

Exact generator stats and machine MW draws live in `GAME_DESIGN.md`.
This section defines the simulation rules.

The runtime power model is coverage plus capacity.

Core model:

- every active generator contributes current power production and a powered radius
- every power pole contributes only a relay radius and never consumes or generates power in v1
- a pole becomes energized when its relay radius touches tiles already energized by an active generator or another energized pole
- an energized pole then relays power onward through its own radius
- overlapping source and relay ranges merge into one continuous powered network
- a machine is powered only if its tile lies inside an energized range chain that traces back to at least one active generator
- separate energized islands are separate power networks and trip independently

Consumers and demand:

- only currently running machines consume power in v1
- idle machines consume `0`
- blocked machines consume `0`
- belts, poles, modular storage, starter boxes, and ordinary containers consume `0`
- the runtime should expose at least these power-read values per network:
  - current production
  - current consumption
  - max potential consumption
  - max potential capacity

Failure model:

- overload is checked against currently active demand, not hypothetical full-factory load
- if current active demand exceeds current generated supply, the whole network enters `tripped`
- when a network is `tripped`, all machines on that network become unpowered and stop progressing
- the backend does not use brownout scaling in v1
- restart is an explicit command or interaction
- a player may attempt restart at any time
- if the network still lacks enough production after restart, it may come back briefly and trip again on the next power evaluation

Generator families in v1:

- all generator tiers share the same network semantics
- `Burner v1` uses fuel, contributes capacity only while it has valid fuel, and scales fuel burn to actual current production demand
- wind can be placed on any buildable tile, produces low unattended power, and uses a short radius
- heat is placement-gated by valid heat spots defined by the map contract
- coal and nuclear use proximity-gated water validation from map zones in v1 rather than fluid logistics

## Map Data Rules

The map is handcrafted, but runtime bootstrap must still be data-driven.

Recommended map contract shape:

- tile grid with buildability and altitude
- fixed point anchors for mineral nodes, modular storage, starter locations, and other fixed world objects
- environmental zones for placement validation such as water and heat
- world metadata such as spawn/reference points if needed

Do not hardcode fixed resource nodes or modular storage positions in the runtime service.
The runtime should derive them from the authoritative map contract selected by `mapId`.

## Belt Rules

Belts should be modeled as a transport graph.

Each lane should have:

- stable lane/object id
- length
- speed
- ordered whole items
- per-item continuous progress
- minimum spacing constraint
- destination/connection metadata

Do not model belt items as physics bodies.

Do not model belts as pure throughput-only edges.

The graph model is the right middle ground because the design needs:

- visible item travel
- mixed belts
- splitter and merger rules
- selective storage behavior
- natural backpressure

## Placement And Map Rules

- Normal player-built buildings occupy exactly `1` grid tile and one cardinal facing.
- Non-miner buildings can be placed on any empty buildable tile.
- Miners can be placed only on compatible resource-node anchor tiles.
- One resource-node anchor supports exactly one miner.
- Wind generators can be placed on any empty buildable tile in v1.
- Heat generators can be placed only on valid heat zones.
- Coal and nuclear generators validate nearby water by map zone proximity in v1.
- Fixed map fixtures like resource nodes and modular storage come from the handcrafted map contract.
- Modular storage is fixed in v1, is not player-buildable or removable, and exposes one input port on each cardinal side.
- Map validation primitives should use both point anchors and zones.
- Grid tiles include altitude metadata.

## Belt Construction Rules

- A belt connection always runs from one output port to one input port.
- Ports do not connect directly without a belt run between them.
- Players do not place belt tiles one-by-one; one connection command creates one runtime `BeltRun`.
- Each `BeltRun` owns:
  - source port
  - destination port
  - ordered occupied path tiles
  - derived segment geometry
  - in-flight items and progress
- A belt run must contain at least one occupied belt tile.
- A port may have at most one attached belt run.
- Source and destination must belong to different parent objects.
- Each occupied tile belongs to exactly one belt run.
- Belt runs do not overlap, cross, or reuse existing belt tiles in v1.
- If no valid full route exists, the command is rejected and nothing is placed.

Canonical route rules:

- route through orthogonally adjacent empty tiles only
- minimize tile count first
- break remaining ties by fewer turns
- then prefer continuing in the source output direction
- then prefer right turns over left turns
- adjacent route steps may change altitude by at most `1`

This route is computed authoritatively by the server. Client preview is only a placement affordance.

## Transfer Semantics

Inter-object transfer should be mostly pull/accept based.

Examples:

- belt intake pulls from a machine output buffer if it has space
- smelter input pulls from the head of a belt if the recipe accepts the item
- modular storage accepts from the incoming belt only if the item is valid and quota/capacity allow it

This is better than blind push semantics because downstream refusal naturally creates backpressure.

## Quota And Storage Rules

Quota progress should increment on modular storage acceptance, not on production.

That means:

- a smelter producing an ingot does not complete quota by itself
- an item on a belt does not count by itself
- the item counts only when modular storage accepts it

For v1:

- modular storage is input-only
- accepted quota items remain reserved there
- players do not withdraw them again
- modular storage accepts only items currently required by the active quota/tier
- once the quota for an item is met, modular storage stops accepting more of that item
- extra production should back up naturally unless the player routes it elsewhere

Quota counting and shipment launch are separate concepts:

- quota progress increments at storage acceptance time
- shipment launch is a later progression action that consumes already reserved quota items
- `DeliverQuota` is not a hot-path per-item gameplay command in v1

This keeps these truths aligned:

- stored items
- quota progress
- later delivery payload

## Removal And Reconfiguration Rules

- Removing a player-built building refunds its full build cost.
- Removing a belt run refunds its full per-tile build cost.
- Removing a belt run destroys the in-flight items on that belt run.
- Removing a non-belt building transfers its stored contents to the acting player's inventory.
- If that inventory cannot hold all returned contents, overflow is destroyed.
- The first successful destroy action in a world should trigger one shared Voss joke/call for all connected players and never repeat.
- Players may manually insert items only into input or fuel buffers.
- Manual insertion must respect the machine's current recipe or fuel rules.
- Players may not manually insert or withdraw quota-reserved modular storage contents.
- Single-recipe machines auto-configure on placement.
- Multi-recipe machines require explicit recipe selection.
- Changing a machine recipe moves incompatible buffered contents to the acting player's inventory.
- If that inventory cannot hold all returned buffered contents, overflow is destroyed.
- Changing a machine recipe cancels current in-progress work and loses its partial progress.

## Tick Model

The server should process each world on a deterministic phased tick.

Recommended tick phases:

1. collect and validate commands for this tick
2. apply accepted commands in deterministic order
3. recompute affected power/connectivity state
4. progress machine work
5. execute transport and pull/accept transfers
6. apply storage acceptance side effects
7. update quotas, tutorial, and other observers
8. emit deltas and events for connected clients
9. checkpoint if due

The exact phase names may evolve, but the ordering must remain explicit and testable.

## Conflict Resolution

All player mutations should enter a per-world command queue.

The server then:

- resolves them at tick boundaries
- applies them in deterministic server enqueue order
- rejects losers when commands conflict

Ordering and retries:

- each accepted queued command gets a world-local enqueue sequence number
- lower enqueue sequence wins conflicts inside the same tick
- retries must not duplicate side effects
- if the same actor resubmits the same `commandId` with the same payload in the same world, the backend should return the original result
- if the same `commandId` is reused with a different payload, the backend should reject it as an idempotency conflict

Example:

- two players try to take the same item stack
- one command succeeds
- one command is rejected

This prevents dupes, phantom items, and race-condition drift.

## Persistence Model

The hot simulation should run in memory.

Durability should come from periodic checkpoints, not from rebuilding the world from scratch on every read.

Recommended shape:

- in-memory authoritative runtime per active world
- periodic checkpoint of runtime state to SQLite
- on world load, resume from latest checkpoint

Checkpoint data should include at least:

- object graph
- container contents
- machine progress
- belt lane contents and positions
- power/network state, including trip state and restart-relevant data
- quota/tutorial progress
- any reserved delivery contents

## Replication Model

Clients should sync like this:

1. fetch full runtime snapshot over HTTP on join or resync
2. open the authenticated world websocket bound to that snapshot sequence
3. apply runtime deltas and command receipts from the websocket
4. locally interpolate presentation between authoritative deltas

Do not stream full world snapshots every tick.

That will not scale once factories and belts grow.

Gap handling:

- deltas are applied only if `deltaSequence` is exactly the next expected value
- if any delta is missed, duplicated out of order, or otherwise creates a sequence gap, the client should discard incremental assumptions and refetch the full snapshot
- v1 should prefer snapshot resync over server-side delta-history replay

## Realtime Protocol Model

The world websocket is the latency-sensitive runtime plane.

Session shape:

- one duplex websocket per joined world session
- authenticate at handshake time using the same signed actor identity model as the HTTP API
- bind the socket to one actor and one world after successful auth
- snapshot fetch still happens over HTTP before or during socket establishment

Client-to-server messages should use an explicit tagged union.
Minimum message families should include:

- world socket authentication / bind
- command submission
- heartbeat or liveness if needed

Server-to-client messages should also use an explicit tagged union.
Minimum message families should include:

- queued command acknowledgment
- authoritative command receipt
- runtime delta
- resync-required / sequence-gap recovery signal
- boundary error message

Command flow:

- submitting a command over websocket should produce a fast queued acknowledgment when the transport/session accepts it
- authoritative success or rejection still occurs later at the tick boundary
- clients must correlate both phases by `commandId`
- websocket command submission does not bypass the deterministic tick queue

## Suggested Runtime Modules

The sim should be implemented as domain modules, not a generic ECS-first system.

Recommended modules:

- `WorldRuntime`
- `WorldTick`
- `WorldCommandQueue`
- `ObjectRegistry`
- `ContainerService`
- `MachineRuntime`
- `TransportGraph`
- `PowerNetwork`
- `QuotaProgress`
- `TutorialProgress`
- `RuntimeCheckpointStore`
- `WorldDeltaPublisher`

## Effect API Reference

This section maps backend scenarios to the Effect APIs we should use.

### HTTP control plane

Use:

- `HttpApi`
- `HttpApiBuilder`
- `HttpApiMiddleware`
- `HttpApiClient`

Use these for:

- auth
- world creation
- snapshot fetch
- shipment launch and other non-latency-sensitive progression actions
- admin/debug endpoints
- docs generation

Why:

- one contract powers server, docs, and typed client
- fits the control plane well
- already matches our current backend direction

References:

- `effect-smol/packages/effect/HTTPAPI.md`
- `effect-smol/packages/effect/test/unstable/httpapi/HttpApiClient.test.ts`

Do not use `HttpApi` as the primary high-frequency world replication or latency-sensitive command channel.
It is the control plane, not the hot runtime transport.

### Contracts and wire types

Use:

- `Schema`
- `Schema.ErrorClass` / `Schema.TaggedErrorClass`

Use these for:

- commands
- command results
- snapshots
- deltas
- checkpoint payloads
- HTTP payloads
- boundary errors that must serialize cleanly

References:

- `effect-smol/packages/effect/HTTPAPI.md`
- `effect-smol/packages/effect/src/unstable/sql/SqlResolver.ts`

Guideline:

- use schema-backed tagged errors for boundary-facing errors
- keep payloads schema-first

### Internal domain values and internal errors

Use:

- `Data`

Use these for:

- internal value objects if equality/structural behavior is useful
- internal non-wire errors inside the sim

References:

- `effect-smol/packages/effect/test/Data.test.ts`

Guideline:

- use `Schema.*` errors when the value crosses a boundary
- use `Data.TaggedError` for internal logic errors that do not need wire encoding

### Service boundaries and dependency wiring

Use:

- `ServiceMap.Service`
- `Layer`

Use these for:

- world runtime services
- command router
- checkpoint store
- delta publisher
- power service
- transport service

References:

- `effect-smol/migration/services.md`

Guideline:

- use explicit layers
- keep runtime dependencies visible
- prefer `yield* Service` over hiding service access

### Hot in-memory authoritative state

Use:

- `Ref`

Use this when:

- the next state is computed synchronously and purely from current state + command batch
- the world tick mutates one authoritative state value

Why:

- simple
- fast
- good fit for a per-world hot state core

References:

- `effect-smol/packages/effect/test/Ref.test.ts`

### Effectful serialized state transitions

Use:

- `SynchronizedRef`

Use this when:

- a state transition needs effects during the update itself
- a state update must sequence through an effectful read-modify-write path

Good uses:

- effectful coordination around checkpoints or external validation

References:

- `effect-smol/packages/effect/test/SynchronizedRef.test.ts`

Guideline:

- start with `Ref` for the hot sim state
- use `SynchronizedRef` only when the update path truly needs effects

### Command ingestion

Use:

- `Queue`

Use this for:

- per-world command queue
- internal worker mailboxes
- tick input buffering

References:

- `effect-smol/packages/effect/test/Queue.test.ts`
- `effect-smol/packages/effect/test/cluster/TestEntity.ts`

Guideline:

- authoritative commands should usually use a bounded queue
- telemetry can use dropping/sliding queues if needed

### Delta fanout and observers

Use:

- `PubSub`
- `SubscriptionRef`
- `Stream`

Use these for:

- world delta fanout to many subscribers
- live runtime state subscriptions
- admin/debug stream views
- chunked read-side feeds

References:

- `effect-smol/packages/effect/test/PubSub.test.ts`
- `effect-smol/packages/effect/test/SubscriptionRef.test.ts`
- `effect-smol/packages/effect/test/cluster/Entity.test.ts`

Guideline:

- `PubSub` for event broadcast
- `SubscriptionRef` when consumers need the latest value plus updates
- `Stream` as the consuming/transport shape over those primitives

### Tick loops and scheduling

Use:

- `Clock`
- `Schedule`
- `Fiber`
- `FiberHandle`

Use these for:

- per-world tick loop
- maintenance loops
- retry policies
- scheduled checkpoint cadence

References:

- `effect-smol/packages/effect/test/Schedule.test.ts`
- `effect-smol/packages/effect/test/TestClock.test.ts`
- `effect-smol/packages/effect/test/FiberHandle.test.ts`

Guideline:

- inject time through `Clock`
- use `Schedule` for fixed cadence and retries
- use `FiberHandle` when one managed world loop should exist at a time

### Resource lifetime

Use:

- `Scope`

Use this for:

- per-world runtime lifetime
- per-connection lifetime
- subscription lifetime
- background fibers tied to a world/session

References:

- `effect-smol/migration/scope.md`
- `effect-smol/packages/effect/test/Scope.test.ts`

### Realtime transport

Use:

- websocket transport for high-frequency runtime deltas
- websocket transport for latency-sensitive world commands and their receipts

Effect-side reference:

- `effect/unstable/socket/Socket`

References:

- `effect-smol/packages/effect/src/unstable/socket/Socket.ts`

Guideline:

- keep `HttpApi` as control plane
- use a realtime transport for world-state delta streaming and latency-sensitive runtime commands
- keep the socket protocol schema-defined with explicit tagged unions
- bind sockets at handshake time to authenticated actor/world context

### SQL and persistence

Use:

- `SqlClient`
- `SqlResolver`

Use these for:

- checkpoint persistence
- read models
- batched lookups
- projections and listings

References:

- `effect-smol/packages/effect/src/unstable/sql/SqlClient.ts`
- `effect-smol/packages/effect/src/unstable/sql/SqlResolver.ts`
- `effect-smol/packages/sql/sqlite-node/test/Resolver.test.ts`

Guideline:

- keep hot world state in memory
- persist snapshots/checkpoints asynchronously or on cadence
- use `SqlResolver` for batched projection/read-side access, not as the hot sim state store

### Durable async jobs outside the hot path

Use:

- `PersistedQueue`
- `Workflow`
- `DurableClock`

Use these for:

- retryable offline jobs
- durable delayed work
- idempotent orchestration across restarts
- non-realtime workflows

References:

- `effect-smol/packages/effect/src/unstable/persistence/PersistedQueue.ts`
- `effect-smol/packages/effect/src/unstable/workflow/DurableClock.ts`
- `effect-smol/packages/effect/test/unstable/workflow/WorkflowEngine.test.ts`

Do not use these for the hot `10 Hz` simulation loop.

Why not:

- they are durable orchestration primitives
- the per-tick sim path needs low overhead and tight deterministic control

### Reactivity / Atom

Use:

- `effect/unstable/reactivity` only for read-side tools if needed

Possible uses:

- admin dashboards
- inspectors
- derived views

Do not use it as the core server simulation state engine.

Why not:

- it is better suited to derived/reactive read-side behavior
- the hot authoritative sim needs simpler explicit state ownership

References:

- `effect-smol/packages/effect/src/unstable/reactivity/AtomHttpApi.ts`

## APIs We Should Avoid For The Sim Core

These are not bad APIs. They are just the wrong center for the hot path.

- `HttpApi` as the main high-frequency replication transport
- `Workflow` / `DurableClock` for per-tick simulation
- `PersistedQueue` for every tick/action in the hot path
- `Atom` / `AtomHttpApi` as the main runtime world state engine
- a generic ECS-first abstraction before the domain rules are stable

## Suggested Command Surface

The next backend mutation layer should be command-based.

Examples:

- `PlaceBuilding`
- `RemoveBuilding`
- `PlaceBeltRun`
- `RemoveBeltRun`
- `TransferItems`
- `SetMachineRecipe`
- `TakeFromContainer`
- `RestartPowerNetwork`
- `AdvanceBossChat`
- `VoteSkipBossChat`

These commands should:

- be schema-defined
- validate against authoritative current state
- execute during the world tick
- produce deterministic success or rejection

## Suggested Implementation Order

1. Define runtime schemas and object ids.
2. Define command schemas and command result schemas.
3. Build `WorldRuntime` in memory with a per-world `Ref`.
4. Add per-world `Queue` for incoming commands.
5. Implement phased `WorldTick` at `10 Hz`.
6. Implement containers and atomic transfers.
7. Implement machine buffers and machine work progression.
8. Implement belt transport graph and pull/accept transfer.
9. Implement modular storage acceptance and quota observers.
10. Implement full runtime snapshot + delta publication.
11. Add periodic checkpoint persistence.
12. Add reconnect/resume and admin/debug endpoints.

## Immediate Next Backend Step

The next backend step should be:

- define the runtime state shape
- define the command model
- define the phased tick interfaces

That is the foundation everything else depends on.
