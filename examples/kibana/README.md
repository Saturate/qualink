# Kibana Dashboard

A starter dashboard for visualizing code quality metrics collected by qualink.

## Import

1. Open Kibana → **Stack Management** → **Saved Objects**
2. Click **Import** and select `codequality-dashboard.ndjson`
3. If prompted about conflicts, choose **Overwrite**
4. Navigate to **Dashboards** → **Code Quality Overview**

The import creates a `codequality-*` data view and a dashboard with 10 panels.

## Panels

| Panel | Type | Description |
|-------|------|-------------|
| Pipeline Runs | Metric | Total document count |
| Repos Tracked | Metric | Unique repositories reporting metrics |
| Total Errors | Metric | Sum of all errors across linting/SARIF tools |
| Total Warnings | Metric | Sum of all warnings |
| Linting Issues Over Time | Line chart | Errors and warnings trend (ESLint, Biome, SARIF) |
| Code Coverage Trend | Line chart | Line and branch coverage % over time |
| Lighthouse Scores Over Time | Line chart | Performance, accessibility, best practices, SEO |
| Errors by Repository | Horizontal bar | Top 10 repos by error count |
| Documents by Metric Type | Donut | Distribution of collected metric types |
| Recent Pipeline Runs | Data table | Latest runs by repo, branch, and metric type |

## Default time range

The dashboard defaults to **Last 30 days**. Adjust the time picker in Kibana to match your reporting cadence.

## Customization ideas

- Add a **repo** or **branch** filter control to drill into specific projects
- Split the linting chart by `metric_type` to compare ESLint vs Biome vs SARIF
- Add a panel for `fixable_errors` to track quick-win opportunities
- Create separate dashboards per repo using Kibana's clone + filter workflow

## Prerequisites

Requires data in `codequality-*` indices. See the [CI examples](../) for how to collect metrics from your pipelines.
