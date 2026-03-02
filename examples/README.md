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

## GitHub Actions

| Collector | Example |
|-----------|---------|
| ESLint | [github-actions/eslint.yml](github-actions/eslint.yml) |
| Biome | [github-actions/biome.yml](github-actions/biome.yml) |
| SARIF | [github-actions/sarif.yml](github-actions/sarif.yml) |
| Coverage JS | [github-actions/coverage-js.yml](github-actions/coverage-js.yml) |
| Coverage .NET | [github-actions/coverage-dotnet.yml](github-actions/coverage-dotnet.yml) |
| Lighthouse | [github-actions/lighthouse.yml](github-actions/lighthouse.yml) |

## Sample reports

The [reports/](reports/) folder contains sample input files for each collector.
