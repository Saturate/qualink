import type { BaseMetricDocument, CommonMetadata, Language, MetricType } from "./types.js";

interface BaseInput<TMetricType extends MetricType> {
	metricType: TMetricType;
	tool: string;
	languages: Language[];
	metadata: CommonMetadata;
}

export function baseDocument<TMetricType extends MetricType>(
	input: BaseInput<TMetricType>,
): BaseMetricDocument & { metric_type: TMetricType } {
	const metadata = input.metadata;

	return {
		"@timestamp": new Date().toISOString(),
		metric_type: input.metricType,
		tool: input.tool,
		languages: input.languages,
		repo: metadata.repo,
		solution: metadata.solution,
		project: metadata.projectName,
		category: metadata.category,
		tags: metadata.tags,
		branch: metadata.branch,
		commit_sha: metadata.commitSha,
		pipeline_run_id: metadata.pipelineRunId,
		pipeline_provider: metadata.pipelineProvider,
		environment: metadata.environment,
		collector_version: metadata.collectorVersion,
	};
}
