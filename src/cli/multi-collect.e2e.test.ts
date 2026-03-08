import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanEnv, createTempGitRepo, writeFile, writeJson } from "../test-helpers.js";

// ── helpers ──────────────────────────────────────────────────────────

const CLI_PATH = resolve(fileURLToPath(import.meta.url), "../../../dist/cli/index.js");

interface CliResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

function runCollect(
	args: string[],
	opts: { cwd: string; env?: Record<string, string> },
): CliResult {
	const result = spawnSync("node", [CLI_PATH, "collect", ...args], {
		cwd: opts.cwd,
		env: cleanEnv(opts.env),
		encoding: "utf-8",
	});

	return {
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
		exitCode: result.status ?? 1,
	};
}

/**
 * Parse the dry-run output for a single metric type.
 * Expects one JSON payload followed by a summary line.
 */
function parseSinglePayload(stdout: string): {
	payload: {
		dry_run: boolean;
		metric_type: string;
		count: number;
		documents: Record<string, unknown>[];
	};
	summaryLine: string;
} {
	const lines = stdout.trimEnd().split("\n");
	const summaryLine = lines.pop() ?? "";
	return { payload: JSON.parse(lines.join("\n")), summaryLine };
}

/** Extract just the summary line from multi-type dry-run output. */
function getSummaryLine(stdout: string): string {
	const lines = stdout.trimEnd().split("\n");
	return lines[lines.length - 1] ?? "";
}

// citty quirk: when a command has subCommands, `--flag value` gets the value
// consumed as a subcommand name. Use `--flag=value` syntax instead.

// ── fixtures ─────────────────────────────────────────────────────────

const ESLINT_REPORT = [
	{
		filePath: "src/index.ts",
		errorCount: 2,
		warningCount: 1,
		fixableErrorCount: 1,
		fixableWarningCount: 0,
		messages: [{ ruleId: "no-console" }, { ruleId: "no-console" }, { ruleId: "semi" }],
		suppressedMessages: [],
	},
];

const BIOME_REPORT = {
	diagnostics: [
		{
			code: { value: "lint/correctness/noUnusedImports" },
			location: { path: "src/app.ts" },
			severity: "error",
			fixable: true,
		},
	],
};

const COVERAGE_JS_REPORT = {
	total: {
		lines: { total: 100, covered: 91, pct: 91 },
		branches: { total: 40, covered: 34, pct: 85 },
		functions: { total: 20, covered: 18, pct: 90 },
	},
};

const COBERTURA_XML = `<?xml version="1.0"?>
<coverage lines-valid="200" lines-covered="180" branches-valid="50" branches-covered="40">
  <packages/>
</coverage>`;

const SARIF_REPORT = {
	runs: [
		{
			tool: { driver: { name: "ESLint", version: "8.0.0" } },
			results: [
				{ level: "error", ruleId: "no-eval" },
				{ level: "warning", ruleId: "no-console" },
			],
		},
	],
};

const LIGHTHOUSE_REPORT = {
	requestedUrl: "https://example.com",
	categories: {
		performance: { score: 0.91 },
		accessibility: { score: 0.95 },
		"best-practices": { score: 0.98 },
		seo: { score: 0.9 },
	},
	audits: {
		"first-contentful-paint": { score: 0.8, numericValue: 1234.5 },
	},
};

// ── --dir mode ───────────────────────────────────────────────────────

