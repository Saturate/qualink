import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverFiles, expandGlob } from "./discover.js";

describe("discoverFiles", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `qualink-discover-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("finds eslint-report.json", async () => {
		await mkdir(join(testDir, "packages/ui"), { recursive: true });
		await writeFile(join(testDir, "packages/ui/eslint-report.json"), "[]");

		const result = await discoverFiles(testDir);

		expect(result.get("eslint")).toHaveLength(1);
		expect(result.get("eslint")?.[0]).toContain("packages/ui/eslint-report.json");
	});

	it("finds biome-report.json", async () => {
		await writeFile(join(testDir, "biome-report.json"), "{}");

		const result = await discoverFiles(testDir);

		expect(result.get("biome")).toHaveLength(1);
	});

	it("finds coverage-summary.json", async () => {
		await mkdir(join(testDir, "packages/api"), { recursive: true });
		await writeFile(join(testDir, "packages/api/coverage-summary.json"), "{}");

		const result = await discoverFiles(testDir);

		expect(result.get("coverage-js")).toHaveLength(1);
	});

	it("finds coverage.cobertura.xml", async () => {
		await writeFile(join(testDir, "coverage.cobertura.xml"), "<coverage/>");

		const result = await discoverFiles(testDir);

		expect(result.get("coverage-dotnet")).toHaveLength(1);
	});

	it("finds cobertura-coverage.xml", async () => {
		await writeFile(join(testDir, "cobertura-coverage.xml"), "<coverage/>");

		const result = await discoverFiles(testDir);

		expect(result.get("coverage-dotnet")).toHaveLength(1);
	});

	it("finds .sarif files", async () => {
		await writeFile(join(testDir, "results.sarif"), "{}");
		await writeFile(join(testDir, "other.sarif.json"), "{}");

		const result = await discoverFiles(testDir);

		expect(result.get("sarif")).toHaveLength(2);
	});

	it("finds lighthouse reports inside .lighthouseci/", async () => {
		await mkdir(join(testDir, ".lighthouseci"), { recursive: true });
		await writeFile(join(testDir, ".lighthouseci/lhr-homepage.json"), "{}");

		const result = await discoverFiles(testDir);

		expect(result.get("lighthouse")).toHaveLength(1);
	});

	it("ignores lighthouse files outside .lighthouseci/", async () => {
		await writeFile(join(testDir, "lhr-homepage.json"), "{}");

		const result = await discoverFiles(testDir);

		expect(result.has("lighthouse")).toBe(false);
	});

	it("ignores files inside node_modules", async () => {
		await mkdir(join(testDir, "node_modules/pkg"), { recursive: true });
		await writeFile(join(testDir, "node_modules/pkg/eslint-report.json"), "[]");

		const result = await discoverFiles(testDir);

		expect(result.has("eslint")).toBe(false);
	});

	it("ignores files inside .git", async () => {
		await mkdir(join(testDir, ".git/hooks"), { recursive: true });
		await writeFile(join(testDir, ".git/hooks/coverage-summary.json"), "{}");

		const result = await discoverFiles(testDir);

		expect(result.has("coverage-js")).toBe(false);
	});

	it("returns empty map when no matches found", async () => {
		await writeFile(join(testDir, "readme.md"), "hello");

		const result = await discoverFiles(testDir);

		expect(result.size).toBe(0);
	});

	it("finds multiple files per collector", async () => {
		await mkdir(join(testDir, "packages/a"), { recursive: true });
		await mkdir(join(testDir, "packages/b"), { recursive: true });
		await writeFile(join(testDir, "packages/a/eslint-report.json"), "[]");
		await writeFile(join(testDir, "packages/b/eslint-report.json"), "[]");

		const result = await discoverFiles(testDir);

		expect(result.get("eslint")).toHaveLength(2);
	});
});

describe("expandGlob", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `qualink-glob-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("returns literal path when no wildcard", async () => {
		const result = await expandGlob("foo/bar.json", testDir);

		expect(result).toHaveLength(1);
		expect(result[0]).toContain("foo/bar.json");
	});

	it("expands * in path segments", async () => {
		await mkdir(join(testDir, "packages/ui"), { recursive: true });
		await mkdir(join(testDir, "packages/api"), { recursive: true });
		await writeFile(join(testDir, "packages/ui/coverage-summary.json"), "{}");
		await writeFile(join(testDir, "packages/api/coverage-summary.json"), "{}");

		const result = await expandGlob("packages/*/coverage-summary.json", testDir);

		expect(result).toHaveLength(2);
	});

	it("does not match across path separators", async () => {
		await mkdir(join(testDir, "a/b/c"), { recursive: true });
		await writeFile(join(testDir, "a/b/c/report.json"), "{}");

		const result = await expandGlob("a/*/report.json", testDir);

		// Should not match a/b/c/report.json because * doesn't cross /
		expect(result).toHaveLength(0);
	});

	it("ignores node_modules in glob expansion", async () => {
		await mkdir(join(testDir, "node_modules/pkg"), { recursive: true });
		await writeFile(join(testDir, "node_modules/pkg/coverage-summary.json"), "{}");

		const result = await expandGlob("*/*/coverage-summary.json", testDir);

		expect(result).toHaveLength(0);
	});
});
