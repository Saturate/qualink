# ADR: qualink v1

- **Status:** Proposed
- **Date:** 2026-02-27
- **Owner:** Platform / DevEx
- **Decision:** Build `qualink` as a TypeScript CLI (npm package) that collects code quality outputs in CI, normalizes them, and relays them to pluggable sinks (Elastic first).

## Context

We need long-term, queryable code quality trends across multiple repositories and teams (frontend + backend), scoped from company-level down to repo and package/project.

Initial data sources:
- Frontend: ESLint, Lighthouse, Vitest coverage
- Backend: Roslyn analyzers (SARIF), .NET coverage (Cobertura/OpenCover)

Current destination:
- Self-hosted Elasticsearch (API key auth)

Future requirement:
- Potentially relay to destinations beyond Elastic without redesigning the tool.

## Decision

Implement `qualink` as a centralized CI tool with:

1. **Collector layer**
   Parses tool-specific outputs into normalized metric documents.

2. **Normalization layer**
   Applies shared metadata dimensions (`repo`, `team`, `commit_sha`, etc.) consistently across all metrics.

3. **Sink layer (pluggable)**
   Sends normalized documents to a target (`elastic` in v1, others later).

4. **Single CLI with subcommands**
   `qualink collect <collector> --sink <sink> ...`

TypeScript + npm is selected for v1 due to:
- Fast delivery and maintainability
- Low friction with JS-based tooling already in scope
- Easy adoption in Azure DevOps templates
- Sufficient performance for expected low-to-moderate CI metric volume

## Goals

- Standardize code quality telemetry across repos and languages
- Support drill-down views: company -> team -> repo -> package/project -> branch
- Keep ingestion contract stable while adding collectors/sinks incrementally
- Preserve long-term historical trends

## Non-goals (v1)

- Replacing existing lint/test tooling
- Real-time streaming ingestion
- Full observability platform abstraction layer
- UI/dashboard ownership beyond required Kibana starter dashboards

## High-level Architecture

`Tool output file -> Collector -> Normalized document(s) -> Sink -> Destination`

Examples:
- `eslint-report.json -> eslint collector -> elastic sink -> codequality-eslint`
- `results.sarif -> sarif collector -> elastic sink -> codequality-sarif`

## CLI Contract (v1)

### Global pattern

```bash
qualink collect <collector> \
  --input <path> \
  --sink elastic \
  --repo <repo> \
  --team <team> \
  --branch <branch> \
  --commit-sha <sha> \
  --pipeline-run-id <id> \
  [--package <package-or-app>] \
  [collector-specific flags]
```

### Collectors

- `eslint`
- `lighthouse`
- `coverage-js`
- `sarif`
- `coverage-dotnet`

### Example commands

```bash
qualink collect eslint --input eslint-report.json --sink elastic --repo frontend-mono --team frontend --branch main --commit-sha abc123 --pipeline-run-id 987 --package apps/web
qualink collect lighthouse --input lighthouse-report.json --sink elastic --repo frontend-mono --team frontend --branch main --commit-sha abc123 --pipeline-run-id 987 --package apps/web --environment prod --url https://app.example.com
qualink collect coverage-js --input coverage/coverage-final.json --sink elastic --repo frontend-mono --team frontend --branch main --commit-sha abc123 --pipeline-run-id 987 --package packages/ui
qualink collect sarif --input analyzers.sarif --sink elastic --repo backend-api --team backend --branch main --commit-sha def456 --pipeline-run-id 654 --project src/Api
qualink collect coverage-dotnet --input coverage.cobertura.xml --sink elastic --repo backend-api --team backend --branch main --commit-sha def456 --pipeline-run-id 654 --project src/Api
```

## Normalized Document Model

All documents include shared fields:

- `@timestamp` (ISO8601)
- `metric_type` (`eslint|lighthouse|coverage-js|sarif|coverage-dotnet`)
- `tool` (e.g. `eslint`, `lighthouse`, `roslyn`)
- `language` (`js|ts|csharp`)
- `repo`
- `package` (nullable, for monorepo apps/packages)
- `project` (nullable, for backend project identity)
- `team` (`frontend|backend|...`)
- `branch`
- `commit_sha`
- `pipeline_run_id`
- `pipeline_provider` (`azure-devops`)
- `environment` (`dev|test|prod|ci`)
- `collector_version`

