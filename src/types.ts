export type Language = "js" | "ts" | "csharp" | (string & {});
export type Environment = "dev" | "test" | "prod" | "ci";
export type MetricType =
	| "biome"
	| "eslint"
	| "lighthouse"
	| "coverage-js"
	| "sarif"
	| "coverage-dotnet"
	| "meta"
	| "pipeline";

export interface BaseMetricDocument {
	"@timestamp": string;
	metric_type: MetricType;
	tool: string;
	languages: Language[];
	repo: string;
	package: string | null;
	project: string | null;
	category: string | null;
	tags: string[];
	branch: string;
	commit_sha: string;
	pipeline_run_id: string;
	pipeline_provider: "azure-devops" | (string & {});
	environment: Environment;
	collector_version: string;
}

export interface EslintMetricDocument extends BaseMetricDocument {
	metric_type: "eslint";
	errors: number;
	warnings: number;
	fixable_errors: number;
	fixable_warnings: number;
	suppressed_errors: number;
	suppressed_warnings: number;
	rules_violated?: Record<string, number>;
	suppressed_rules?: Record<string, number>;
	top_files?: EslintFileIssue[];
	all_files?: EslintFileIssue[];
}

export interface EslintFileIssue {
	path: string;
	errors: number;
	warnings: number;
	fixable_errors: number;
	fixable_warnings: number;
}

export interface LighthouseFilmstripFrame {
	timing: number; // ms from navigation start
	data: string; // base64 data URI
}

export interface LighthouseMetricDocument extends BaseMetricDocument {
	metric_type: "lighthouse";
	url: string;
	// Category scores
	performance: number;
	accessibility: number;
	best_practices: number;
	seo: number;
	// Core Web Vitals (ms unless noted)
	fcp?: number;
	lcp?: number;
	tbt?: number;
	cls?: number; // unitless
	si?: number;
	tti?: number;
	ttfb?: number;
	total_byte_weight?: number; // bytes
	dom_size?: number; // element count
	// All audits
	audit_scores?: Record<string, number>; // id → 0-100
	audit_values?: Record<string, number>; // id → raw numericValue
	filmstrip?: LighthouseFilmstripFrame[];
}

export interface CoverageMetricDocument extends BaseMetricDocument {
	lines_total: number;
	lines_covered: number;
	lines_pct: number;
	branches_total: number;
	branches_covered: number;
	branches_pct: number;
	functions_total: number;
	functions_covered: number;
	functions_pct: number;
}

export interface CoverageJsMetricDocument extends CoverageMetricDocument {
	metric_type: "coverage-js";
}

export interface SarifMetricDocument extends BaseMetricDocument {
	metric_type: "sarif";
	errors: number;
	warnings: number;
	notes: number;
	rules_violated?: Record<string, number>;
	tool_name?: string;
	tool_version?: string;
}

export interface BiomeMetricDocument extends BaseMetricDocument {
	metric_type: "biome";
	errors: number;
	warnings: number;
	fixable_errors: number;
	fixable_warnings: number;
	rules_violated?: Record<string, number>;
	top_files?: BiomeFileIssue[];
	all_files?: BiomeFileIssue[];
}

export interface BiomeFileIssue {
	path: string;
	errors: number;
	warnings: number;
	fixable_errors: number;
	fixable_warnings: number;
}

export interface DotnetCoverageMetricDocument extends CoverageMetricDocument {
	metric_type: "coverage-dotnet";
	coverage_format: "cobertura" | "opencover" | (string & {});
}

export interface MetaMetricDocument extends BaseMetricDocument {
	metric_type: "meta";
}

export interface PipelineMetricDocument extends BaseMetricDocument {
	metric_type: "pipeline";
	pipeline_name: string;
	pipeline_status: "succeeded" | "failed" | "canceled" | "unknown";
	pipeline_trigger: string;
	duration_ms: number | null;
	start_time: string | null;
	stage_name: string | null;
}

export type NormalizedDocument =
	| BiomeMetricDocument
	| EslintMetricDocument
	| LighthouseMetricDocument
	| CoverageJsMetricDocument
	| SarifMetricDocument
	| DotnetCoverageMetricDocument
	| MetaMetricDocument
	| PipelineMetricDocument;

export interface CommonMetadata {
	repo: string;
	category: string | null;
	tags: string[];
	branch: string;
	commitSha: string;
	pipelineRunId: string;
	pipelineProvider: string;
	environment: Environment;
	packageName: string | null;
	projectName: string | null;
	collectorVersion: string;
}
