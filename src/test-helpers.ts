import type { CommonMetadata } from "./types.js";

export function makeMetadata(overrides?: Partial<CommonMetadata>): CommonMetadata {
	return {
		repo: "test-repo",
		category: null,
		tags: ["test"],
		branch: "main",
		commitSha: "abc123",
		pipelineRunId: "run-1",
		pipelineProvider: "local",
		environment: "ci",
		packageName: null,
		projectName: null,
		collectorVersion: "0.1.0",
		...overrides,
	};
}
