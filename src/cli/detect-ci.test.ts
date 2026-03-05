import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	detectBranch,
	detectCommitSha,
	detectPipelineName,
	detectPipelineProvider,
	detectPipelineRunId,
	detectPipelineTrigger,
} from "./detect-ci.js";

const CI_ENV_PREFIXES = ["QUALINK_", "BUILD_", "GITHUB_", "CI_", "TF_BUILD", "CI"];

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
	savedEnv = { ...process.env };
	for (const key of Object.keys(process.env)) {
		if (CI_ENV_PREFIXES.some((p) => key.startsWith(p) || key === p)) {
			delete process.env[key];
		}
	}
});

afterEach(() => {
	process.env = savedEnv;
});

describe("detectBranch", () => {
	it("CLI arg wins", () => {
		process.env.GITHUB_REF_NAME = "from-ci";
		expect(detectBranch({ branch: "from-arg" })).toBe("from-arg");
	});

	it("QUALINK_BRANCH beats CI env", () => {
		process.env.QUALINK_BRANCH = "from-qualink";
		process.env.GITHUB_REF_NAME = "from-ci";
		expect(detectBranch({})).toBe("from-qualink");
	});

	it("BUILD_SOURCEBRANCHNAME (Azure DevOps)", () => {
		process.env.BUILD_SOURCEBRANCHNAME = "feature/x";
		expect(detectBranch({})).toBe("feature/x");
	});

	it("GITHUB_REF_NAME (GitHub Actions)", () => {
		process.env.GITHUB_REF_NAME = "main";
		expect(detectBranch({})).toBe("main");
	});

	it("CI_COMMIT_REF_NAME (GitLab)", () => {
		process.env.CI_COMMIT_REF_NAME = "develop";
		expect(detectBranch({})).toBe("develop");
	});

	it("falls back to git when no env vars set", () => {
		// In a git repo, should return a branch name or "HEAD"
		const result = detectBranch({});
		expect(result).toBeTruthy();
	});
});

describe("detectCommitSha", () => {
	it("CLI arg wins", () => {
		expect(detectCommitSha({ "commit-sha": "abc123" })).toBe("abc123");
	});

	it("QUALINK_COMMIT_SHA beats CI env", () => {
		process.env.QUALINK_COMMIT_SHA = "qualink-sha";
		process.env.GITHUB_SHA = "gh-sha";
		expect(detectCommitSha({})).toBe("qualink-sha");
	});

	it("BUILD_SOURCEVERSION (Azure DevOps)", () => {
		process.env.BUILD_SOURCEVERSION = "azure-sha";
		expect(detectCommitSha({})).toBe("azure-sha");
	});

	it("GITHUB_SHA (GitHub Actions)", () => {
		process.env.GITHUB_SHA = "gh-sha";
		expect(detectCommitSha({})).toBe("gh-sha");
	});

	it("CI_COMMIT_SHA (GitLab)", () => {
		process.env.CI_COMMIT_SHA = "gl-sha";
		expect(detectCommitSha({})).toBe("gl-sha");
	});
});

describe("detectPipelineRunId", () => {
	it("CLI arg wins", () => {
		expect(detectPipelineRunId({ "pipeline-run-id": "99" })).toBe("99");
	});

	it("BUILD_BUILDID (Azure DevOps)", () => {
		process.env.BUILD_BUILDID = "42";
		expect(detectPipelineRunId({})).toBe("42");
	});

	it("GITHUB_RUN_ID (GitHub Actions)", () => {
		process.env.GITHUB_RUN_ID = "9999";
		expect(detectPipelineRunId({})).toBe("9999");
	});

	it("CI_PIPELINE_ID (GitLab)", () => {
		process.env.CI_PIPELINE_ID = "777";
		expect(detectPipelineRunId({})).toBe("777");
	});

	it("falls back to local-{timestamp}", () => {
		expect(detectPipelineRunId({})).toMatch(/^local-\d+$/);
	});
});

describe("detectPipelineProvider", () => {
	it("CLI arg wins", () => {
		process.env.TF_BUILD = "True";
		expect(detectPipelineProvider({ "pipeline-provider": "custom" })).toBe("custom");
	});

	it("QUALINK_PIPELINE_PROVIDER beats CI env", () => {
		process.env.QUALINK_PIPELINE_PROVIDER = "from-qualink";
		process.env.TF_BUILD = "True";
		expect(detectPipelineProvider({})).toBe("from-qualink");
	});

	it("TF_BUILD → azure-devops", () => {
		process.env.TF_BUILD = "True";
		expect(detectPipelineProvider({})).toBe("azure-devops");
	});

	it("GITHUB_ACTIONS → github-actions", () => {
		process.env.GITHUB_ACTIONS = "true";
		expect(detectPipelineProvider({})).toBe("github-actions");
	});

	it("CI=true → ci", () => {
		process.env.CI = "true";
		expect(detectPipelineProvider({})).toBe("ci");
	});

	it("nothing → local", () => {
		expect(detectPipelineProvider({})).toBe("local");
	});
});

