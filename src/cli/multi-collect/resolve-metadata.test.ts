import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTempGitRepo, makeMetadata, writeFile, writeJson } from "../../test-helpers.js";
import {
	type FileMetadataOverrides,
	mergeMetadata,
	resolveFileMetadata,
} from "./resolve-metadata.js";

describe("mergeMetadata", () => {
	it("uses base metadata when no overrides", () => {
		const base = makeMetadata({ projectName: "base-proj", category: "web" });

		const result = mergeMetadata(base, {});

		expect(result.projectName).toBe("base-proj");
		expect(result.category).toBe("web");
		expect(result.tags).toEqual(["test"]);
	});

	it("file overrides fill in when base has null", () => {
		const base = makeMetadata({ projectName: null });
		const fileOverrides: FileMetadataOverrides = { projectName: "detected-proj" };

		const result = mergeMetadata(base, fileOverrides);

		expect(result.projectName).toBe("detected-proj");
	});

	it("base metadata takes precedence over file overrides", () => {
		const base = makeMetadata({ projectName: "cli-proj" });
		const fileOverrides: FileMetadataOverrides = { projectName: "detected-proj" };

		const result = mergeMetadata(base, fileOverrides);

		expect(result.projectName).toBe("cli-proj");
	});

	it("config overrides take highest precedence", () => {
		const base = makeMetadata({ projectName: "cli-proj", tags: ["from-cli"] });
		const fileOverrides: FileMetadataOverrides = { projectName: "detected-proj" };
		const configOverrides: FileMetadataOverrides = {
			projectName: "config-proj",
			tags: ["team:frontend"],
			category: "frontend",
		};

		const result = mergeMetadata(base, fileOverrides, configOverrides);

		expect(result.projectName).toBe("config-proj");
		expect(result.tags).toEqual(["team:frontend"]);
		expect(result.category).toBe("frontend");
	});

	it("preserves non-overridden fields from base", () => {
		const base = makeMetadata({
			repo: "my-repo",
			branch: "feat/x",
			commitSha: "abc",
		});
		const configOverrides: FileMetadataOverrides = { tags: ["new-tag"] };

		const result = mergeMetadata(base, {}, configOverrides);

		expect(result.repo).toBe("my-repo");
		expect(result.branch).toBe("feat/x");
		expect(result.commitSha).toBe("abc");
		expect(result.tags).toEqual(["new-tag"]);
	});

	it("solution follows same precedence chain", () => {
		const base = makeMetadata({ solution: null });
		const fileOverrides: FileMetadataOverrides = { solution: "MySolution" };

		const result = mergeMetadata(base, fileOverrides);

		expect(result.solution).toBe("MySolution");
	});

	it("config solution overrides file and base", () => {
		const base = makeMetadata({ solution: "base-sln" });
		const fileOverrides: FileMetadataOverrides = { solution: "file-sln" };
		const configOverrides: FileMetadataOverrides = { solution: "config-sln" };

		const result = mergeMetadata(base, fileOverrides, configOverrides);

		expect(result.solution).toBe("config-sln");
	});

	it("config category null overrides base category", () => {
		const base = makeMetadata({ category: "web" });
		const configOverrides: FileMetadataOverrides = { category: null };

		const result = mergeMetadata(base, {}, configOverrides);

		expect(result.category).toBeNull();
	});
});

// ── resolveFileMetadata ──────────────────────────────────────────────
// resolveFileMetadata calls `git rev-parse --show-toplevel` from CWD,
// so we must chdir into the temp repo for correct git root resolution.

describe("resolveFileMetadata — JS monorepo", () => {
	let root: string;
	let savedCwd: string;

	beforeEach(() => {
		savedCwd = process.cwd();
	});
	afterEach(() => {
		process.chdir(savedCwd);
	});

	beforeAll(() => {
		root = createTempGitRepo("js-mono");
		writeJson(root, "package.json", { name: "my-mono" });
		writeJson(root, "packages/ui/package.json", { name: "@myorg/ui" });
		writeJson(root, "packages/api/package.json", { name: "@myorg/api" });
		writeFile(root, "packages/ui/eslint-report.json", "[]");
		writeFile(root, "packages/api/eslint-report.json", "[]");
		writeFile(root, "eslint-report.json", "[]");
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("detects projectName from nearest package.json for eslint", () => {
		process.chdir(root);
		const overrides = resolveFileMetadata(join(root, "packages/ui/eslint-report.json"), "eslint");
		expect(overrides.projectName).toBe("@myorg/ui");
	});

	it("detects different projectName per package", () => {
		process.chdir(root);
		const overrides = resolveFileMetadata(join(root, "packages/api/eslint-report.json"), "eslint");
		expect(overrides.projectName).toBe("@myorg/api");
	});

	it("detects solution from workspace root package.json", () => {
		process.chdir(root);
		const overrides = resolveFileMetadata(join(root, "packages/ui/eslint-report.json"), "eslint");
		expect(overrides.solution).toBe("my-mono");
	});

	it("solution is null for files at git root", () => {
		process.chdir(root);
		const overrides = resolveFileMetadata(join(root, "eslint-report.json"), "eslint");
		expect(overrides.solution).toBeNull();
	});
});

describe("resolveFileMetadata — .NET solution", () => {
	let root: string;
	let savedCwd: string;

	beforeEach(() => {
		savedCwd = process.cwd();
	});
	afterEach(() => {
		process.chdir(savedCwd);
	});

	beforeAll(() => {
		root = createTempGitRepo("dotnet-sln");
		writeFile(root, "MyApp.sln");
		writeFile(root, "src/MyApp.Api/MyApp.Api.csproj", "<Project />");
		writeFile(root, "src/MyApp.Api/results.sarif", "{}");
		writeFile(root, "src/MyApp.Core/MyApp.Core.csproj", "<Project />");
		writeFile(root, "src/MyApp.Core/coverage.cobertura.xml", "");
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("detects projectName from .csproj for sarif", () => {
		process.chdir(root);
		const overrides = resolveFileMetadata(join(root, "src/MyApp.Api/results.sarif"), "sarif");
		expect(overrides.projectName).toBe("MyApp.Api");
	});

	it("detects projectName from .csproj for coverage-dotnet", () => {
		process.chdir(root);
		const overrides = resolveFileMetadata(
			join(root, "src/MyApp.Core/coverage.cobertura.xml"),
			"coverage-dotnet",
		);
		expect(overrides.projectName).toBe("MyApp.Core");
	});

	it("detects solution from .sln", () => {
		process.chdir(root);
		const overrides = resolveFileMetadata(join(root, "src/MyApp.Api/results.sarif"), "sarif");
		expect(overrides.solution).toBe("MyApp");
	});
});

describe("resolveFileMetadata — no solution or project", () => {
	let root: string;
	let savedCwd: string;

	beforeEach(() => {
		savedCwd = process.cwd();
	});
	afterEach(() => {
		process.chdir(savedCwd);
	});

	beforeAll(() => {
		root = createTempGitRepo("bare");
		writeFile(root, "report.json", "[]");
	});

	afterAll(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("returns null projectName and null solution at git root", () => {
		process.chdir(root);
		const overrides = resolveFileMetadata(join(root, "report.json"), "eslint");
		expect(overrides.projectName).toBeNull();
		expect(overrides.solution).toBeNull();
	});
});
