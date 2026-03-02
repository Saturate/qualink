import { describe, expect, it } from "vitest";
import { makeMetadata } from "../test-helpers.js";
import { collectSarif, detectLanguagesFromTool } from "./sarif.js";

const sarifFixture = {
	runs: [
		{
			tool: { driver: { name: "Roslyn", version: "4.10.0" } },
			results: [
				{ level: "warning", ruleId: "CS0168" },
				{ level: "error", ruleId: "CS8602" },
				{ level: "warning", ruleId: "CS0168" },
			],
		},
	],
};

const defaultOptions = { includeRules: true, topRules: 25 };

describe("collectSarif", () => {
	it("counts errors, warnings, and notes", () => {
		const [doc] = collectSarif(sarifFixture, makeMetadata(), defaultOptions);
		expect(doc?.errors).toBe(1);
		expect(doc?.warnings).toBe(2);
		expect(doc?.notes).toBe(0);
	});

	it("extracts tool name and version", () => {
		const [doc] = collectSarif(sarifFixture, makeMetadata(), defaultOptions);
		expect(doc?.tool_name).toBe("Roslyn");
		expect(doc?.tool_version).toBe("4.10.0");
	});

	it("counts rules_violated", () => {
		const [doc] = collectSarif(sarifFixture, makeMetadata(), defaultOptions);
		expect(doc?.rules_violated).toEqual({
			CS0168: 2,
			CS8602: 1,
		});
	});

	it("auto-detects csharp for Roslyn", () => {
		const [doc] = collectSarif(sarifFixture, makeMetadata(), defaultOptions);
		expect(doc?.languages).toEqual(["csharp"]);
	});

	it("respects language override", () => {
		const [doc] = collectSarif(sarifFixture, makeMetadata(), {
			...defaultOptions,
			languages: ["python"],
		});
		expect(doc?.languages).toEqual(["python"]);
	});

	it("throws on empty runs", () => {
		expect(() => collectSarif({ runs: [] }, makeMetadata(), defaultOptions)).toThrow(
			"SARIF input missing runs",
		);
	});

	it("throws on invalid input", () => {
		expect(() => collectSarif("bad", makeMetadata(), defaultOptions)).toThrow(
			"SARIF input must be an object",
		);
	});

	it("counts note-level results", () => {
		const input = {
			runs: [{ tool: { driver: { name: "test" } }, results: [{ level: "note" }] }],
		};
		const [doc] = collectSarif(input, makeMetadata(), defaultOptions);
		expect(doc?.notes).toBe(1);
		expect(doc?.errors).toBe(0);
		expect(doc?.warnings).toBe(0);
	});

	it("defaults missing level to note", () => {
		const input = {
			runs: [{ tool: { driver: { name: "test" } }, results: [{ ruleId: "R1" }] }],
		};
		const [doc] = collectSarif(input, makeMetadata(), defaultOptions);
		expect(doc?.notes).toBe(1);
	});

	it("skips non-record runs", () => {
		const input = { runs: [null, sarifFixture.runs[0]] };
		const [doc] = collectSarif(input, makeMetadata(), defaultOptions);
		expect(doc?.errors).toBe(1);
	});

	it("skips runs with non-array results", () => {
		const input = {
			runs: [{ tool: { driver: { name: "test" } }, results: "bad" }],
		};
		const [doc] = collectSarif(input, makeMetadata(), defaultOptions);
		expect(doc?.errors).toBe(0);
	});

	it("skips non-record results", () => {
		const input = {
			runs: [{ tool: { driver: { name: "test" } }, results: [null, { level: "error" }] }],
		};
		const [doc] = collectSarif(input, makeMetadata(), defaultOptions);
		expect(doc?.errors).toBe(1);
	});

	it("omits rules_violated when includeRules is false", () => {
		const [doc] = collectSarif(sarifFixture, makeMetadata(), {
			includeRules: false,
			topRules: 0,
		});
		expect(doc?.rules_violated).toBeUndefined();
	});
});

describe("detectLanguagesFromTool", () => {
	it("detects csharp for Roslyn", () => {
		expect(detectLanguagesFromTool("Roslyn")).toEqual(["csharp"]);
	});

	it("detects csharp for Microsoft.CodeAnalysis", () => {
		expect(detectLanguagesFromTool("Microsoft.CodeAnalysis.CSharp")).toEqual(["csharp"]);
	});

	it("detects ts for ESLint", () => {
		expect(detectLanguagesFromTool("ESLint")).toEqual(["ts"]);
	});

	it("returns unknown for unrecognized tools", () => {
		expect(detectLanguagesFromTool("some-random-tool")).toEqual(["unknown"]);
	});
});