describe("detectPipelineName", () => {
	it("CLI arg wins", () => {
		process.env.BUILD_DEFINITIONNAME = "from-ci";
		expect(detectPipelineName({ "pipeline-name": "from-arg" })).toBe("from-arg");
	});

	it("QUALINK_PIPELINE_NAME beats CI env", () => {
		process.env.QUALINK_PIPELINE_NAME = "from-qualink";
		process.env.BUILD_DEFINITIONNAME = "from-ci";
		expect(detectPipelineName({})).toBe("from-qualink");
	});

	it("BUILD_DEFINITIONNAME (Azure DevOps)", () => {
		process.env.BUILD_DEFINITIONNAME = "Build and Deploy";
		expect(detectPipelineName({})).toBe("Build and Deploy");
	});

	it("GITHUB_WORKFLOW (GitHub Actions)", () => {
		process.env.GITHUB_WORKFLOW = "CI";
		expect(detectPipelineName({})).toBe("CI");
	});

	it("CI_PIPELINE_NAME (GitLab)", () => {
		process.env.CI_PIPELINE_NAME = "pipeline-1";
		expect(detectPipelineName({})).toBe("pipeline-1");
	});

	it("CI_PROJECT_NAME fallback (GitLab)", () => {
		process.env.CI_PROJECT_NAME = "my-project";
		expect(detectPipelineName({})).toBe("my-project");
	});

	it("falls back to unknown", () => {
		expect(detectPipelineName({})).toBe("unknown");
	});
});

describe("detectPipelineTrigger", () => {
	it("CLI arg wins", () => {
		process.env.BUILD_REASON = "IndividualCI";
		expect(detectPipelineTrigger({ trigger: "manual" })).toBe("manual");
	});

	it("QUALINK_PIPELINE_TRIGGER beats CI env", () => {
		process.env.QUALINK_PIPELINE_TRIGGER = "from-qualink";
		process.env.BUILD_REASON = "IndividualCI";
		expect(detectPipelineTrigger({})).toBe("from-qualink");
	});

	it("Azure DevOps BUILD_REASON mapping", () => {
		process.env.BUILD_REASON = "IndividualCI";
		expect(detectPipelineTrigger({})).toBe("push");

		process.env.BUILD_REASON = "PullRequest";
		expect(detectPipelineTrigger({})).toBe("pr");

		process.env.BUILD_REASON = "Manual";
		expect(detectPipelineTrigger({})).toBe("manual");

		process.env.BUILD_REASON = "Schedule";
		expect(detectPipelineTrigger({})).toBe("schedule");
	});

	it("GitHub Actions GITHUB_EVENT_NAME mapping", () => {
		process.env.GITHUB_EVENT_NAME = "push";
		expect(detectPipelineTrigger({})).toBe("push");

		process.env.GITHUB_EVENT_NAME = "pull_request";
		expect(detectPipelineTrigger({})).toBe("pr");

		process.env.GITHUB_EVENT_NAME = "workflow_dispatch";
		expect(detectPipelineTrigger({})).toBe("manual");

		process.env.GITHUB_EVENT_NAME = "schedule";
		expect(detectPipelineTrigger({})).toBe("schedule");
	});

	it("GitLab CI_PIPELINE_SOURCE mapping", () => {
		process.env.CI_PIPELINE_SOURCE = "push";
		expect(detectPipelineTrigger({})).toBe("push");

		process.env.CI_PIPELINE_SOURCE = "merge_request_event";
		expect(detectPipelineTrigger({})).toBe("pr");

		process.env.CI_PIPELINE_SOURCE = "web";
		expect(detectPipelineTrigger({})).toBe("manual");

		process.env.CI_PIPELINE_SOURCE = "api";
		expect(detectPipelineTrigger({})).toBe("api");
	});

	it("unknown CI values pass through", () => {
		process.env.BUILD_REASON = "SomeNewReason";
		expect(detectPipelineTrigger({})).toBe("SomeNewReason");
	});

	it("falls back to unknown", () => {
		expect(detectPipelineTrigger({})).toBe("unknown");
	});
});
