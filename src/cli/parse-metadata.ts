import type { CommonMetadata } from "../types.js";
import { asOptionalString } from "../utils/assert.js";
import { CliError } from "./cli-error.js";
import { argValue, type CommonArgs, envOrArg } from "./common-args.js";
import {
	detectBranch,
	detectCommitSha,
	detectPipelineProvider,
	detectPipelineRunId,
} from "./detect-ci.js";
import { detectPackageName } from "./detect-package.js";
import { detectProjectName } from "./detect-project.js";
import { detectRepo } from "./detect-repo.js";

const DEFAULT_COLLECTOR_VERSION = "0.1.0";

function parseTags(value: unknown): string[] {
	if (typeof value !== "string" || value.trim().length === 0) {
		return [];
	}

	const tags = value
		.split(",")
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0);

	return [...new Set(tags)];
}

export function parseCommonMetadata(args: CommonArgs): CommonMetadata {
	const repo = detectRepo(args);
	const category = asOptionalString(envOrArg(argValue(args, "category"), "QUALINK_CATEGORY"));
	const rawTags = envOrArg(argValue(args, "tags"), "QUALINK_TAGS") ?? `repo:${repo}`;
	const tags = parseTags(rawTags);
	const branch = detectBranch(args);
	const commitSha = detectCommitSha(args);
	const pipelineRunId = detectPipelineRunId(args);
	const pipelineProvider = detectPipelineProvider(args);
	const environmentRaw = envOrArg(argValue(args, "environment"), "QUALINK_ENVIRONMENT") ?? "ci";
	const collectorVersion =
		envOrArg(
			argValue(args, "collectorVersion", "collector-version"),
			"QUALINK_COLLECTOR_VERSION",
		) ?? DEFAULT_COLLECTOR_VERSION;

	if (
		environmentRaw !== "dev" &&
		environmentRaw !== "test" &&
		environmentRaw !== "prod" &&
		environmentRaw !== "ci"
	) {
		throw new CliError(`Invalid environment '${environmentRaw}'. Expected dev|test|prod|ci`, 2);
	}

	return {
		repo,
		category,
		tags,
		branch,
		commitSha,
		pipelineRunId,
		pipelineProvider,
		environment: environmentRaw,
		packageName: asOptionalString(detectPackageName(args)),
		projectName: asOptionalString(detectProjectName(args)),
		collectorVersion,
	};
}
