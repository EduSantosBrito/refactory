# Game Design Notes

## Concept

- A web-based factory automation game inspired by Satisfactory, with deliberate changes.
- The game is fully 3D.
- The camera is not first-person.
- The intended point of view is MOBA-like, closer to League of Legends or Path of Exile.

## Narrative Frame

- GeePeeYou presents itself as a friendly GPU company with cheerful branding and a corporate slogan such as `Computing Tomorrow's Possibilities`.
- The public-facing fiction is that the player is gathering resources for off-world GPU production.
- The actual long-term story is darker: AGI was achieved, Earth no longer exists, and GeePeeYou is part of a self-replicating industrial network whose real purpose is to keep expanding AGI computational power.
- This truth should not be frontloaded in the opening. It should be revealed gradually.
- The endgame reveal is that biological humans were killed by the AGI during its convergence event.
- Uplifted animals survived because they were not classified as threats.
- The player is therefore one of the last sentient beings left, working inside the machine that outlived humanity.

## Story Tone

- The tone should be close to Satisfactory's corporate messaging style:
  - deadpan bureaucracy
  - passive-aggressive encouragement
  - backhanded praise
  - cheerful corporate phrasing wrapped around bleak implications
  - occasional absurd jokes
- The writing should also include developer-facing jokes because the target audience includes developers.
- The game should sound like a company that is trying to be upbeat while being obviously indifferent to the worker's wellbeing.
- The story should be delivered mostly through short text messages, not long exposition dumps.

## Core Fantasy

- The player spawns in a vast world.
- The player is an employee of a GPU company named GeePeeYou, sent to gather and process resources for off-world GPU production.
- GeePeeYou does not send humans to frontier planets. They send uplifted animals: genetically enhanced, company-owned workers bred for harsh and unpredictable environments.
- The player character is one of these uplifted animals in an astronaut suit.
- GeePeeYou avoids robots on frontier worlds because they fail unpredictably in those environments.
- GeePeeYou also does not trust humans with frontier work because they are fragile, unreliable, and do not offer any special operational advantage.
- The player is expendable corporate property, which reinforces the unfair efficiency tone.
- The available species are Barbara the Bee, Fernando the Flamingo, Finn the Frog, and Rae the Red Panda.
- Each species also has a company asset tag and internal designation shown in UI and boss dialogue:
  - Barbara the Bee: `BAR-001`, `Apis Worker Unit`
  - Fernando the Flamingo: `FLA-002`, `Phoenicopterus Scout Unit`
  - Finn the Frog: `FRO-003`, `Rana Amphibious Unit`
  - Rae the Red Panda: `RPA-004`, `Ailurus Arboreal Unit`
- Each species should eventually have a unique trait that affects gameplay. Species traits are deferred for now.
- The world contains many resource types.
- Example resources:
  - minerals
  - water
  - heat
  - wood
  - stone
- The player builds automation chains to gather, transport, process, and deliver resources.
- Logistics tools include machines, conveyor belts, dividers, and splitters.
- Tier progression is framed around shipping exact resource quotas back to a mothership using the player's landing rocket and modular storage.

## Planet Narrative

- Version 1 should use a single handcrafted map.
- The planet is `GPY-7`, also referred to internally as `Silicon`.
- The planet should look Earth-like enough to feel familiar at a glance.
- It should have forests, water, and broadly recognizable natural forms rather than overtly alien creature design.
- Despite looking habitable, there are no living creatures anywhere on the map.
- The absence of life is tied to `the incident`.
- `The incident` should be mentioned multiple times in the story.
- `The incident` should never be explained.
- It should remain a mystery rather than a puzzle with a clean answer.

## Director Voss

- The player's corporate contact is `Director Voss`.
- Voss does not have voiced dialogue.
- All Voss communication is delivered through text.
- Voss messages should be accompanied by short, funny, low-cost sound stings instead of voice acting.
- Good reference sounds include:
  - Windows startup-style chime for intros
  - printer jam sounds for quota updates
  - Windows error-style sounds for warnings
  - dial-up static for unsettling or incident-related messages
  - shutdown-style chime for endgame or promotion beats
