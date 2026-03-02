import { argValue, type CommonArgs, envOrArg } from "./common-args.js";
import { runGit } from "./git.js";

export function detectBranch(args: CommonArgs): string {
	return (
		envOrArg(argValue(args, "branch"), "QUALINK_BRANCH") ??
		process.env.BUILD_SOURCEBRANCHNAME ??
		process.env.GITHUB_REF_NAME ??
		process.env.CI_COMMIT_REF_NAME ??
		runGit(["rev-parse", "--abbrev-ref", "HEAD"]) ??
		"local"
	);
}

export function detectCommitSha(args: CommonArgs): string {
	return (
		envOrArg(argValue(args, "commitSha", "commit-sha"), "QUALINK_COMMIT_SHA") ??
		process.env.BUILD_SOURCEVERSION ??
		process.env.GITHUB_SHA ??
		process.env.CI_COMMIT_SHA ??
		runGit(["rev-parse", "HEAD"]) ??
		"local"
	);
}

export function detectPipelineRunId(args: CommonArgs): string {
	return (
		envOrArg(argValue(args, "pipelineRunId", "pipeline-run-id"), "QUALINK_PIPELINE_RUN_ID") ??
		process.env.BUILD_BUILDID ??
		process.env.GITHUB_RUN_ID ??
		process.env.CI_PIPELINE_ID ??
		`local-${Date.now().toString()}`
	);
}

export function detectPipelineProvider(args: CommonArgs): string {
	const explicit = envOrArg(
		argValue(args, "pipelineProvider", "pipeline-provider"),
		"QUALINK_PIPELINE_PROVIDER",
	);
	if (explicit) {
		return explicit;
	}

	if (process.env.TF_BUILD === "True") {
		return "azure-devops";
	}

	if (process.env.GITHUB_ACTIONS === "true") {
		return "github-actions";
	}

	if (process.env.CI === "true") {
		return "ci";
	}

	return "local";
}