describe("collect --dir", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("dir-mode", "git@github.com:myorg/my-app.git");
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("discovers and collects eslint-report.json", () => {
		writeJson(root, "eslint-report.json", ESLINT_REPORT);

		const { stdout, exitCode } = runCollect(["--dir=.", "--dry-run"], { cwd: root });

		expect(exitCode).toBe(0);
		const { payload, summaryLine } = parseSinglePayload(stdout);
		expect(payload.dry_run).toBe(true);
		expect(payload.metric_type).toBe("eslint");
		expect(payload.count).toBe(1);
		expect(payload.documents[0]?.errors).toBe(2);
		expect(payload.documents[0]?.warnings).toBe(1);
		expect(summaryLine).toBe("dry-run: 1 eslint");
	});

	it("discovers biome-report.json", () => {
		writeJson(root, "biome-report.json", BIOME_REPORT);

		const { stdout, exitCode } = runCollect(["--dir=.", "--dry-run"], { cwd: root });

		expect(exitCode).toBe(0);
		const summary = getSummaryLine(stdout);
		expect(summary).toContain("biome");
	});

	it("discovers coverage-summary.json in subdirectory", () => {
		writeJson(root, "packages/ui/coverage-summary.json", COVERAGE_JS_REPORT);

		const { stdout, exitCode } = runCollect(["--dir=.", "--dry-run"], { cwd: root });

		expect(exitCode).toBe(0);
		const summary = getSummaryLine(stdout);
		expect(summary).toContain("coverage-js");
	});

	it("discovers coverage.cobertura.xml", () => {
		writeFile(root, "test-results/coverage.cobertura.xml", COBERTURA_XML);

		const { stdout, exitCode } = runCollect(["--dir=.", "--dry-run"], { cwd: root });

		expect(exitCode).toBe(0);
		const summary = getSummaryLine(stdout);
		expect(summary).toContain("coverage-dotnet");
	});

	it("discovers .sarif files", () => {
		writeJson(root, "results/analysis.sarif", SARIF_REPORT);

		const { stdout, exitCode } = runCollect(["--dir=.", "--dry-run"], { cwd: root });

		expect(exitCode).toBe(0);
		const summary = getSummaryLine(stdout);
		expect(summary).toContain("sarif");
	});

	it("discovers lighthouse reports inside .lighthouseci/", () => {
		writeJson(root, ".lighthouseci/lhr-homepage.json", LIGHTHOUSE_REPORT);

		const { stdout, exitCode } = runCollect(["--dir=.", "--dry-run"], { cwd: root });

		expect(exitCode).toBe(0);
		const summary = getSummaryLine(stdout);
		expect(summary).toContain("lighthouse");
	});
});

// These tests need isolated repos (separate from the main --dir repo)
// so they use their own beforeAll/afterAll to prevent temp dir leaks.

describe("collect --dir edge cases", () => {
	let nodeModulesRepo: string;
	let emptyRepo: string;
	let malformedRepo: string;

	beforeAll(() => {
		nodeModulesRepo = createTempGitRepo("dir-nm");
		writeJson(join(nodeModulesRepo, "node_modules/pkg"), "eslint-report.json", ESLINT_REPORT);

		emptyRepo = createTempGitRepo("dir-empty");

		malformedRepo = createTempGitRepo("dir-malformed");
		writeFile(malformedRepo, "eslint-report.json", "NOT VALID JSON");
		writeJson(malformedRepo, "packages/api/coverage-summary.json", COVERAGE_JS_REPORT);
	});

	afterAll(() => {
		rmSync(nodeModulesRepo, { recursive: true, force: true });
		rmSync(emptyRepo, { recursive: true, force: true });
		rmSync(malformedRepo, { recursive: true, force: true });
	});

	it("ignores files inside node_modules", () => {
		const { stdout, stderr, exitCode } = runCollect(["--dir=.", "--dry-run"], {
			cwd: nodeModulesRepo,
		});

		expect(exitCode).toBe(0);
		expect(stderr).toContain("no report files found");
		expect(stdout).toBe("");
	});

	it("warns when no report files found", () => {
		const { stderr, exitCode } = runCollect(["--dir=.", "--dry-run"], { cwd: emptyRepo });

		expect(exitCode).toBe(0);
		expect(stderr).toContain("no report files found");
	});

	it("skips malformed files and continues", () => {
		const { stdout, stderr, exitCode } = runCollect(["--dir=.", "--dry-run"], {
			cwd: malformedRepo,
		});

		expect(exitCode).toBe(0);
		expect(stderr).toContain("warning: skipping");
		expect(stderr).toContain("eslint");
		const summary = getSummaryLine(stdout);
		expect(summary).toContain("coverage-js");
	});
});