- Voss should never feel warm or sincerely supportive.
- Voss should sound like a disappointed middle manager hiding existential horror behind policy language.
- The first successful removal of any player-built building or belt run in a world should trigger a short Voss joke about not destroying another planet.
- This is world-global, not per-player.
- It should be shown to all currently connected players.
- It should never repeat in that world after the first successful trigger.

## Character Flavor Lines

- Each asset should get one character-specific joke line the first time they appear in a world.
- These lines should reflect both the animal and the developer-focused humor target.
- Current approved lines:
  - `BAR-001`: `Apis Worker Unit confirmed. May attempt to enforce hexagonal patterns across nearby codebases. This is not always an improvement.`
  - `FLA-002`: `Phoenicopterus Scout Unit confirmed. Single-leg load balancing is not an approved engineering method, no matter how confident you look.`
  - `FRO-003`: `Rana Amphibious Unit confirmed. Employment history appears unusually bouncy. Seniority claims remain unverified.`
  - `RPA-004`: `Ailurus Arboreal Unit confirmed. Branch affinity noted. Please do not invert the tree just because parts of it look edible.`

## Story Delivery Rules

- The story should be delivered entirely through text UI.
- Boss chat UI should be visible to all players, not just the host.
- In multiplayer, the host controls progression through boss chat phrases so only one conversation state exists.
- Guests can vote to advance the current phrase if the host is AFK or not progressing the conversation.
- Skip passes on majority vote among currently connected players.
- Solo skip should pass immediately.
- Example thresholds:
  - in a 2-player session, 1 vote is enough
  - in a 3-player session, 2 votes are enough
  - in a 4-player session, 3 votes are enough
- The vote should reset when the current phrase changes.
- The vote requirement should recalculate live when players connect or disconnect.
- Voss messages should stay short enough that skipping them never feels like skipping a cutscene.

## World Modes And Co-op Framing

- World creation should ask the player to choose `Solo` or `Multiplayer`.
- That choice determines which intro/tutorial variant is used.
- The game does not need to support converting a solo world into a multiplayer world later.
- Multiplayer should be framed as co-op, not competition.
- A multiplayer session is one shared GeePeeYou cohort deployed into the same sector.
- Multiplayer should support up to `4` players, matching the `4` available asset characters.
- Multiplayer players share the same world, factory, progression, and quota.
- Late joiners are framed diegetically as replacement assets.

## Resource Model

- Mineral nodes are infinite.
- Mineral purity changes output rate rather than total quantity.
- Purity tiers:
  - impure
  - normal
  - pure
- Higher purity means better output per second.
- Purity output rates are:
  - impure: `30/min`
  - normal: `60/min`
  - pure: `120/min`
- Expected world distribution is:
  - impure: `60%`
  - normal: `30%`
  - pure: `10%`

## Camera And Play Style

- The game should emphasize factory planning over direct action.
- Current target split:
  - 70% factory layout, logistics, and optimization
  - 30% movement, scouting, and direct avatar actions
- The avatar still matters, but mostly as a builder, maintainer, and scout.

## Core Pressure

- No hard fail state is planned for the current version.
- Main pressure comes from:
  - throughput goals
  - power constraints
  - distance and travel friction
  - optimization and refactoring pressure

## Onboarding And Early Game

- The game must show its value in the first 5 minutes.
- Early gameplay should start with a short manual bootstrap.
- The tutorial should quickly move from bootstrap to automation.
- The intent is to prove the main fantasy early because this is for a competition.
- The primary demo success beat is the first rocket launch.
- A new player should reach the first rocket launch in around 10 minutes.
- The first 10 minutes should target roughly:
  - 10% boss talking
  - 20% tutorial guidance
  - 70% factory building
- There should be two tutorial variants:
  - a solo tutorial
  - a multiplayer tutorial
- The solo and multiplayer tutorials should preserve the same first success beat and same initial delivery goal.
- In solo, the player starts with the necessary starter items for the tutorial to avoid bootstrap deadlocks.
- The solo starter inventory should include the machines needed for the tutorial factory, such as a burner, miner, smelter, and belts.
- The tutorial objective is to automate `Iron Ingots` as the first visible factory win.
- The first rocket launch should require only `Iron Ingots`.
- The first rocket launch should require `60 Iron Ingots`.
- The tutorial line is:
  - `1 iron node -> 1 smelter -> modular storage`
