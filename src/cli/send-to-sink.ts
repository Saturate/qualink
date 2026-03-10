import { INDEX_BY_TYPE } from "../sinks/elastic.js";
import type { SinkConfig } from "../sinks/index.js";
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
	if (sinkKindRaw !== "elastic" && sinkKindRaw !== "loki" && sinkKindRaw !== "stdout") {
		throw new CliError(`Unsupported sink '${sinkKindRaw}'. Expected elastic|loki|stdout`, 2);
	}
	const sinkKind = sinkKindRaw as "elastic" | "loki" | "stdout";

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

	const lokiUrl = envOrArg(argValue(args, "lokiUrl", "loki-url"), "LOKI_URL");
	const lokiUsername = envOrArg(argValue(args, "lokiUsername", "loki-username"), "LOKI_USERNAME");
	const lokiPassword = envOrArg(argValue(args, "lokiPassword", "loki-password"), "LOKI_PASSWORD");
	const lokiTenantId = envOrArg(argValue(args, "lokiTenantId", "loki-tenant-id"), "LOKI_TENANT_ID");

	const sinkConfigBase = {
		kind: sinkKind,
		retryMax,
		retryBackoffMs,
	};

	let sinkConfig: SinkConfig;
	if (sinkKind === "elastic") {
		sinkConfig = {
			...sinkConfigBase,
			...(elasticUrl ? { elasticUrl } : {}),
			...(elasticApiKey ? { elasticApiKey } : {}),
		};
	} else if (sinkKind === "loki") {
		sinkConfig = {
			...sinkConfigBase,
			...(lokiUrl ? { lokiUrl } : {}),
			...(lokiUsername ? { lokiUsername } : {}),
			...(lokiPassword ? { lokiPassword } : {}),
			...(lokiTenantId ? { lokiTenantId } : {}),
		};
	} else {
		sinkConfig = sinkConfigBase;
	}

	const sink = createSink(sinkConfig);

	const { durationMs } = await sink.send({
		metricType,
		documents,
	});

	const count = documents.length;
	const ms = Math.round(durationMs);
	if (sinkKind === "elastic") {
		const index = INDEX_BY_TYPE[metricType];
		const url = sinkConfig.elasticUrl ?? "";
		process.stderr.write(`  sent: ${count} document(s) → elastic ${index} (${url}) ${ms}ms\n`);
	} else if (sinkKind === "loki") {
		const url = sinkConfig.lokiUrl ?? "";
		process.stderr.write(`  sent: ${count} document(s) → loki (${url}) ${ms}ms\n`);
	} else {
		process.stderr.write(`  sent: ${count} document(s) → stdout\n`);
	}
}
