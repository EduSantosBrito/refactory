# refactory

Monorepo with:

- `apps/web`: React frontend on Vite+
- `apps/api`: Bun API built with Effect v4

## Install

```bash
bun install
```

`bun install` runs `effect-tsgo patch` via `prepare`, so workspace checks use the patched TypeScript-Go binary.

## Develop

```bash
bun run dev
```

## Build

```bash
bun run build
```

## Check

```bash
bun run check
```

## Lint

```bash
bun run lint
```

## Format

```bash
bun run format
```

## Full Biome Check

```bash
bun run check:biome
```
