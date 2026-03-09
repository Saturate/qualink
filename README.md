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

## Pipeline Tracking

Track pipeline execution metrics — which pipelines run, when, for how long, and their outcome.
Pipelines self-report by calling `qualink pipeline --status <status>` at the end of a run.

### Azure DevOps

```yaml
steps:
  - script: echo "##vso[task.setvariable variable=PIPELINE_START]$(date +%s%3N)"
    displayName: Record start time

  # ... existing build/test steps ...

  - script: |
      END_TIME=$(date +%s%3N)
      DURATION=$(( END_TIME - $(PIPELINE_START) ))
      npx qualink pipeline \
        --status "$(Agent.JobStatus)" \
        --duration "$DURATION" \
        --sink elastic
    displayName: Report pipeline metrics
    condition: always()
    env:
      ELASTIC_URL: $(ELASTIC_URL)
      ELASTIC_API_KEY: $(ELASTIC_API_KEY)
```

Auto-detected from Azure DevOps env: pipeline name (`BUILD_DEFINITIONNAME`), trigger (`BUILD_REASON`), repo, branch, commit, run ID, provider.

### GitHub Actions

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Record start time
        run: echo "PIPELINE_START=$(date +%s%3N)" >> "$GITHUB_ENV"

      # ... existing build/test steps ...

      - name: Report pipeline metrics
        if: always()
        run: |
          END_TIME=$(date +%s%3N)
          DURATION=$(( END_TIME - PIPELINE_START ))
          npx qualink pipeline \
            --status "${{ job.status }}" \
            --duration "$DURATION" \
            --sink elastic
        env:
          ELASTIC_URL: ${{ secrets.ELASTIC_URL }}
          ELASTIC_API_KEY: ${{ secrets.ELASTIC_API_KEY }}
```

Auto-detected from GitHub env: pipeline name (`GITHUB_WORKFLOW`), trigger (`GITHUB_EVENT_NAME`), repo, branch, commit, run ID, provider.

### Per-stage reporting

For pipelines with distinct stages, call qualink once per stage with `--stage-name`:

```yaml
# Azure DevOps example
- script: |
    npx qualink pipeline --status "$(Agent.JobStatus)" --stage-name build --duration "$BUILD_DURATION"
  condition: always()

- script: |
    npx qualink pipeline --status "$(Agent.JobStatus)" --stage-name deploy --duration "$DEPLOY_DURATION"
  condition: always()
```

## CLI usage

### Single collector

```bash
qualink collect <collector> --input <path> --sink elastic [flags]
```

```bash
qualink collect eslint --input eslint-report.json --sink elastic --repo frontend-mono --category frontend --tags frontend,web
qualink collect sarif --input analyzers.sarif --sink elastic --repo backend-api --category backend --tags backend,api
qualink collect coverage-dotnet --input coverage.cobertura.xml --sink elastic --repo backend-api
```

### Multi-collect

Auto-discover report files in a directory tree:

```bash
qualink collect --dir=./output --repo myapp --sink elastic
```

Or use a config file for explicit control:

```bash
qualink collect --config=qualink.json --repo myapp --sink elastic
```

Config file example (`qualink.json`):

```json
[
  { "type": "eslint", "input": "packages/*/eslint-report.json" },
  { "type": "coverage-js", "input": "packages/*/coverage-summary.json" },
  { "type": "sarif", "input": "**/*.sarif" }
]
```

Each entry supports optional overrides: `tags`, `category`, `project`, `solution`, `url`.
See [qualink-config.schema.json](qualink-config.schema.json) for the full schema.

Auto-discovery recognizes: `eslint-report.json`, `biome-report.json`, `coverage-summary.json`, `coverage.cobertura.xml`, `*.sarif`/`*.sarif.json`, and `lhr-*.json` inside `.lighthouseci/`.

### Pipeline tracking

Top-level command, not under `collect`:

```bash
qualink pipeline --status succeeded --sink elastic
qualink pipeline --status succeeded --duration 125000 --pipeline-name "Build and Deploy"
qualink pipeline --status succeeded --stage-name build --duration 45000
qualink pipeline --status failed --dry-run
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

Project hierarchy (auto-detected or explicit):

- `--solution` groups related projects (auto-detected from `.sln` or workspace root `package.json`)
- `--project` identifies the individual project (auto-detected from nearest `.csproj` or `package.json`)

Metadata auto-detection:

- `repo`: from flag/env, then git origin, then current folder name
- `branch`: from flag/env, then git branch
- `commit_sha`: from flag/env, then git commit
- `pipeline_run_id`: from flag/env, fallback `local-<timestamp>`
- `project`: from flag/env, then nearest `.csproj`/`package.json`
- `solution`: from flag/env, then nearest `.sln`/workspace root `package.json`

If needed, you can still pass explicit values with `--repo`, `--branch`, `--commit-sha`, and `--pipeline-run-id`.

Sink configuration:

- `--sink elastic` (default) requires `ELASTIC_URL` and `ELASTIC_API_KEY`
- `--sink loki` requires `LOKI_URL`. Optional: `LOKI_USERNAME`, `LOKI_PASSWORD` (basic auth), `LOKI_TENANT_ID` (`X-Scope-OrgID` header for multi-tenant setups)
- `--sink stdout` prints normalized documents for debugging

Dry run mode:

- `--dry-run` validates and prints normalized payloads without sending to any sink

Useful env fallbacks:

- `QUALINK_REPO`, `QUALINK_CATEGORY`, `QUALINK_TAGS`, `QUALINK_BRANCH`, `QUALINK_COMMIT_SHA`, `QUALINK_PIPELINE_RUN_ID`
- `QUALINK_PROJECT` (auto-detected from nearest `.csproj`/`package.json` or `PNPM_PACKAGE_NAME`)
- `QUALINK_SOLUTION` (auto-detected from `.sln` or workspace root `package.json`)
- `QUALINK_PIPELINE_PROVIDER` (auto-detected, fallback: `local`)
- `QUALINK_ENVIRONMENT` (default: `ci`)
- `QUALINK_SINK` (default: `elastic`)
