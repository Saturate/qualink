import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadJsonInput, loadTextInput } from "./load-input.js";

describe("loadJsonInput", () => {
	let dir: string;

	beforeAll(() => {
		dir = mkdtempSync(join(tmpdir(), "qualink-load-input-"));
		writeFileSync(join(dir, "valid.json"), JSON.stringify({ foo: 1 }));
		writeFileSync(join(dir, "data.txt"), "hello world\n");
		writeFileSync(join(dir, "bad.json"), "not json");
	});

	afterAll(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it("loads and parses a valid JSON file", async () => {
		const result = await loadJsonInput({ input: join(dir, "valid.json") });
		expect(result).toEqual({ foo: 1 });
	});

	it("throws on missing input arg", async () => {
		await expect(loadJsonInput({})).rejects.toThrow("Missing required value: input");
	});

	it("throws on non-existent file", async () => {
		await expect(loadJsonInput({ input: join(dir, "nope.json") })).rejects.toThrow();
	});

	it("throws on invalid JSON", async () => {
		await expect(loadJsonInput({ input: join(dir, "bad.json") })).rejects.toThrow();
	});
});

describe("loadTextInput", () => {
	let dir: string;

	beforeAll(() => {
		dir = mkdtempSync(join(tmpdir(), "qualink-load-text-"));
		writeFileSync(join(dir, "data.txt"), "hello world\n");
	});

	afterAll(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it("loads a text file", async () => {
		const result = await loadTextInput({ input: join(dir, "data.txt") });
		expect(result).toBe("hello world\n");
	});

	it("throws on missing input arg", async () => {
		await expect(loadTextInput({})).rejects.toThrow("Missing required value: input");
	});
});