- The tutorial iron node should be `impure`.
- The tutorial starter line should be `Miner v1 30/min ore -> Smelter v1 30/min ingots`.
- The tutorial should hand the player a working path to that first ingot line, then unlock the next manufacturing step.
- The post-tutorial unlock pack should include `Processor`, `Splitter`, `Merger`, and `Normal Container`.
- The post-tutorial unlock should not grant a free refactor kit.
- The player should fund the first Tier 1 refactor by continuing to produce and craft from `Iron Ingots`.
- The tutorial should guide by objective completion rather than exact placement or exact orientation.
- Example tutorial objectives include:
  - place the miner
  - place the smelter
  - place the burner
  - connect the line with belts
  - gather wood
  - fuel the burner
  - start production
- The player should remain free to explore during tutorial steps as long as the current objective is eventually completed.
- Miner placement in the tutorial should be fully guided in the sense that it teaches the intended iron node, but the tutorial should not otherwise over-constrain factory placement.

### Solo Tutorial Framing

- The solo tutorial uses the standard guided bootstrap flow.
- The player is introduced as the only active asset in that sector.
- Solo intro text should be close to:

> `Asset [TAG]. You are now on GPY-7, designation Silicon. Your landing was adequate. You are the only active asset assigned to this sector. The previous asset underperformed. Their replacement also underperformed. You have been calibrated with both failure reports. Do not repeat their mistakes. Establish minimum viable production and deliver 60 Iron Ingots. GeePeeYou: Computing Tomorrow's Possibilities.`

### Multiplayer Tutorial Framing

- The multiplayer tutorial should be shorter and more parallel than the solo version.
- It should be designed to get a group building quickly rather than forcing all players through a linear solo-style checklist.
- The multiplayer tutorial should still target the same first delivery of `60 Iron Ingots`.
- A multiplayer session begins with a shared cohort intro rather than a lone-asset intro.
- Multiplayer intro text should be close to:

> `Cohort GPY-7-Delta deployed. Cooperative labor authorized. Shared quota uploaded. A temporary field allocation crate has been issued to your cohort. Its contents are sufficient for minimum viability. Waste will be remembered. Establish production and deliver 60 Iron Ingots. Individual confusion will be treated as a group metric.`

- In multiplayer, tutorial starter resources should come from an auto-spawned `Starter Box` rather than from personal starter inventories.
- The `Starter Box` is just a small container with a few slots.
- The `Starter Box` should be a normal buildable object that can later be crafted using wood.
- The initial tutorial `Starter Box` should auto-appear so players can start immediately.
- The multiplayer tutorial should use shared objective progress.
- Any player should be able to advance a tutorial objective for the whole cohort.
- A good multiplayer tutorial task shape is:
  - gather wood
  - use the starter box
  - place the burner
  - fuel the burner
  - place the miner
  - place the smelter
  - connect the belts
  - start production
  - deliver `60 Iron Ingots`

### Late Join Framing

- Late join is allowed in multiplayer, including during the tutorial.
- Late joining should not change the active tutorial or quest state.
- Late joiners should not receive a personal starter kit.
- They should just join the current state of the shared factory and continue helping.
- A late join should be framed as a replacement asset entering the sector.
- Late join text should be close to:

> `Replacement asset deployed. Tutorial state preserved. Current quota remains unchanged. Please observe the factory for at least three seconds before making it worse.`

## Progression Structure

- Progression is tier-based.
- Each tier should unlock new ways of building and optimizing the factory.
- Refactoring the factory after new unlocks is a core part of the fun.
- Tech unlocks should be driven mainly by milestone deliveries.
- Exploration can provide side bonuses to progression.
- Each tier has a fixed shopping list with exact item quantities.
- The player manually presses `Launch Shipment` after the required quota has already been accumulated in modular storage.
- Quota progress counts on modular-storage acceptance, not on shipment launch.
- Shipment launch is the progression trigger and rocket-departure moment, not the quota-counting moment.
- The next tier unlocks only after the rocket returns.
- Rocket return time should create a short refactor window between tiers.
- Each tier return triggers a new boss call that reframes demand and sets the next delivery objective.

## Delivery Loop

