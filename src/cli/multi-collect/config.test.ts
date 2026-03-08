import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseConfig, resolveConfig } from "./config.js";

describe("parseConfig", () => {
	it("parses inline JSON array", async () => {
		const config = JSON.stringify([
			{ type: "eslint", input: "report.json" },
			{ type: "biome", input: "biome-report.json", tags: ["team:web"] },
		]);

		const result = await parseConfig(config);

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ type: "eslint", input: "report.json" });
		expect(result[1]).toEqual({ type: "biome", input: "biome-report.json", tags: ["team:web"] });
	});

	it("parses inline JSON single object as array of one", async () => {
		const config = JSON.stringify({ type: "eslint", input: "report.json" });

		const result = await parseConfig(config);

		expect(result).toHaveLength(1);
		expect(result[0]?.type).toBe("eslint");
	});

	it("parses config from file", async () => {
		const dir = join(tmpdir(), `qualink-config-test-${Date.now()}`);
		await mkdir(dir, { recursive: true });
		const filePath = join(dir, ".qualink.json");
		await writeFile(
			filePath,
			JSON.stringify([{ type: "coverage-js", input: "coverage-summary.json" }]),
		);

		try {
			const result = await parseConfig(filePath);
			expect(result).toHaveLength(1);
			expect(result[0]?.type).toBe("coverage-js");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("supports all optional fields", async () => {
		const config = JSON.stringify([
			{
				type: "lighthouse",
				input: "lhr.json",
				tags: ["perf"],
				category: "frontend",
				project: "ui",
				solution: "my-workspace",
				url: "https://example.com",
			},
		]);

		const result = await parseConfig(config);

		expect(result[0]).toEqual({
			type: "lighthouse",
			input: "lhr.json",
			tags: ["perf"],
			category: "frontend",
			project: "ui",
			solution: "my-workspace",
			url: "https://example.com",
		});
	});

	it("throws on missing type", async () => {
		const config = JSON.stringify([{ input: "report.json" }]);

		await expect(parseConfig(config)).rejects.toThrow("missing required field 'type'");
	});

	it("throws on invalid type", async () => {
		const config = JSON.stringify([{ type: "invalid", input: "report.json" }]);

		await expect(parseConfig(config)).rejects.toThrow("invalid collector type 'invalid'");
	});

	it("throws on missing input", async () => {
		const config = JSON.stringify([{ type: "eslint" }]);

		await expect(parseConfig(config)).rejects.toThrow("missing required field 'input'");
	});

	it("throws on non-object entry", async () => {
		const config = JSON.stringify(["not-an-object"]);

		await expect(parseConfig(config)).rejects.toThrow("expected an object");
	});

	it("throws on empty array", async () => {
		await expect(parseConfig("[]")).rejects.toThrow("at least one entry");
	});

	it("throws on invalid inline JSON", async () => {
		await expect(parseConfig("[{broken")).rejects.toThrow("Failed to parse inline JSON");
	});

	it("throws on non-existent file", async () => {
		await expect(parseConfig("/nonexistent/.qualink.json")).rejects.toThrow(
			"Failed to read config file",
		);
	});

	it("throws on invalid tags type", async () => {
		const config = JSON.stringify([{ type: "eslint", input: "r.json", tags: "not-array" }]);

		await expect(parseConfig(config)).rejects.toThrow("must be an array of strings");
	});

	it("throws on non-string category", async () => {
		const config = JSON.stringify([{ type: "eslint", input: "r.json", category: 123 }]);

		await expect(parseConfig(config)).rejects.toThrow("must be a string");
	});

	it("throws on non-string project", async () => {
		const config = JSON.stringify([{ type: "eslint", input: "r.json", project: 123 }]);

		await expect(parseConfig(config)).rejects.toThrow("must be a string");
	});

	it("throws on non-string solution", async () => {
		const config = JSON.stringify([{ type: "eslint", input: "r.json", solution: true }]);

		await expect(parseConfig(config)).rejects.toThrow("must be a string");
	});

	it("includes index in error messages", async () => {
		const config = JSON.stringify([{ type: "eslint", input: "ok.json" }, { type: "bad" }]);

		await expect(parseConfig(config)).rejects.toThrow("config[1]");
	});
});

describe("resolveConfig", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `qualink-resolve-config-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("resolves literal paths", async () => {
		await writeFile(join(testDir, "report.json"), "[]");

		const resolved = await resolveConfig([{ type: "eslint", input: "report.json" }], testDir);

		expect(resolved).toHaveLength(1);
		expect(resolved[0]?.files).toHaveLength(1);
		expect(resolved[0]?.files[0]).toContain("report.json");
	});

	it("resolves glob patterns", async () => {
		await mkdir(join(testDir, "packages/a"), { recursive: true });
		await mkdir(join(testDir, "packages/b"), { recursive: true });
		await writeFile(join(testDir, "packages/a/coverage-summary.json"), "{}");
		await writeFile(join(testDir, "packages/b/coverage-summary.json"), "{}");

		const resolved = await resolveConfig(
			[{ type: "coverage-js", input: "packages/*/coverage-summary.json" }],
			testDir,
		);

		expect(resolved[0]?.files).toHaveLength(2);
	});

	it("preserves config metadata on resolved entries", async () => {
		const resolved = await resolveConfig(
			[{ type: "eslint", input: "report.json", tags: ["team:web"], category: "web" }],
			testDir,
		);

		expect(resolved[0]?.tags).toEqual(["team:web"]);
		expect(resolved[0]?.category).toBe("web");
	});
});