// ── --dir monorepo package detection ─────────────────────────────────

describe("collect --dir monorepo project detection", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("dir-mono", "git@github.com:myorg/my-mono.git");
		writeJson(root, "package.json", { name: "my-mono" });
		writeJson(root, "packages/ui/package.json", { name: "@myorg/ui" });
		writeJson(root, "packages/api/package.json", { name: "@myorg/api" });
		writeJson(root, "packages/ui/eslint-report.json", ESLINT_REPORT);
		writeJson(root, "packages/api/eslint-report.json", ESLINT_REPORT);
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("resolves project names from nearest package.json", () => {
		const { stdout, exitCode } = runCollect(["--dir=.", "--dry-run"], { cwd: root });

		expect(exitCode).toBe(0);
		const lines = stdout.trimEnd().split("\n");
		lines.pop();
		const jsonStr = lines.join("\n");

		const payload = JSON.parse(jsonStr);
		expect(payload.count).toBe(2);

		const projects = payload.documents.map((d: Record<string, unknown>) => d.project);
		expect(projects).toContain("@myorg/ui");
		expect(projects).toContain("@myorg/api");
	});
});

// ── --config mode ────────────────────────────────────────────────────

describe("collect --config (file)", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("config-file", "git@github.com:myorg/config-app.git");
		writeJson(root, "eslint-report.json", ESLINT_REPORT);
		writeJson(root, "coverage-summary.json", COVERAGE_JS_REPORT);
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("collects from a config file", () => {
		const config = [{ type: "eslint", input: "eslint-report.json" }];
		writeJson(root, ".qualink.json", config);

		const { stdout, exitCode } = runCollect(["--config=.qualink.json", "--dry-run"], { cwd: root });

		expect(exitCode).toBe(0);
		const { payload, summaryLine } = parseSinglePayload(stdout);
		expect(payload.metric_type).toBe("eslint");
		expect(payload.count).toBe(1);
		expect(summaryLine).toBe("dry-run: 1 eslint");
	});

	it("applies per-entry tags and category overrides", () => {
		const config = [
			{
				type: "eslint",
				input: "eslint-report.json",
				tags: ["team:frontend"],
				category: "web",
			},
		];
		writeJson(root, ".qualink-tags.json", config);

		const { stdout, exitCode } = runCollect(["--config=.qualink-tags.json", "--dry-run"], {
			cwd: root,
		});

		expect(exitCode).toBe(0);
		const { payload } = parseSinglePayload(stdout);
		const doc = payload.documents[0];
		expect(doc.tags).toEqual(["team:frontend"]);
		expect(doc.category).toBe("web");
	});

	it("applies per-entry project override", () => {
		const config = [{ type: "eslint", input: "eslint-report.json", project: "custom-proj" }];
		writeJson(root, ".qualink-proj.json", config);

		const { stdout, exitCode } = runCollect(["--config=.qualink-proj.json", "--dry-run"], {
			cwd: root,
		});

		expect(exitCode).toBe(0);
		const { payload } = parseSinglePayload(stdout);
		expect(payload.documents[0]?.project).toBe("custom-proj");
	});

	it("handles multiple collector types in one config", () => {
		const config = [
			{ type: "eslint", input: "eslint-report.json" },
			{ type: "coverage-js", input: "coverage-summary.json" },
		];
		writeJson(root, ".qualink-multi.json", config);

		const { stdout, exitCode } = runCollect(["--config=.qualink-multi.json", "--dry-run"], {
			cwd: root,
		});

		expect(exitCode).toBe(0);
		const summary = getSummaryLine(stdout);
		expect(summary).toContain("eslint");
		expect(summary).toContain("coverage-js");
	});
});

