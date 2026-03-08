import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanEnv, createTempGitRepo, writeFile, writeJson } from "../test-helpers.js";
import { DEFAULT_COLLECTOR_VERSION } from "./parse-metadata.js";

// ── helpers ──────────────────────────────────────────────────────────

const CLI_PATH = resolve(fileURLToPath(import.meta.url), "../../../dist/cli/index.js");

interface CliOutput {
	payload: {
		metric_type: string;
		count: number;
		documents: Record<string, unknown>[];
		dry_run?: boolean;
	};
	statusLine: string;
}

function runMeta(args: string[], opts: { cwd: string; env?: Record<string, string> }): CliOutput {
	const stdout = execFileSync("node", [CLI_PATH, "meta", ...args], {
		cwd: opts.cwd,
		env: cleanEnv(opts.env),
		encoding: "utf-8",
	});

	const lines = stdout.trimEnd().split("\n");
	const statusLine = lines.pop() ?? "";
	return { payload: JSON.parse(lines.join("\n")), statusLine };
}

// ── .NET solution ────────────────────────────────────────────────────

describe(".NET solution", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("dotnet", "https://dev.azure.com/org/project/_git/MyDotnetApp");
		writeFile(root, "MyApp.sln");
		writeFile(root, "src/MyApp.Api/MyApp.Api.csproj", "<Project />");
		writeFile(root, "src/MyApp.Core/MyApp.Core.csproj", "<Project />");
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("detects repo from Azure DevOps remote", () => {
		const { payload } = runMeta([], { cwd: root });
		const doc = payload.documents[0];
		expect(doc.repo).toBe("MyDotnetApp");
		expect(doc.project).toBeNull();
	});

	it("detects solution from .sln", () => {
		const { payload } = runMeta([], { cwd: join(root, "src/MyApp.Api") });
		expect(payload.documents[0].solution).toBe("MyApp");
	});

	it("detects project from .csproj when run from subdir", () => {
		const { payload } = runMeta([], { cwd: join(root, "src/MyApp.Api") });
		const doc = payload.documents[0];
		expect(doc.project).toBe("MyApp.Api");
	});

	it("--project overrides auto-detection", () => {
		const { payload } = runMeta(["--project", "override"], {
			cwd: join(root, "src/MyApp.Api"),
		});
		expect(payload.documents[0].project).toBe("override");
	});
});

// ── pnpm monorepo ────────────────────────────────────────────────────

describe("pnpm monorepo", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("pnpm", "git@github.com:myorg/my-pnpm-mono.git");
		writeJson(root, "package.json", { name: "my-pnpm-mono" });
		writeFile(root, "pnpm-workspace.yaml", "packages:\n  - packages/*\n");
		writeJson(root, "packages/ui/package.json", { name: "@myorg/ui" });
		writeJson(root, "packages/api/package.json", { name: "@myorg/api" });
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("detects project from package.json in subdir", () => {
		const { payload } = runMeta([], { cwd: join(root, "packages/ui") });
		expect(payload.documents[0].project).toBe("@myorg/ui");
	});

	it("detects solution from workspace root", () => {
		const { payload } = runMeta([], { cwd: join(root, "packages/ui") });
		expect(payload.documents[0].solution).toBe("my-pnpm-mono");
	});

	it("no project at repo root", () => {
		const { payload } = runMeta([], { cwd: root });
		expect(payload.documents[0].project).toBeNull();
	});

	it("no solution at repo root", () => {
		const { payload } = runMeta([], { cwd: root });
		expect(payload.documents[0].solution).toBeNull();
	});

	it("repo parsed from SSH remote", () => {
		const { payload } = runMeta([], { cwd: root });
		expect(payload.documents[0].repo).toBe("my-pnpm-mono");
	});
});

// ── CI environment detection ─────────────────────────────────────────

