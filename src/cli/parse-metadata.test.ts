import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CommonArgs } from "./common-args.js";
import { parseCommonMetadata } from "./parse-metadata.js";

// ── helpers ──────────────────────────────────────────────────────────

const CI_ENV_PREFIXES = [
	"QUALINK_",
	"BUILD_",
	"GITHUB_",
	"CI_",
	"TF_BUILD",
	"PNPM_PACKAGE_NAME",
	"CI",
];

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

function emptyArgs(overrides: Partial<CommonArgs> = {}): CommonArgs {
	return { ...overrides };
}

// ── environment & cwd isolation ──────────────────────────────────────

let savedEnv: NodeJS.ProcessEnv;
let savedCwd: string;

beforeEach(() => {
	savedEnv = { ...process.env };
	savedCwd = process.cwd();

	for (const key of Object.keys(process.env)) {
		if (CI_ENV_PREFIXES.some((p) => key.startsWith(p) || key === p)) {
			delete process.env[key];
		}
	}
});

afterEach(() => {
	process.chdir(savedCwd);
	process.env = savedEnv;
});

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

	it("detects projectName from .csproj", () => {
		process.chdir(join(root, "src/MyApp.Api"));
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.projectName).toBe("MyApp.Api");
	});

	it("detects different project in different subdir", () => {
		process.chdir(join(root, "src/MyApp.Core"));
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.projectName).toBe("MyApp.Core");
	});

	it("no projectName at repo root", () => {
		process.chdir(root);
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.projectName).toBeNull();
	});

	it("CLI --project overrides detection", () => {
		process.chdir(join(root, "src/MyApp.Api"));
		const meta = parseCommonMetadata(emptyArgs({ project: "override" }));
		expect(meta.projectName).toBe("override");
	});

	it("QUALINK_PROJECT env overrides detection", () => {
		process.env.QUALINK_PROJECT = "from-env";
		process.chdir(join(root, "src/MyApp.Api"));
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.projectName).toBe("from-env");
	});

	it("packageName is null (no package.json)", () => {
		process.chdir(join(root, "src/MyApp.Api"));
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.packageName).toBeNull();
	});

	it("repo parsed from Azure DevOps remote", () => {
		process.chdir(root);
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.repo).toBe("MyDotnetApp");
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

	it("detects packageName from package.json", () => {
		process.chdir(join(root, "packages/ui"));
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.packageName).toBe("@myorg/ui");
	});

	it("detects different package in different subdir", () => {
		process.chdir(join(root, "packages/api"));
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.packageName).toBe("@myorg/api");
	});

	it("PNPM_PACKAGE_NAME takes priority over filesystem", () => {
		process.env.PNPM_PACKAGE_NAME = "from-pnpm";
		process.chdir(join(root, "packages/ui"));
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.packageName).toBe("from-pnpm");
	});

	it("no packageName at repo root", () => {
		process.chdir(root);
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.packageName).toBeNull();
	});

	it("projectName is null (no .csproj)", () => {
		process.chdir(join(root, "packages/ui"));
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.projectName).toBeNull();
	});

	it("repo parsed from SSH remote", () => {
		process.chdir(root);
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.repo).toBe("my-pnpm-mono");
	});
});

// ── npm single project ──────────────────────────────────────────────

describe("npm single project", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("npm", "https://github.com/myorg/my-single-app.git");
		writeJson(root, "package.json", { name: "my-single-app" });
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("no packageName at repo root", () => {
		process.chdir(root);
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.packageName).toBeNull();
	});

	it("projectName is null", () => {
		process.chdir(root);
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.projectName).toBeNull();
	});

	it("explicit --package arg still works", () => {
		process.chdir(root);
		const meta = parseCommonMetadata(emptyArgs({ package: "explicit" }));
		expect(meta.packageName).toBe("explicit");
	});

	it("repo parsed from HTTPS remote", () => {
		process.chdir(root);
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.repo).toBe("my-single-app");
	});
});

// ── generic monorepo ─────────────────────────────────────────────────

