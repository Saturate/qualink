import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommonArgs } from "./cli/common-args.js";
import { DEFAULT_COLLECTOR_VERSION } from "./cli/parse-metadata.js";
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
		solution: null,
		projectName: null,
		collectorVersion: DEFAULT_COLLECTOR_VERSION,
		...overrides,
	};
}

export function createTempGitRepo(name: string, remoteUrl?: string): string {
	// realpathSync resolves macOS /tmp → /private/tmp symlink so paths
	// match what git rev-parse --show-toplevel returns.
	const dir = realpathSync(mkdtempSync(join(tmpdir(), `qualink-test-${name}-`)));
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

export function writeJson(dir: string, relativePath: string, data: unknown): void {
	const full = join(dir, relativePath);
	mkdirSync(join(full, ".."), { recursive: true });
	writeFileSync(full, JSON.stringify(data));
}

export function writeFile(dir: string, relativePath: string, content = ""): void {
	const full = join(dir, relativePath);
	mkdirSync(join(full, ".."), { recursive: true });
	writeFileSync(full, content);
}

export function emptyArgs(overrides: Partial<CommonArgs> = {}): CommonArgs {
	return { ...overrides };
}

/** CI-related env var prefixes/keys to strip for test isolation. */
export const CI_ENV_KEYS = [
	"QUALINK_",
	"BUILD_",
	"GITHUB_",
	"CI_",
	"TF_BUILD",
	"PNPM_PACKAGE_NAME",
	"CI",
];

/** Return a clean copy of process.env with all CI-related vars stripped. */
export function cleanEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
	const env = { ...process.env };
	for (const key of Object.keys(env)) {
		if (CI_ENV_KEYS.some((p) => key.startsWith(p) || key === p)) {
			delete env[key];
		}
	}
	return { ...env, ...extra };
}

/** Strip CI env vars from process.env in-place (for in-process tests). */
export function stripCiEnvVars(prefixes: string[] = CI_ENV_KEYS): void {
	for (const key of Object.keys(process.env)) {
		if (prefixes.some((p) => key.startsWith(p) || key === p)) {
			delete process.env[key];
		}
	}
}
