import { createSink } from "../sinks/index.js";
import type { MetricType, NormalizedDocument } from "../types.js";
import { CliError } from "./cli-error.js";
import { argValue, type CommonArgs, envOrArg, isDryRun } from "./common-args.js";

function parseNumberInput(value: unknown, fallback: number): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}

	return fallback;
}

export async function sendToSink(
	metricType: MetricType,
	args: CommonArgs,
	documents: NormalizedDocument[],
): Promise<void> {
	if (documents.length === 0 && argValue(args, "allowEmpty", "allow-empty") !== true) {
		throw new CliError(
			`Collector produced no documents for '${metricType}'. Use --allow-empty to ignore`,
			2,
		);
	}

	if (isDryRun(args)) {
		process.stdout.write(
			`${JSON.stringify(
				{
					dry_run: true,
					metric_type: metricType,
					count: documents.length,
					documents,
				},
				null,
				2,
			)}\n`,
		);
		return;
	}

	const sinkKindRaw = (envOrArg(argValue(args, "sink"), "QUALINK_SINK") ?? "elastic").toLowerCase();
	if (sinkKindRaw !== "elastic" && sinkKindRaw !== "stdout") {
		throw new CliError(`Unsupported sink '${sinkKindRaw}'. Expected elastic|stdout`, 2);
	}
	const sinkKind: "elastic" | "stdout" = sinkKindRaw === "elastic" ? "elastic" : "stdout";

	const retryMax = parseNumberInput(argValue(args, "retryMax", "retry-max"), 2);
	const retryBackoffMs = parseNumberInput(
		argValue(args, "retryBackoffMs", "retry-backoff-ms"),
		500,
	);

	const elasticUrl = envOrArg(argValue(args, "elasticUrl", "elastic-url"), "ELASTIC_URL");
	const elasticApiKey = envOrArg(
		argValue(args, "elasticApiKey", "elastic-api-key"),
		"ELASTIC_API_KEY",
	);

	const sinkConfigBase = {
		kind: sinkKind,
		retryMax,
		retryBackoffMs,
	};

	const sinkConfig =
		sinkKind === "elastic"
			? {
					...sinkConfigBase,
					...(elasticUrl ? { elasticUrl } : {}),
					...(elasticApiKey ? { elasticApiKey } : {}),
				}
			: sinkConfigBase;

	const sink = createSink(sinkConfig);

	await sink.send({
		metricType,
		documents,
	});
}
