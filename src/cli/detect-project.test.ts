import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	createTempGitRepo,
	emptyArgs,
	stripCiEnvVars,
	writeFile,
	writeJson,
} from "../test-helpers.js";
import { detectProjectName } from "./detect-project.js";

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

// ── .csproj detection ────────────────────────────────────────────────

describe("detectProjectName — .csproj", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("csproj");
		writeFile(root, "src/MyApp.Api/MyApp.Api.csproj", "<Project />");
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("detects .csproj name from CWD", () => {
		process.chdir(join(root, "src/MyApp.Api"));
		expect(detectProjectName(emptyArgs())).toBe("MyApp.Api");
	});

	it("returns undefined at repo root (no .csproj)", () => {
		process.chdir(root);
		expect(detectProjectName(emptyArgs())).toBeUndefined();
	});
});

// ── package.json detection ───────────────────────────────────────────

describe("detectProjectName — package.json", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("pkg");
		writeJson(root, "package.json", { name: "mono-root" });
		writeJson(root, "packages/ui/package.json", { name: "@myorg/ui" });
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("detects package.json name from workspace subdir", () => {
		process.chdir(join(root, "packages/ui"));
		expect(detectProjectName(emptyArgs())).toBe("@myorg/ui");
	});

	it("returns undefined at repo root (CWD == git root)", () => {
		process.chdir(root);
		expect(detectProjectName(emptyArgs())).toBeUndefined();
	});
});

// ── .csproj wins over package.json ───────────────────────────────────

describe("detectProjectName — .csproj beats package.json", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("both");
		writeFile(root, "src/MyApp/MyApp.csproj", "<Project />");
		writeJson(root, "src/MyApp/package.json", { name: "js-name" });
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("returns .csproj name when both exist", () => {
		process.chdir(join(root, "src/MyApp"));
		expect(detectProjectName(emptyArgs())).toBe("MyApp");
	});
});

// ── priority chain ───────────────────────────────────────────────────

describe("detectProjectName — priority", () => {
	let root: string;

	beforeAll(() => {
		root = createTempGitRepo("prio");
		writeJson(root, "package.json", { name: "root" });
		writeJson(root, "packages/ui/package.json", { name: "@myorg/ui" });
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("--project arg overrides auto-detection", () => {
		process.chdir(join(root, "packages/ui"));
		expect(detectProjectName(emptyArgs({ project: "explicit" }))).toBe("explicit");
	});

	it("QUALINK_PROJECT env overrides auto-detection", () => {
		process.env.QUALINK_PROJECT = "from-env";
		process.chdir(join(root, "packages/ui"));
		expect(detectProjectName(emptyArgs())).toBe("from-env");
	});

	it("--project arg beats QUALINK_PROJECT env", () => {
		process.env.QUALINK_PROJECT = "from-env";
		process.chdir(join(root, "packages/ui"));
		expect(detectProjectName(emptyArgs({ project: "from-arg" }))).toBe("from-arg");
	});

	it("PNPM_PACKAGE_NAME beats filesystem detection", () => {
		process.env.PNPM_PACKAGE_NAME = "pnpm-name";
		process.chdir(join(root, "packages/ui"));
		expect(detectProjectName(emptyArgs())).toBe("pnpm-name");
	});

	it("QUALINK_PROJECT beats PNPM_PACKAGE_NAME", () => {
		process.env.QUALINK_PROJECT = "qualink";
		process.env.PNPM_PACKAGE_NAME = "pnpm";
		process.chdir(join(root, "packages/ui"));
		expect(detectProjectName(emptyArgs())).toBe("qualink");
	});
});
