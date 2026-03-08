# CI Examples

Copy-paste snippets for each collector. Repo, branch, commit, pipeline ID, and provider are auto-detected from CI environment variables.

## Installing in CI

Each example shows two options:

- **Single collector**: use `npx qualink` per step, no install needed
- **Multiple collectors**: add `npm install -g qualink` once, then call `qualink` directly

## Azure DevOps

| Collector | Example |
|-----------|---------|
| ESLint | [azure-devops/eslint.yml](azure-devops/eslint.yml) |
| Biome | [azure-devops/biome.yml](azure-devops/biome.yml) |
| SARIF | [azure-devops/sarif.yml](azure-devops/sarif.yml) |
| Coverage JS | [azure-devops/coverage-js.yml](azure-devops/coverage-js.yml) |
| Coverage .NET | [azure-devops/coverage-dotnet.yml](azure-devops/coverage-dotnet.yml) |
| Lighthouse | [azure-devops/lighthouse.yml](azure-devops/lighthouse.yml) |
| **Monorepo (pnpm)** | [azure-devops/monorepo.yml](azure-devops/monorepo.yml) |
| **.NET Solution** | [azure-devops/dotnet-solution.yml](azure-devops/dotnet-solution.yml) |

## GitHub Actions

| Collector | Example |
|-----------|---------|
| ESLint | [github-actions/eslint.yml](github-actions/eslint.yml) |
| Biome | [github-actions/biome.yml](github-actions/biome.yml) |
| SARIF | [github-actions/sarif.yml](github-actions/sarif.yml) |
| Coverage JS | [github-actions/coverage-js.yml](github-actions/coverage-js.yml) |
| Coverage .NET | [github-actions/coverage-dotnet.yml](github-actions/coverage-dotnet.yml) |
| Lighthouse | [github-actions/lighthouse.yml](github-actions/lighthouse.yml) |
| **Monorepo** | [github-actions/monorepo.yml](github-actions/monorepo.yml) |
| **.NET Solution** | [github-actions/dotnet-solution.yml](github-actions/dotnet-solution.yml) |

## Monorepos

For pnpm workspaces, qualink auto-detects the project name from `PNPM_PACKAGE_NAME` (set by `pnpm -r exec`). This gives you repo-level health at a glance, with drill-down into individual projects/apps.

The monorepo examples show how to use `pnpm -r exec` to collect metrics from every workspace, or use `--filter` to scope to apps only.

You can also set `QUALINK_PROJECT` explicitly if you're not using pnpm.

## Kibana dashboard

The [kibana/](kibana/) folder contains an importable dashboard for visualizing collected metrics over time. Import the NDJSON file via **Stack Management > Saved Objects > Import**.

## Sample reports

The [reports/](reports/) folder contains sample input files for each collector.
