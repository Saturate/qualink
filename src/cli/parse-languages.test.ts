import { describe, expect, it } from "vitest";
import { parseLanguages } from "./parse-languages.js";

describe("parseLanguages", () => {
	it("parses comma-separated string", () => {
		expect(parseLanguages("js,ts")).toEqual(["js", "ts"]);
	});

	it("trims whitespace around entries", () => {
		expect(parseLanguages("  js , ts  ")).toEqual(["js", "ts"]);
	});

	it("filters empty entries", () => {
		expect(parseLanguages("js,,ts,")).toEqual(["js", "ts"]);
	});

	it("returns undefined for empty string", () => {
		expect(parseLanguages("")).toBeUndefined();
	});

	it("returns undefined for whitespace-only string", () => {
		expect(parseLanguages("   ")).toBeUndefined();
	});

	it("returns undefined for non-string values", () => {
		expect(parseLanguages(undefined)).toBeUndefined();
		expect(parseLanguages(42)).toBeUndefined();
		expect(parseLanguages(null)).toBeUndefined();
	});

	it("handles single language", () => {
		expect(parseLanguages("csharp")).toEqual(["csharp"]);
	});
});
