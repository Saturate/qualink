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

export function detectPipelineName(args: CommonArgs): string {
	return (
		envOrArg(argValue(args, "pipelineName", "pipeline-name"), "QUALINK_PIPELINE_NAME") ??
		process.env.BUILD_DEFINITIONNAME ??
		process.env.GITHUB_WORKFLOW ??
		process.env.CI_PIPELINE_NAME ??
		process.env.CI_PROJECT_NAME ??
		"unknown"
	);
}

const AZURE_TRIGGER_MAP: Record<string, string> = {
	IndividualCI: "push",
	BatchedCI: "push",
	PullRequest: "pr",
	Manual: "manual",
	Schedule: "schedule",
};

const GITHUB_TRIGGER_MAP: Record<string, string> = {
	push: "push",
	pull_request: "pr",
	workflow_dispatch: "manual",
	schedule: "schedule",
};

const GITLAB_TRIGGER_MAP: Record<string, string> = {
	push: "push",
	merge_request_event: "pr",
	web: "manual",
	schedule: "schedule",
	api: "api",
};

export function detectPipelineTrigger(args: CommonArgs): string {
	const explicit = envOrArg(argValue(args, "trigger"), "QUALINK_PIPELINE_TRIGGER");
	if (explicit) {
		return explicit;
	}

	const azureReason = process.env.BUILD_REASON;
	if (azureReason) {
		return AZURE_TRIGGER_MAP[azureReason] ?? azureReason;
	}

	const githubEvent = process.env.GITHUB_EVENT_NAME;
	if (githubEvent) {
		return GITHUB_TRIGGER_MAP[githubEvent] ?? githubEvent;
	}

	const gitlabSource = process.env.CI_PIPELINE_SOURCE;
	if (gitlabSource) {
		return GITLAB_TRIGGER_MAP[gitlabSource] ?? gitlabSource;
	}

	return "unknown";
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