describe("generic monorepo", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("generic");
		mkdirSync(join(root, "apps/frontend"), { recursive: true });
		mkdirSync(join(root, "apps/backend"), { recursive: true });
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("packageName null (no package.json in subdir)", () => {
		process.chdir(join(root, "apps/frontend"));
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.packageName).toBeNull();
	});

	it("projectName null (no .csproj in subdir)", () => {
		process.chdir(join(root, "apps/frontend"));
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.projectName).toBeNull();
	});

	it("repo falls back to cwd basename", () => {
		process.chdir(join(root, "apps/frontend"));
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.repo).toBe("frontend");
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

	it("Azure DevOps", () => {
		process.chdir(root);
		process.env.TF_BUILD = "True";
		process.env.BUILD_REPOSITORY_NAME = "org/MyRepo";
		process.env.BUILD_SOURCEBRANCHNAME = "feature/x";
		process.env.BUILD_SOURCEVERSION = "abc123def456abc123def456abc123def456abcd";
		process.env.BUILD_BUILDID = "42";

		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.pipelineProvider).toBe("azure-devops");
		expect(meta.repo).toBe("MyRepo");
		expect(meta.branch).toBe("feature/x");
		expect(meta.commitSha).toBe("abc123def456abc123def456abc123def456abcd");
		expect(meta.pipelineRunId).toBe("42");
	});

	it("GitHub Actions", () => {
		process.chdir(root);
		process.env.GITHUB_ACTIONS = "true";
		process.env.GITHUB_REPOSITORY = "myorg/my-gh-repo";
		process.env.GITHUB_REF_NAME = "main";
		process.env.GITHUB_SHA = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
		process.env.GITHUB_RUN_ID = "9999";

		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.pipelineProvider).toBe("github-actions");
		expect(meta.repo).toBe("my-gh-repo");
		expect(meta.branch).toBe("main");
		expect(meta.commitSha).toBe("deadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
		expect(meta.pipelineRunId).toBe("9999");
	});

	it("GitLab CI", () => {
		process.chdir(root);
		process.env.CI = "true";
		process.env.CI_PROJECT_PATH = "group/subgroup/my-gitlab-repo";
		process.env.CI_COMMIT_REF_NAME = "develop";
		process.env.CI_COMMIT_SHA = "1111111111111111111111111111111111111111";
		process.env.CI_PIPELINE_ID = "777";

		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.pipelineProvider).toBe("ci");
		expect(meta.repo).toBe("my-gitlab-repo");
		expect(meta.branch).toBe("develop");
		expect(meta.commitSha).toBe("1111111111111111111111111111111111111111");
		expect(meta.pipelineRunId).toBe("777");
	});

	it("local fallbacks", () => {
		process.chdir(root);
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.pipelineProvider).toBe("local");
		expect(meta.pipelineRunId).toMatch(/^local-\d+$/);
		expect(meta.branch).toBe("main");
		expect(meta.commitSha).toMatch(/^[0-9a-f]{40}$/);
	});
});

// ── detection priority ───────────────────────────────────────────────

describe("detection priority", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("priority");
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("CLI arg beats env var", () => {
		process.chdir(root);
		process.env.QUALINK_REPO = "env";
		const meta = parseCommonMetadata(emptyArgs({ repo: "cli" }));
		expect(meta.repo).toBe("cli");
	});

	it("QUALINK_* beats CI env", () => {
		process.chdir(root);
		process.env.QUALINK_BRANCH = "custom";
		process.env.GITHUB_REF_NAME = "pr";
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.branch).toBe("custom");
	});

	it("CI env beats git", () => {
		process.chdir(root);
		process.env.GITHUB_SHA = "ci-sha";
		const meta = parseCommonMetadata(emptyArgs());
		expect(meta.commitSha).toBe("ci-sha");
	});
});

// ── tags, environment, metadata fields ───────────────────────────────

describe("parseCommonMetadata", () => {
	it("returns all expected fields", () => {
		const meta = parseCommonMetadata({ repo: "test-repo", branch: "main", "commit-sha": "abc" });
		expect(meta).toHaveProperty("repo", "test-repo");
		expect(meta).toHaveProperty("branch", "main");
		expect(meta).toHaveProperty("commitSha", "abc");
		expect(meta).toHaveProperty("pipelineProvider");
		expect(meta).toHaveProperty("pipelineRunId");
		expect(meta).toHaveProperty("environment", "ci");
		expect(meta).toHaveProperty("collectorVersion", "0.1.0");
		expect(meta).toHaveProperty("tags");
		expect(meta).toHaveProperty("packageName");
		expect(meta).toHaveProperty("projectName");
		expect(meta).toHaveProperty("category");
	});

	it("default tags include repo name", () => {
		const meta = parseCommonMetadata({ repo: "my-app" });
		expect(meta.tags).toContain("repo:my-app");
	});

	it("parses comma-separated tags", () => {
		const meta = parseCommonMetadata({ repo: "x", tags: "a,b,c" });
		expect(meta.tags).toEqual(["a", "b", "c"]);
	});

	it("deduplicates tags", () => {
		const meta = parseCommonMetadata({ repo: "x", tags: "a,b,a" });
		expect(meta.tags).toEqual(["a", "b"]);
	});

	it("throws on invalid environment", () => {
		expect(() => parseCommonMetadata({ repo: "x", environment: "staging" })).toThrow(
			/invalid environment/i,
		);
	});

	it("accepts valid environments", () => {
		for (const env of ["dev", "test", "prod", "ci"]) {
			const meta = parseCommonMetadata({ repo: "x", environment: env });
			expect(meta.environment).toBe(env);
		}
	});

	it("respects custom collector version", () => {
		const meta = parseCommonMetadata({ repo: "x", "collector-version": "2.0.0" });
		expect(meta.collectorVersion).toBe("2.0.0");
	});

	it("category defaults to null", () => {
		const meta = parseCommonMetadata({ repo: "x" });
		expect(meta.category).toBeNull();
	});

	it("reads category from arg", () => {
		const meta = parseCommonMetadata({ repo: "x", category: "frontend" });
		expect(meta.category).toBe("frontend");
	});
});