describe("collect --config glob patterns", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("config-glob");
		writeJson(root, "packages/a/coverage-summary.json", COVERAGE_JS_REPORT);
		writeJson(root, "packages/b/coverage-summary.json", COVERAGE_JS_REPORT);
		writeJson(root, ".qualink.json", [
			{ type: "coverage-js", input: "packages/*/coverage-summary.json" },
		]);
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("supports glob patterns in input", () => {
		const { stdout, exitCode } = runCollect(["--config=.qualink.json", "--dry-run"], { cwd: root });

		expect(exitCode).toBe(0);
		const { payload, summaryLine } = parseSinglePayload(stdout);
		expect(payload.count).toBe(2);
		expect(summaryLine).toBe("dry-run: 2 coverage-js");
	});
});

describe("collect --config (inline JSON)", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("config-inline", "git@github.com:myorg/inline-app.git");
		writeJson(root, "report.json", ESLINT_REPORT);
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("parses inline JSON array", () => {
		const inline = JSON.stringify([{ type: "eslint", input: "report.json" }]);

		const { stdout, exitCode } = runCollect([`--config=${inline}`, "--dry-run"], { cwd: root });

		expect(exitCode).toBe(0);
		const { payload } = parseSinglePayload(stdout);
		expect(payload.metric_type).toBe("eslint");
		expect(payload.count).toBe(1);
	});

	it("parses inline JSON single object", () => {
		const inline = JSON.stringify({ type: "eslint", input: "report.json" });

		const { stdout, exitCode } = runCollect([`--config=${inline}`, "--dry-run"], { cwd: root });

		expect(exitCode).toBe(0);
		const { payload } = parseSinglePayload(stdout);
		expect(payload.metric_type).toBe("eslint");
	});
});

// ── --config lighthouse URL extraction ───────────────────────────────

describe("collect --config lighthouse", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("config-lh");
		writeJson(root, "lhr.json", LIGHTHOUSE_REPORT);
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("extracts URL from report when not specified in config", () => {
		const config = [{ type: "lighthouse", input: "lhr.json" }];
		writeJson(root, ".qualink.json", config);

		const { stdout, exitCode } = runCollect(["--config=.qualink.json", "--dry-run"], { cwd: root });

		expect(exitCode).toBe(0);
		const { payload } = parseSinglePayload(stdout);
		expect(payload.documents[0]?.url).toBe("https://example.com");
	});

	it("uses config url override", () => {
		const config = [{ type: "lighthouse", input: "lhr.json", url: "https://override.com" }];
		writeJson(root, ".qualink-url.json", config);

		const { stdout, exitCode } = runCollect(["--config=.qualink-url.json", "--dry-run"], {
			cwd: root,
		});

		expect(exitCode).toBe(0);
		const { payload } = parseSinglePayload(stdout);
		expect(payload.documents[0]?.url).toBe("https://override.com");
	});
});

// ── error cases ──────────────────────────────────────────────────────

describe("collect --dir / --config errors", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("errors");
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("errors when both --dir and --config are provided", () => {
		const { stderr, exitCode } = runCollect(["--dir=.", "--config=[]", "--dry-run"], { cwd: root });

		expect(exitCode).not.toBe(0);
		expect(stderr).toContain("mutually exclusive");
	});

	it("errors on invalid config JSON", () => {
		const { stderr, exitCode } = runCollect(["--config=[{broken", "--dry-run"], { cwd: root });

		expect(exitCode).not.toBe(0);
		expect(stderr).toContain("Failed to parse");
	});

	it("errors on invalid collector type in config", () => {
		const config = JSON.stringify([{ type: "nope", input: "x.json" }]);

		const { stderr, exitCode } = runCollect([`--config=${config}`, "--dry-run"], { cwd: root });

		expect(exitCode).not.toBe(0);
		expect(stderr).toContain("invalid collector type");
	});

	it("errors on missing config file", () => {
		const { stderr, exitCode } = runCollect(["--config=nonexistent.json", "--dry-run"], {
			cwd: root,
		});

		expect(exitCode).not.toBe(0);
		expect(stderr).toContain("Failed to read config file");
	});
});
