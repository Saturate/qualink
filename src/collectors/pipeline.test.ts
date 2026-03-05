import { describe, expect, it } from "vitest";
import { makeMetadata } from "../test-helpers.js";
import { collectPipeline, normalizeStatus } from "./pipeline.js";

describe("normalizeStatus", () => {
	it.each([
		["succeeded", "succeeded"],
		["success", "succeeded"],
		["Success", "succeeded"],
		["pass", "succeeded"],
		["passed", "succeeded"],
		["SUCCEEDED", "succeeded"],
	])("%s → %s", (input, expected) => {
		expect(normalizeStatus(input)).toBe(expected);
	});

	it.each([
		["failed", "failed"],
		["failure", "failed"],
		["Failure", "failed"],
		["fail", "failed"],
		["FAILED", "failed"],
	])("%s → %s", (input, expected) => {
		expect(normalizeStatus(input)).toBe(expected);
	});

	it.each([
		["canceled", "canceled"],
		["cancelled", "canceled"],
		["Canceled", "canceled"],
		["aborted", "canceled"],
		["skipped", "canceled"],
	])("%s → %s", (input, expected) => {
		expect(normalizeStatus(input)).toBe(expected);
	});

	it.each(["something-else", "running", "pending", ""])("%s → unknown", (input) => {
		expect(normalizeStatus(input)).toBe("unknown");
	});
});

describe("collectPipeline", () => {
	it("produces a document with correct metric_type and fields", () => {
		const [doc] = collectPipeline(
			{
				status: "succeeded",
				pipelineName: "Build and Deploy",
				trigger: "push",
				durationMs: 125000,
				startTime: "2026-01-01T00:00:00Z",
				stageName: "build",
			},
			makeMetadata(),
		);

		expect(doc.metric_type).toBe("pipeline");
		expect(doc.pipeline_name).toBe("Build and Deploy");
		expect(doc.pipeline_status).toBe("succeeded");
		expect(doc.pipeline_trigger).toBe("push");
		expect(doc.duration_ms).toBe(125000);
		expect(doc.start_time).toBe("2026-01-01T00:00:00Z");
		expect(doc.stage_name).toBe("build");
		expect(doc.languages).toEqual([]);
	});

	it("normalizes status from CI-native values", () => {
		const [doc] = collectPipeline(
			{
				status: "Succeeded",
				pipelineName: "CI",
				trigger: "push",
				durationMs: null,
				startTime: null,
				stageName: null,
			},
			makeMetadata(),
		);
		expect(doc.pipeline_status).toBe("succeeded");
	});

	it("handles nullable fields", () => {
		const [doc] = collectPipeline(
			{
				status: "failed",
				pipelineName: "CI",
				trigger: "pr",
				durationMs: null,
				startTime: null,
				stageName: null,
			},
			makeMetadata(),
		);
		expect(doc.duration_ms).toBeNull();
		expect(doc.start_time).toBeNull();
		expect(doc.stage_name).toBeNull();
	});

	it("sets tool to pipelineProvider from metadata", () => {
		const [doc] = collectPipeline(
			{
				status: "succeeded",
				pipelineName: "CI",
				trigger: "push",
				durationMs: null,
				startTime: null,
				stageName: null,
			},
			makeMetadata({ pipelineProvider: "azure-devops" }),
		);
		expect(doc.tool).toBe("azure-devops");
	});

	it("includes base document fields", () => {
		const metadata = makeMetadata({ repo: "my-repo", branch: "feature/x" });
		const [doc] = collectPipeline(
			{
				status: "succeeded",
				pipelineName: "CI",
				trigger: "push",
				durationMs: null,
				startTime: null,
				stageName: null,
			},
			metadata,
		);
		expect(doc.repo).toBe("my-repo");
		expect(doc.branch).toBe("feature/x");
		expect(doc["@timestamp"]).toBeTruthy();
	});
});