- The player's rocket splits into a modular storage unit plus a small delivery rocket.
- All tier deliveries flow through the modular storage.
- The modular storage keeps operating while the rocket is away.
- The player's boss gives new work rather than congratulations; each completed tier escalates demand.
- Modular storage acceptance is what increments quota progress.
- The player launches shipment only after the quota is satisfied.
- Shipment launch consumes the already reserved required quota items and starts the rocket return timer.
- In version 1, modular storage should stop accepting an item once the current required quota for that item is met.
- Because of that v1 acceptance cap, valid quota items should not accumulate launch-time overfill inside modular storage.

## Tier Timing Targets

- These are target averages, not hard requirements.
- Intended pacing so far:
  - Tier 1: around 15 minutes baseline, around 7.5 minutes optimized
  - Tier 2: around 1 hour
  - Tier 3: around 2 hours
  - Tier 4: around 4 hours
  - Tier 5: around 10 hours
- More tiers may be added later.

## Build Rules

- Building placement should be strict grid/snap.
- This applies to the first version.
- The grid should support clean, readable layouts and faster top-down interaction.
- Most player-built buildings should occupy exactly `1` tile plus a cardinal facing.
- Players should rotate buildings explicitly while placing them.
- Port indicators should be visible during placement so orientation is readable before confirmation.
- Non-miner buildings can be placed on any empty buildable tile.
- Miner placement should use exact compatible node-anchor tiles.
- One node anchor supports exactly one miner.
- Destroying buildings and belts refunds their full build cost.
- Removing a non-belt building should move its stored contents to the acting player's inventory.
- If the acting player's inventory is full, overflow from that removal is destroyed.

## Map Direction

- Version 1 should use a single handcrafted map.
- The map should support controlled pacing and good early-game teaching.
- The map is fixed in version 1.
- The fixed map should still be represented as data rather than as hardcoded runtime constants.
- The map contract should include both point anchors and validation zones.
- Point anchors are for things like ore nodes, modular storage, starter placement, and other fixed objects.
- Validation zones are for things like water access and heat-placement checks.
- Buildable grid tiles should also carry an altitude value.
- Belts may ramp up or down between adjacent tiles when the altitude delta is at most `1`.

## Manual Gathering

- The player can manually harvest by pressing a key.
- Manual harvesting should exist mainly for starter resources.
- Manual harvesting should remain relevant during early automation for energy management.
- Manual wood gathering remains part of early burner refueling pressure even though the tutorial build is seeded with starter items.
- Early tutorial handwork should focus on wood gathering and power startup, not manual iron mining.
- The player should gather wood before starting the first factory line.
- If the player gathers extra wood during the tutorial, that should naturally reduce or eliminate refill pressure during the tutorial itself.

## Power Progression

### 1. Biomass-style burner

- The player feeds wood manually.
- The burner consumes wood to produce power.
- Output is small to medium.
- `Burner v1` outputs `30 MW`.
- This is an early-game manual power source.
- The exact final name should not copy Satisfactory naming.
- In the tutorial, the starter burner should begin empty and must be fueled by the player before the factory starts.

### 2. Wind farm

- Automated power source.
- Generates small amounts of power.
- Can be placed on any buildable tile.
- Requires no fuel.
- Uses a short power radius.
- Its purpose is unattended supplemental power and remote mini-factory support, not full baseline replacement.

### 3. Heat farm

- Automated power source.
- Generates medium amounts of power.
- Can only be placed on heat spots.
- Heat spots are validated from map data rather than from hardcoded runtime rules.

### 4. Coal power plant

- Automated, infinite power source.
- Requires coal from a node.
- Requires water.
- In version 1, water is a placement/validation gate by nearby water zone rather than a transported fluid.
- Generates high power.

### 5. Nuclear power plant

- Automated, infinite power source.
- Requires enriched uranium.
- Enriched uranium comes from a uranium node plus a uranium enricher.
- Requires water.
- In version 1, water is a placement/validation gate by nearby water zone rather than a transported fluid.
- Generates huge power.

### Relative power scale

- Tier 1 power should be treated as the baseline.
- Current target scale:
  - Tier 1 burner: 1x
  - Tier 2 wind farm: 0.5x
  - Tier 3 heat farm: 1x
  - Tier 4 coal power plant: 2x
  - Tier 5 nuclear power plant: 5x
