import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ── helpers ──────────────────────────────────────────────────────────

const CLI_PATH = resolve(fileURLToPath(import.meta.url), "../../../dist/cli/index.js");

const CI_ENV_KEYS = ["QUALINK_", "BUILD_", "GITHUB_", "CI_", "TF_BUILD", "PNPM_PACKAGE_NAME", "CI"];

/** Return a clean copy of process.env with all CI-related vars stripped. */
function cleanEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
	const env = { ...process.env };
	for (const key of Object.keys(env)) {
		if (CI_ENV_KEYS.some((p) => key.startsWith(p) || key === p)) {
			delete env[key];
		}
	}
	return { ...env, ...extra };
}

function createTempGitRepo(name: string, remoteUrl?: string): string {
	const dir = mkdtempSync(join(tmpdir(), `qualink-e2e-${name}-`));
	const git = (args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });

	git(["init"]);
	git(["config", "user.email", "test@test.com"]);
	git(["config", "user.name", "Test"]);
	git(["checkout", "-b", "main"]);
	git(["commit", "--allow-empty", "-m", "init"]);

	if (remoteUrl) {
		git(["remote", "add", "origin", remoteUrl]);
	}

	return dir;
}

function writeJson(dir: string, relativePath: string, data: unknown): void {
	const full = join(dir, relativePath);
	mkdirSync(join(full, ".."), { recursive: true });
	writeFileSync(full, JSON.stringify(data));
}

function writeFile(dir: string, relativePath: string, content = ""): void {
	const full = join(dir, relativePath);
	mkdirSync(join(full, ".."), { recursive: true });
	writeFileSync(full, content);
}

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

	it("detects package from package.json in subdir", () => {
		const { payload } = runMeta([], { cwd: join(root, "packages/ui") });
		expect(payload.documents[0].package).toBe("@myorg/ui");
	});

	it("no package at repo root", () => {
		const { payload } = runMeta([], { cwd: root });
		expect(payload.documents[0].package).toBeNull();
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

	it("--repo, --branch, --project override detection", () => {
		const { payload } = runMeta(
			["--repo", "cli-repo", "--branch", "cli-branch", "--project", "cli-proj"],
			{ cwd: root },
		);
		const doc = payload.documents[0];
		expect(doc.repo).toBe("cli-repo");
		expect(doc.branch).toBe("cli-branch");
		expect(doc.project).toBe("cli-proj");
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
		expect(doc.collector_version).toBe("0.1.0");
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
