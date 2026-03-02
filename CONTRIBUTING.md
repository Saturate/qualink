# Contributing

Thanks for considering a contribution!

## Prerequisites

- Node.js 22+
- pnpm (enable via `corepack enable`)

## Getting started

```bash
git clone https://github.com/Saturate/qualink.git
cd qualink
pnpm install
pnpm run build
pnpm test
```

## Code style

Biome handles formatting and linting — no manual config needed. Tabs, 100-char line width, recommended rules.

```bash
pnpm run lint
```

## Testing

Tests live next to source files (`*.test.ts`). Use `makeMetadata()` from `src/test-helpers.ts` to create test fixtures.

```bash
pnpm test           # run all tests
pnpm vitest         # watch mode
```

New code should include tests.

## Adding a collector

A collector parses tool-specific output and returns normalized metric documents.

1. Create `src/collectors/your-tool.ts` with a `collectYourTool(input, metadata, options)` function
2. Define a `YourToolMetricDocument` interface in `src/types.ts` extending `BaseMetricDocument` — add `metric_type: "your-tool"` and add it to the `NormalizedDocument` union
3. Use `isRecord()` from `src/utils/guards.ts` to validate untyped input
4. Use `baseDocument()` from `src/normalize.ts` to build the base document from metadata
5. Export from `src/collectors/index.ts`
6. Wire it up in `src/cli/commands/` as a new subcommand
7. Add tests — see `src/collectors/biome.test.ts` for the pattern

## Adding a sink

A sink delivers normalized documents to a destination.

1. Create `src/sinks/your-sink.ts` implementing the `Sink` interface from `src/sinks/types.ts` — it has a single `send(input: SendInput): Promise<void>` method
2. Add your sink name to `SinkKind` in `src/sinks/index.ts`
3. Update `createSink()` factory in the same file to instantiate it
4. Add tests

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(collectors): add stylelint collector
fix(elastic): handle bulk response errors
docs: update sink configuration examples
```

## Pull requests

- One concern per PR
- Include tests for new functionality
- Make sure `pnpm run lint && pnpm run build && pnpm test` passes
- The changelog is generated automatically — no need to update it
