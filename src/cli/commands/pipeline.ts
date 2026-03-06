import { collectPipeline } from "../../collectors/pipeline.js";
import { createCollectorCommand } from "../command-factory.js";
import { detectPipelineName, detectPipelineTrigger } from "../detect-ci.js";

export const pipelineCommand = createCollectorCommand({
	name: "pipeline",
	description: "Report pipeline execution metrics",
	extraArgs: {
		input: { type: "string" as const },
		sink: { type: "string" as const, default: "elastic" },
		status: { type: "string" as const, required: true as const },
		"pipeline-name": { type: "string" as const },
		trigger: { type: "string" as const },
		duration: { type: "string" as const },
		"start-time": { type: "string" as const },
		"stage-name": { type: "string" as const },
	},
	async collect(args, metadata) {
		const status = args.status as string;
		const pipelineName = (args.pipelineName ?? args["pipeline-name"]) as string | undefined;
		const trigger = args.trigger as string | undefined;
		const rawDuration = args.duration as string | undefined;
		const startTime = (args.startTime ?? args["start-time"]) as string | undefined;
		const stageName = (args.stageName ?? args["stage-name"]) as string | undefined;

		const durationMs = rawDuration ? Number(rawDuration) : null;

		const documents = collectPipeline(
			{
				status,
				pipelineName: pipelineName ?? detectPipelineName(args),
				trigger: trigger ?? detectPipelineTrigger(args),
				durationMs: durationMs !== null && Number.isFinite(durationMs) ? durationMs : null,
				startTime: startTime ?? null,
				stageName: stageName ?? null,
			},
			metadata,
		);

		return { metricType: "pipeline" as const, documents };
	},
});