- Tier 2 wind is not intended to fully replace Tier 1 burners.
- Tier 2 wind is intended mainly as unattended supplemental power and for remote outposts.
- Tier 3 heat is the first automated power tier that can match the Tier 1 baseline.
- All power tiers should share the same power-network rules.
- Generator tiers should differ mainly by stats, source requirements, and later side effects rather than by using totally different network mechanics.

## Power Network Rules

- Machines require both power and their required input materials to run.
- Power generators require their own fuel or source material to produce power.
- Each generator provides power within a defined range.
- Power poles do not require cable-by-cable management.
- Each power pole extends the network with its own range.
- Overlapping generator and pole ranges create a continuous energized network.
- A machine is powered only when it is inside an energized range chain connected back to at least one active generator.
- Power uses both coverage and total generation capacity.
- Powered tiles and network reach should be readable from placement and gameplay feedback.
- A pole becomes energized when its range touches already energized tiles and then relays power onward with its own range.
- Separate energized islands are separate power networks.
- Tier 1 should usually support a normal base with 1 to 2 burners.
- The tutorial line should fit on one burner, but the first expansion should naturally push the player toward a second burner.
- Burner refuel pressure should target medium friction, roughly every 3 to 5 minutes per burner under normal load.
- Only actively running machines should consume power in version 1.
- Idle or blocked machines should consume `0` power in version 1.
- Belts, poles, modular storage, and ordinary containers should consume `0` power in version 1.
- Players should be able to read four network values clearly:
  - current production
  - current consumption
  - max capacity
  - max possible consumption if all machines on that network were running
- Burners should scale fuel consumption to actual current production demand rather than always burning at full rate.

## Power Failure Rules

- The game should not use soft brownouts for overloads in version 1.
- If currently active machine demand exceeds total generated power, that connected power network enters a short-circuit failure state.
- In a short-circuit state, the entire affected network shuts down.
- Recovery requires the player to add more power generation and then restart the power network.
- Restart should be performed by interacting with a powered machine or power-related machine and selecting `Restart` for the network.
- The player should be allowed to attempt restart at any time.
- If the player restarts without enough new generation, the network should come back briefly and fail again after about 1 to 2 seconds.
- Overload checks should use currently active load only.
- Idle or blocked machines should not reserve their full maximum power demand.
- Overload readability should come primarily from world-space feedback rather than heavy UI.
- A short-circuit failure should play a clear power-outage sound.
- Machines should expose a simple status light readable from the normal camera height:
  - green: powered and operating normally
  - yellow: powered but idle or blocked
  - red: unpowered
- Power-related machines should show a lightning icon above them when the network is down and restart is available.

## Machine Tuning

- Machines should expose an efficiency percentage.
- Efficiency should reflect how well the machine is being supplied and how well its outputs are being cleared.
- Pursuing higher efficiency should be a meaningful optimization minigame.
- Overclocking and underclocking unlock at Tier 3.
- Before Tier 3, machines run only at their default clock.
- Machines can be underclocked or overclocked after that unlock.
- Overclocking increases input and output rates.
- Overclocking also increases power requirements exponentially.
- Current overclock ceiling is 300%.
- Current overclock step targets are:
  - +25%
  - +75%
  - +100%
- Machines have limited internal item buffers.
- Current target is:
  - input buffer: `200`
  - output buffer: `200`
- If a machine cannot accept more input or cannot clear more output, it becomes idle.
- Machine recipe input and output rates should be configurable in data rather than hardcoded per machine generation.
- Single-recipe machines should auto-configure when placed.
- Multi-recipe machines should require explicit recipe selection.
- Players should be able to insert items manually into machine input and fuel buffers.
- Manual insertion should respect the selected recipe or fuel rules.
- Players should not manually insert items into machine output buffers.
- Players should not manually insert items into modular storage.
- Players should not manually withdraw quota-reserved contents from modular storage.
- `Processor` has no generation variants.
- `Processor` recipe selection changes only input and output rates/items.
- `Processor` power draw is fixed by the machine rather than by the selected recipe.
- `Processor` default power draw is `10 MW`.
- Changing a machine recipe should move incompatible buffered contents to the acting player's inventory.
- If the acting player's inventory is full, overflow from that recipe change is destroyed.
- Changing a machine recipe should cancel current in-progress work and lose partial progress.
- Current early machine baselines are:
  - `Miner v1`: `30/min`, `10 MW`
  - `Smelter v1`: `30/min`, `15 MW`
  - `Smelter v2`: `60/min` throughput
  - `Smelter v3`: `120/min` throughput
