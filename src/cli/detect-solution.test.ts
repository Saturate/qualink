import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	createTempGitRepo,
	emptyArgs,
	stripCiEnvVars,
	writeFile,
	writeJson,
} from "../test-helpers.js";
import { detectSolution } from "./detect-solution.js";

// ── env & cwd isolation ──────────────────────────────────────────────

let savedEnv: NodeJS.ProcessEnv;
let savedCwd: string;

beforeEach(() => {
	savedEnv = { ...process.env };
	savedCwd = process.cwd();
	stripCiEnvVars(["QUALINK_", "PNPM_PACKAGE_NAME"]);
});

afterEach(() => {
	process.chdir(savedCwd);
	process.env = savedEnv;
});

// ── .sln detection ───────────────────────────────────────────────────

describe("detectSolution — .sln", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("sln");
		writeFile(root, "MyApp.sln");
		mkdirSync(join(root, "src/MyApp.Api"), { recursive: true });
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("detects .sln from subdir", () => {
		process.chdir(join(root, "src/MyApp.Api"));
		expect(detectSolution(emptyArgs())).toBe("MyApp");
	});

	it("detects .sln at repo root", () => {
		process.chdir(root);
		expect(detectSolution(emptyArgs())).toBe("MyApp");
	});
});

// ── JS workspace root detection ─────────────────────────────────────

describe("detectSolution — JS workspace", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("ws");
		writeJson(root, "package.json", { name: "my-workspace" });
		mkdirSync(join(root, "packages/ui"), { recursive: true });
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("detects workspace root name from subdir", () => {
		process.chdir(join(root, "packages/ui"));
		expect(detectSolution(emptyArgs())).toBe("my-workspace");
	});

	it("returns undefined at repo root (not a workspace subdir)", () => {
		process.chdir(root);
		expect(detectSolution(emptyArgs())).toBeUndefined();
	});
});

// ── no solution ──────────────────────────────────────────────────────

describe("detectSolution — no solution", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("empty");
		mkdirSync(join(root, "src"), { recursive: true });
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("returns undefined when no .sln and no workspace root", () => {
		process.chdir(join(root, "src"));
		expect(detectSolution(emptyArgs())).toBeUndefined();
	});
});

// ── priority chain ───────────────────────────────────────────────────

describe("detectSolution — priority", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("priority");
		writeFile(root, "MyApp.sln");
		writeJson(root, "package.json", { name: "my-workspace" });
		mkdirSync(join(root, "src"), { recursive: true });
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("--solution arg overrides auto-detection", () => {
		process.chdir(join(root, "src"));
		expect(detectSolution(emptyArgs({ solution: "explicit" }))).toBe("explicit");
	});

	it("QUALINK_SOLUTION env overrides auto-detection", () => {
		process.env.QUALINK_SOLUTION = "from-env";
		process.chdir(join(root, "src"));
		expect(detectSolution(emptyArgs())).toBe("from-env");
	});

	it("--solution arg beats QUALINK_SOLUTION env", () => {
		process.env.QUALINK_SOLUTION = "from-env";
		process.chdir(join(root, "src"));
		expect(detectSolution(emptyArgs({ solution: "from-arg" }))).toBe("from-arg");
	});

	it(".sln takes priority over workspace root package.json", () => {
		process.chdir(join(root, "src"));
		expect(detectSolution(emptyArgs())).toBe("MyApp");
	});
});
