# qualink

[![CI](https://github.com/Saturate/qualink/actions/workflows/ci.yml/badge.svg)](https://github.com/Saturate/qualink/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/qualink)](https://www.npmjs.com/package/qualink)

Collect, normalize, and relay code quality metrics from CI.
`qualink` standardizes code quality telemetry across repos and languages, then ships it to a sink (Elastic for now, if you need something else do a PR or a ticket).

## Install

```bash
npm install -g qualink
pnpm add -g qualink
bun add -g qualink
```

Or run directly:

```bash
npx qualink collect eslint --input report.json --sink stdout
```

## CI Examples

Repo, branch, commit SHA, pipeline run ID, and provider are auto-detected from CI environment variables, no need to pass them manually.

See the [examples/](examples/) folder for copy-paste snippets for Azure DevOps and GitHub Actions.

## CLI usage

```bash
qualink collect <collector> --input <path> --sink elastic [flags]
```

Examples:

```bash
qualink collect eslint --input eslint-report.json --sink elastic --repo frontend-mono --category frontend --tags frontend,web --branch main --commit-sha abc123 --pipeline-run-id 987
qualink collect sarif --input analyzers.sarif --sink elastic --repo backend-api --category backend --tags backend,api --branch main --commit-sha def456 --pipeline-run-id 654
qualink collect coverage-dotnet --input coverage.cobertura.xml --sink elastic --repo backend-api --category backend --tags backend,api --branch main --commit-sha def456 --pipeline-run-id 654
```

Collectors:

- `biome` (Biome JSON)
- `eslint` (ESLint JSON)
- `lighthouse` (Lighthouse JSON)
- `coverage-js` (Istanbul/Vitest JSON)
- `sarif` (Roslyn or generic SARIF JSON)
- `coverage-dotnet` (Cobertura/OpenCover XML)

ESLint file-level options (optional):

- `--top-files <n>` adds `top_files` with the top offending files (default: `0`, disabled)
- `--include-all-files` adds `all_files` with every file that has lint issues

Classification metadata (optional):

- `--category` for a single broad bucket
- `--tags` for flexible multi-label filtering (`comma,separated`)

Metadata auto-detection:

- `repo`: from flag/env, then git origin, then current folder name
- `branch`: from flag/env, then git branch
- `commit_sha`: from flag/env, then git commit
- `pipeline_run_id`: from flag/env, fallback `local-<timestamp>`

If needed, you can still pass explicit values with `--repo`, `--branch`, `--commit-sha`, and `--pipeline-run-id`.

Sink configuration:

- `--sink elastic` (default) requires `ELASTIC_URL` and `ELASTIC_API_KEY`
- `--sink stdout` prints normalized documents for debugging

Dry run mode:

- `--dry-run` validates and prints normalized payloads without sending to any sink

Useful env fallbacks:

- `QUALINK_REPO`, `QUALINK_CATEGORY`, `QUALINK_TAGS`, `QUALINK_BRANCH`, `QUALINK_COMMIT_SHA`, `QUALINK_PIPELINE_RUN_ID`
- `QUALINK_PACKAGE` (monorepo package name, auto-detected from `PNPM_PACKAGE_NAME`)
- `QUALINK_PROJECT` (backend project identity)
- `QUALINK_PIPELINE_PROVIDER` (auto-detected, fallback: `local`)
- `QUALINK_ENVIRONMENT` (default: `ci`)
- `QUALINK_SINK` (default: `elastic`)