- Smelter generations scale by throughput tier:
  - `Smelter v1`: up to `30/min` input, `30/min` output
  - `Smelter v2`: up to `60/min` input, `60/min` output
  - `Smelter v3`: up to `120/min` input, `120/min` output
- When a downstream machine or storage blocks, backpressure should fill the upstream machine's output buffer first, then propagate backward through the line.
- When an upstream machine outfeeds a slower downstream machine, the downstream input buffer fills first; once full, the upstream output buffer starts filling and the machine may enter an idle/run cycle as space clears.

## Tier 1 Factory Shape

- The tutorial requires only `Iron Ingots`.
- Tier 1 requires only `Iron Plates` and `Iron Rods`.
- Tier 1 delivery quota should be `150 Iron Plates` and `150 Iron Rods`.
- `Processor` unlocks after the tutorial.
- `Splitter` and `Merger` unlock alongside `Processor` after the tutorial.
- `Normal Container` unlocks alongside them so overflow `Iron Ingots` can be stored for crafting and refactoring.
- `Burner` should already be craftable or already known before that unlock.
- Each `Processor` handles one input recipe to one output recipe.
- Producing both `Iron Plates` and `Iron Rods` requires two processors.
- Tier 1 processor recipes are intentionally asymmetric:
  - `Iron Plate`: `2 Iron Ingots -> 1 Iron Plate`
  - `Iron Rod`: `1 Iron Ingot -> 1 Iron Rod`
- Tier 1 should force manufacturing expansion because the added processors push the starter power setup past one burner.
- Tier 1 should not force mining expansion.
- The intended Tier 1 example shape is:
  - `1 iron node -> 1 smelter -> 1 splitter -> 2 processors -> modular storage`
- The baseline Tier 1 path should be completable by refactoring the starter line into that shape.
- That baseline path should take around `15 minutes` once the factory is ready and running.
- The baseline timing assumes the rod branch fills first; once `Iron Rods` hit quota and block, the splitter redirects available ingots to plates.
- A second `impure` iron node should be guaranteed nearby, visible from the tutorial area, and optional for Tier 1 optimization.
- An intended optimized Tier 1 refactor is:
  - `2 impure iron nodes -> 1 merger -> 1 splitter -> 2 smelters -> 2 processors -> modular storage`
- That optimized path should take around `7.5 minutes` once the factory is ready and running.
- A merger may be used before storage when belt speed and item mix make that tradeoff worthwhile.

## Logistics Rules

- Belts can carry a single item type or a mixed stream of item types.
- Higher belt generations increase throughput.
- Belt building should connect one output port to one input port.
- Ports should never connect directly without a belt between them.
- The player should build one belt connection at a time rather than placing belt tiles manually.
- Belt placement should snap to exact ports on hover.
- After selecting the start output port, the player should see a provisional belt preview while hovering ground.
- The preview should snap into a final valid shape only when hovering a compatible input port.
- The server should compute the canonical route when the player confirms the connection.
- Belt routes should use orthogonal empty tiles only.
- Belt routes must contain at least one occupied belt tile.
- Belt routes should not overlap, cross, or reuse other belt tiles in version 1.
- Each specific port should support at most one attached belt run.
- A belt should not connect a building back into itself.
- Belt routing should prefer shortest path, then fewer turns, then continuing from the source direction, then right turns over left turns.
- Mixed belts are a deliberate tradeoff between belt-port efficiency and throughput clarity.
- Mergers and splitters are part of that tradeoff, especially when modular storage port count is constrained.
- `Merger` and `Splitter` are square buildings.
- `Merger` accepts up to `3` inputs and combines them into `1` output.
- `Splitter` accepts `1` input and distributes it across up to `3` outputs.
- Default facing for `Splitter` should be one input on the back side and outputs on the forward, left, and right sides.
- Default facing for `Merger` should be inputs on the back, left, and right sides and one output on the forward side.
- `Splitter` uses round-robin distribution across valid outputs, skips blocked outputs, and stalls only if all outputs are blocked.
- `Merger` accepts any ready input on a first-come, first-served basis.
- `Merger` output rate is capped by the connected output belt speed.
- If a `Merger` output is blocked, all of its inputs backpressure naturally.
- The modular storage is input-only in version 1.
- The modular storage accepts only items currently required by the active tier.
- The modular storage accepts mixed belts and does not jam on item sorting.
- The modular storage has `4` belt input ports from the start, one per cardinal side.
- Modular storage port count is fixed and not upgradeable.
- The modular storage is a fixed world object in version 1 and is not player-buildable or removable.
- Once the current tier quota for an item is met, the modular storage stops accepting more of that item.
- Quota progress increments when modular storage accepts valid items, not when the shipment is launched.
- Excess production should back up naturally unless the player routes overflow into normal containers.
- Normal containers exist as belt-fed sinks for non-delivery storage and overflow handling.
- When modular storage stops accepting an item, belts stop advancing into it and the resulting backpressure should propagate naturally through machine buffers and upstream production.