Metric-specific payloads are appended per collector.

### ESLint payload
- `errors`, `warnings`
- `fixable_errors`, `fixable_warnings`
- `rules_violated` (optional; can be full map or top-N)

### Lighthouse payload
- `url`
- `performance`, `accessibility`, `best_practices`, `seo`
- optional: `lcp_ms`, `cls`, `tbt_ms` (future)

### JS coverage payload
- `lines_total`, `lines_covered`, `lines_pct`
- `branches_total`, `branches_covered`, `branches_pct`
- `functions_total`, `functions_covered`, `functions_pct`

### SARIF payload
- `errors`, `warnings`, `notes`
- `rules_violated`
- optional: `tool_name`, `tool_version`

### .NET coverage payload
- same normalized coverage fields as JS where possible
- preserve raw source format metadata (e.g., `coverage_format=cobertura`)

## Sink Interface (Future-proofing)

```ts
interface Sink {
  send(documents: NormalizedDocument[]): Promise<void>;
}
```

V1 sink:
- `elastic`

Planned sinks:
- `stdout` (debug)
- object storage (S3/Azure Blob)
- other observability backends

## Elastic Strategy (v1)

Indices (one per metric type):
- `codequality-eslint`
- `codequality-lighthouse`
- `codequality-coverage-js`
- `codequality-sarif`
- `codequality-coverage-dotnet`

Guidelines:
- Use index templates + explicit mappings
- Use bulk API for batching
- Add retries with exponential backoff
- Keep dead-letter NDJSON artifact on failures
- Add ILM only when needed

## Configuration

Environment variables:
- `QUALINK_SINK=elastic`
- `ELASTIC_URL`
- `ELASTIC_API_KEY`

Optional:
- `QUALINK_RETRY_MAX`
- `QUALINK_RETRY_BACKOFF_MS`
- `QUALINK_LOG_LEVEL`

CLI flags override env vars.

## Azure DevOps Integration Pattern

1. Run quality tool and generate machine-readable output
2. Run `qualink collect ...`
3. Publish raw report artifacts

Example (ESLint):

```yaml
- script: pnpm eslint . --format json --output-file eslint-report.json
  displayName: Generate ESLint report
  continueOnError: true

- script: >
    npx qualink collect eslint
    --input eslint-report.json
    --sink elastic
    --repo $(Build.Repository.Name)
    --team frontend
    --branch $(Build.SourceBranchName)
    --commit-sha $(Build.SourceVersion)
    --pipeline-run-id $(Build.BuildId)
    --package apps/web
  env:
    ELASTIC_URL: $(ELASTIC_URL)
    ELASTIC_API_KEY: $(ELASTIC_API_KEY)
  displayName: Relay ESLint metrics
```

## Error Handling and Exit Codes

- `0`: success
- `2`: input parse/validation failure
- `3`: sink delivery failure
- `4`: configuration/auth failure

Behavior:
- Strict validation for required dimensions
- Clear, actionable error messages
- No silent drops
- Optional `--allow-empty` for no-op reports

## Security

- API keys only via CI secrets
- Do not print secrets in logs
- Redact sink credentials in error output
- Principle of least privilege for Elastic API key (write only to codequality indices)

## Risks and Mitigations

- **Mapping/cardinality growth** (`rules_violated`)
  - Mitigation: configurable full vs top-N mode
- **Inconsistent metadata across repos**
  - Mitigation: enforce shared pipeline template and required flags
- **Partial delivery failures**
  - Mitigation: bulk response inspection + dead-letter artifacts

## Rollout Plan

1. Implement core framework + elastic sink
2. Ship collectors: `eslint`, `coverage-js`, `lighthouse`
3. Add `sarif` + `coverage-dotnet`
4. Publish reusable Azure DevOps template
5. Build Kibana starter dashboards
6. Expand sink options if/when needed

## Naming Decision

- CLI/package name: `qualink`
- Repo: `qualink`
- Purpose: collect, normalize, and relay code quality signals from CI
