import { describe, expect, it } from "vitest";
import { baseDocument } from "./normalize.js";
import { makeMetadata } from "./test-helpers.js";

describe("baseDocument", () => {
	it("maps all metadata fields correctly", () => {
		const metadata = makeMetadata({
			repo: "my-repo",
			category: "frontend",
			tags: ["ci", "nightly"],
			branch: "feature/x",
			commitSha: "deadbeef",
			pipelineRunId: "run-42",
			pipelineProvider: "github-actions",
			environment: "prod",
			solution: "my-solution",
			projectName: "my-project",
			collectorVersion: "1.0.0",
		});

		const doc = baseDocument({
			metricType: "eslint",
			tool: "eslint",
			languages: ["ts"],
			metadata,
		});

		expect(doc.metric_type).toBe("eslint");
		expect(doc.tool).toBe("eslint");
		expect(doc.languages).toEqual(["ts"]);
		expect(doc.repo).toBe("my-repo");
		expect(doc.category).toBe("frontend");
		expect(doc.tags).toEqual(["ci", "nightly"]);
		expect(doc.branch).toBe("feature/x");
		expect(doc.commit_sha).toBe("deadbeef");
		expect(doc.pipeline_run_id).toBe("run-42");
		expect(doc.pipeline_provider).toBe("github-actions");
		expect(doc.environment).toBe("prod");
		expect(doc.solution).toBe("my-solution");
		expect(doc.project).toBe("my-project");
		expect(doc.collector_version).toBe("1.0.0");
	});

	it("produces a valid ISO timestamp", () => {
		const doc = baseDocument({
			metricType: "eslint",
			tool: "eslint",
			languages: ["ts"],
			metadata: makeMetadata(),
		});

		const parsed = new Date(doc["@timestamp"]);
		expect(parsed.toISOString()).toBe(doc["@timestamp"]);
	});

	it("preserves null values for optional fields", () => {
		const doc = baseDocument({
			metricType: "eslint",
			tool: "eslint",
			languages: ["js"],
			metadata: makeMetadata({ solution: null, projectName: null, category: null }),
		});

		expect(doc.solution).toBe(null);
		expect(doc.project).toBe(null);
		expect(doc.category).toBe(null);
	});
});
