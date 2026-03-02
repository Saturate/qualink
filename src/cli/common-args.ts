export interface CommonArgs {
	[key: string]: unknown;
	input?: unknown;
	sink?: unknown;
	repo?: unknown;
	category?: unknown;
	tags?: unknown;
	branch?: unknown;
	commitSha?: unknown;
	pipelineRunId?: unknown;
	pipelineProvider?: unknown;
	environment?: unknown;
	package?: unknown;
	project?: unknown;
	collectorVersion?: unknown;
	elasticUrl?: unknown;
	elasticApiKey?: unknown;
	lokiUrl?: unknown;
	lokiUsername?: unknown;
	lokiPassword?: unknown;
	lokiTenantId?: unknown;
	retryMax?: unknown;
	retryBackoffMs?: unknown;
	allowEmpty?: unknown;
}

export function argValue(args: CommonArgs, key: string, altKey?: string): unknown {
	const primary = args[key];
	if (primary !== undefined) {
		return primary;
	}

	if (!altKey) {
		return undefined;
	}

	return args[altKey];
}

export function envOrArg(argValue: unknown, envKey: string): string | undefined {
	if (typeof argValue === "string" && argValue.trim().length > 0) {
		return argValue;
	}

	const envValue = process.env[envKey];
	if (envValue && envValue.trim().length > 0) {
		return envValue;
	}

	return undefined;
}

export function isDryRun(args: CommonArgs): boolean {
	return argValue(args, "dryRun", "dry-run") === true;
}

export const commonArgs = {
	input: { type: "string" as const, required: true as const },
	sink: { type: "string" as const, default: "elastic" },
	repo: { type: "string" as const },
	category: { type: "string" as const },
	tags: { type: "string" as const },
	branch: { type: "string" as const },
	"commit-sha": { type: "string" as const },
	"pipeline-run-id": { type: "string" as const },
	"pipeline-provider": { type: "string" as const },
	environment: { type: "string" as const, default: "ci" },
	package: { type: "string" as const },
	project: { type: "string" as const },
	"collector-version": { type: "string" as const },
	"elastic-url": { type: "string" as const },
	"elastic-api-key": { type: "string" as const },
	"loki-url": { type: "string" as const },
	"loki-username": { type: "string" as const },
	"loki-password": { type: "string" as const },
	"loki-tenant-id": { type: "string" as const },
	"retry-max": { type: "string" as const },
	"retry-backoff-ms": { type: "string" as const },
	"allow-empty": { type: "boolean" as const, default: false },
	"dry-run": { type: "boolean" as const, default: false },
} as const;