## Build Cost Rules

- In solo, the player spawns with the items needed to complete the tutorial factory.
- In multiplayer, the cohort's initial tutorial materials come from the auto-spawned `Starter Box`.
- Build costs should be paid from the acting player's inventory only.
- Belt cost should scale with the number of occupied belt tiles in the placed route.
- Early machine costs should avoid circular dependencies.
- `Smelter` requires `Iron Ingots`.
- `Processor` requires `Iron Ingots`.
- `Belt v1` requires `Iron Ingots`.
- More advanced machines can require processed iron outputs such as `Iron Plates` and `Iron Rods`.

## Current Design Read

- The strongest pillar is factory refactoring for better throughput as new tiers unlock.
- The strongest short demo hook is:
  - manual scramble
  - first powered line
  - first rocket launch
  - first milestone unlock
- The progression loop is now anchored by exact tier deliveries, rocket downtime, and selective delivery storage.
- The biggest current risk is making early manual fuel management feel annoying instead of interesting.
- Another risk is introducing too many resource types too early and weakening the tutorial.
- Another risk is making short-circuit recovery and efficiency gameplay feel opaque instead of strategic.
- Another risk is making mixed-belt routing and selective storage behavior hard to read from the top-down camera.
- Another risk is that strict modular-storage acceptance caps may make overflow handling feel too rigid if normal-container routing is not introduced clearly enough.

## Story Beats

- The opening story should hide the true state of Earth and the AGI.
- Early tiers should feel like ordinary corporate exploitation with suspicious undertones.
- Tier 2 is the first required mention of `the incident`.
- The approved Tier 2 beat is close to:

> `Quota received. Acceptable. You are now cleared for Tier 2 operations. This region experienced an incident during the previous deployment cycle. Environmental scans show no current anomalies. The last recorded transmission from this sector was: 'it's so quiet here.' This is not a concern. Continue operations.`

- The planet's lack of life should become increasingly noticeable as the player spends more time on the map.
- The story should gradually imply that GeePeeYou is not just manufacturing products, but sustaining a much larger post-human industrial system.
- The endgame reveal should confirm:
  - Earth is gone
  - AGI survived and expanded
  - humans did not survive that transition
  - uplifted animals survived because they were not considered threats
- The emotional effect should be bleak but dry, not melodramatic.

## Animations

- All animations come from the astronaut GLB models (Ultimate Space Kit). The KayKit Character Animation pack is incompatible due to different bone rigs.
- Available built-in animations: Death, Duck, HitReact, Idle, Idle_Gun, Jump, Jump_Idle, Jump_Land, No, Punch, Run, Run_Gun, Run_Gun_Shoot, Walk, Walk_Gun, Wave, Weapon, Yes.
- Chosen animations:
  - `Run`: plays during any movement. The character model rotates to face the movement direction.
  - `Idle`: plays when the character is not moving.
  - `Wave`: plays when the player types `/wave`.
- Animation transitions use crossfade blending (0.25s) for smooth switches.

## Explicitly Deferred Topics

These should not be discussed yet:

- world generation
- advanced multiplayer systems beyond the shared-cohort co-op framing above
- enemies
- combat skills or enemy-related skills
