# Game Design Notes

## Concept

- A web-based factory automation game inspired by Satisfactory, with deliberate changes.
- The game is fully 3D.
- The camera is not first-person.
- The intended point of view is MOBA-like, closer to League of Legends or Path of Exile.

## Core Fantasy

- The player spawns in a vast world.
- The world contains many resource types.
- Example resources:
  - minerals
  - water
  - heat
  - wood
  - stone
- The player builds automation chains to gather, transport, process, and deliver resources.
- Logistics tools include machines, conveyor belts, dividers, and splitters.

## Resource Model

- Mineral nodes are infinite.
- Mineral purity changes output rate rather than total quantity.
- Purity tiers:
  - impure
  - normal
  - pure
- Higher purity means better output per second.

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

## Progression Structure

- Progression is tier-based.
- Each tier should unlock new ways of building and optimizing the factory.
- Refactoring the factory after new unlocks is a core part of the fun.
- Tech unlocks should be driven mainly by milestone deliveries.
- Exploration can provide side bonuses to progression.

## Tier Timing Targets

- These are target averages, not hard requirements.
- Intended pacing so far:
  - Tier 1: around 20 minutes
  - Tier 2: around 1 hour
  - Tier 3: around 2 hours
  - Tier 4: around 4 hours
  - Tier 5: around 10 hours
- More tiers may be added later.

## Build Rules

- Building placement should be strict grid/snap.
- This applies to the first version.
- The grid should support clean, readable layouts and faster top-down interaction.

## Map Direction

- Version 1 should use a single handcrafted map.
- The map should support controlled pacing and good early-game teaching.

## Manual Gathering

- The player can manually harvest by pressing a key.
- Manual harvesting should exist mainly for starter resources.
- Manual harvesting should remain relevant during early automation for energy management.

## Power Progression

### 1. Biomass-style burner

- The player feeds wood manually.
- The burner consumes wood to produce power.
- Output is small to medium.
- This is an early-game manual power source.
- The exact final name should not copy Satisfactory naming.

### 2. Wind farm

- Automated power source.
- Generates small amounts of power.
- Can only be placed on wind-flow spots.

### 3. Heat farm

- Automated power source.
- Generates medium amounts of power.
- Can only be placed on heat spots.

### 4. Coal power plant

- Automated, infinite power source.
- Requires coal from a node.
- Requires water.
- Water source is still open, examples include lake, ocean, or groundwater.
- Generates high power.

### 5. Nuclear power plant

- Automated, infinite power source.
- Requires enriched uranium.
- Enriched uranium comes from a uranium node plus a uranium enricher.
- Requires water.
- Generates huge power.

## Current Design Read

- The strongest pillar is factory refactoring for better throughput as new tiers unlock.
- The strongest short demo hook is:
  - manual scramble
  - first powered line
  - first milestone unlock
- The biggest current risk is making early manual fuel management feel annoying instead of interesting.
- Another risk is introducing too many resource types too early and weakening the tutorial.

## Explicitly Deferred Topics

These should not be discussed yet:

- world generation
- multiplayer
- storyline
- enemies
- combat skills or enemy-related skills

## Next Discussion Targets

- Tier 1 exact recipe chain
- First 5 minutes tutorial beats
- Build UX: place, delete, rotate, upgrade
- Belt, merger, splitter, and divider rules
- Tech tree structure and category design
- Avatar verbs and interaction set