describe("CI environment detection", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("ci");
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("Azure DevOps env vars", () => {
		const { payload } = runMeta([], {
			cwd: root,
			env: {
				TF_BUILD: "True",
				BUILD_REPOSITORY_NAME: "org/MyRepo",
				BUILD_SOURCEBRANCHNAME: "feature/x",
				BUILD_SOURCEVERSION: "abc123def456abc123def456abc123def456abcd",
				BUILD_BUILDID: "42",
			},
		});
		const doc = payload.documents[0];
		expect(doc.pipeline_provider).toBe("azure-devops");
		expect(doc.repo).toBe("MyRepo");
		expect(doc.branch).toBe("feature/x");
		expect(doc.commit_sha).toBe("abc123def456abc123def456abc123def456abcd");
		expect(doc.pipeline_run_id).toBe("42");
	});

	it("GitHub Actions env vars", () => {
		const { payload } = runMeta([], {
			cwd: root,
			env: {
				GITHUB_ACTIONS: "true",
				GITHUB_REPOSITORY: "myorg/my-gh-repo",
				GITHUB_REF_NAME: "main",
				GITHUB_SHA: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
				GITHUB_RUN_ID: "9999",
			},
		});
		const doc = payload.documents[0];
		expect(doc.pipeline_provider).toBe("github-actions");
		expect(doc.repo).toBe("my-gh-repo");
		expect(doc.branch).toBe("main");
		expect(doc.commit_sha).toBe("deadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
		expect(doc.pipeline_run_id).toBe("9999");
	});

	it("no CI env → local fallbacks", () => {
		const { payload } = runMeta([], { cwd: root });
		const doc = payload.documents[0];
		expect(doc.pipeline_provider).toBe("local");
		expect(doc.pipeline_run_id).toMatch(/^local-\d+$/);
		expect(doc.branch).toBe("main");
		expect(doc.commit_sha).toMatch(/^[0-9a-f]{40}$/);
	});
});

// ── CLI arg / env overrides ──────────────────────────────────────────

describe("CLI arg / env overrides", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("overrides");
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("--repo, --branch, --project, --solution override detection", () => {
		const { payload } = runMeta(
			[
				"--repo",
				"cli-repo",
				"--branch",
				"cli-branch",
				"--project",
				"cli-proj",
				"--solution",
				"cli-sln",
			],
			{ cwd: root },
		);
		const doc = payload.documents[0];
		expect(doc.repo).toBe("cli-repo");
		expect(doc.branch).toBe("cli-branch");
		expect(doc.project).toBe("cli-proj");
		expect(doc.solution).toBe("cli-sln");
	});

	it("QUALINK_SOLUTION env var overrides detection", () => {
		const { payload } = runMeta([], {
			cwd: root,
			env: { QUALINK_SOLUTION: "env-sln" },
		});
		expect(payload.documents[0].solution).toBe("env-sln");
	});

	it("QUALINK_* env vars override CI env", () => {
		const { payload } = runMeta([], {
			cwd: root,
			env: {
				GITHUB_ACTIONS: "true",
				GITHUB_REPOSITORY: "myorg/ci-repo",
				QUALINK_REPO: "env-repo",
				QUALINK_BRANCH: "env-branch",
			},
		});
		const doc = payload.documents[0];
		expect(doc.repo).toBe("env-repo");
		expect(doc.branch).toBe("env-branch");
	});
});

// ── output modes ─────────────────────────────────────────────────────

describe("output modes", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("output");
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("default → stdout JSON with correct shape", () => {
		const { payload, statusLine } = runMeta([], { cwd: root });
		expect(payload.metric_type).toBe("meta");
		expect(payload.count).toBe(1);
		expect(payload.documents).toHaveLength(1);
		expect(statusLine).toBe("relayed 1 meta document(s)");

		const doc = payload.documents[0];
		expect(doc).toHaveProperty("@timestamp");
		expect(doc.metric_type).toBe("meta");
		expect(doc.tool).toBe("qualink");
		expect(doc.languages).toEqual([]);
		expect(doc.environment).toBe("ci");
		expect(doc.collector_version).toBe(DEFAULT_COLLECTOR_VERSION);
	});

	it("--dry-run → dry-run JSON shape", () => {
		const { payload, statusLine } = runMeta(["--dry-run"], { cwd: root });
		expect(payload.dry_run).toBe(true);
		expect(payload.metric_type).toBe("meta");
		expect(payload.count).toBe(1);
		expect(payload.documents).toHaveLength(1);
		expect(statusLine).toBe("dry-run produced 1 meta document(s)");
	});
});
