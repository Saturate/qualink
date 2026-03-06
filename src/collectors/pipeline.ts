import { baseDocument } from "../normalize.js";
import type { CommonMetadata, PipelineMetricDocument } from "../types.js";

const SUCCEEDED_ALIASES = new Set(["succeeded", "success", "pass", "passed"]);
const FAILED_ALIASES = new Set(["failed", "failure", "fail"]);
const CANCELED_ALIASES = new Set(["canceled", "cancelled", "aborted", "skipped"]);

export type PipelineStatus = PipelineMetricDocument["pipeline_status"];

export function normalizeStatus(raw: string): PipelineStatus {
	const lower = raw.toLowerCase();
	if (SUCCEEDED_ALIASES.has(lower)) return "succeeded";
	if (FAILED_ALIASES.has(lower)) return "failed";
	if (CANCELED_ALIASES.has(lower)) return "canceled";
	return "unknown";
}

interface PipelineInput {
	status: string;
	pipelineName: string;
	trigger: string;
	durationMs: number | null;
	startTime: string | null;
	stageName: string | null;
}

export function collectPipeline(
	input: PipelineInput,
	metadata: CommonMetadata,
): PipelineMetricDocument[] {
	const doc: PipelineMetricDocument = {
		...baseDocument({
			metricType: "pipeline",
			tool: metadata.pipelineProvider,
			languages: [],
			metadata,
		}),
		pipeline_name: input.pipelineName,
		pipeline_status: normalizeStatus(input.status),
		pipeline_trigger: input.trigger,
		duration_ms: input.durationMs,
		start_time: input.startTime,
		stage_name: input.stageName,
	};

	return [doc];
}
