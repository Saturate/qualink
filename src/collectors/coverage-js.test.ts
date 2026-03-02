import { describe, expect, it } from "vitest";
import { makeMetadata } from "../test-helpers.js";
import { collectCoverageJs, detectCoverageLanguages } from "./coverage-js.js";

const summaryFixture = {
	total: {
		lines: { total: 100, covered: 91, pct: 91 },
		branches: { total: 40, covered: 34, pct: 85 },
		functions: { total: 20, covered: 18, pct: 90 },
	},
};

describe("collectCoverageJs", () => {
	it("parses summary format correctly", () => {
		const [doc] = collectCoverageJs(summaryFixture, makeMetadata());
		expect(doc?.lines_total).toBe(100);
		expect(doc?.lines_covered).toBe(91);
		expect(doc?.lines_pct).toBe(91);
		expect(doc?.branches_total).toBe(40);
		expect(doc?.branches_covered).toBe(34);
		expect(doc?.branches_pct).toBe(85);
		expect(doc?.functions_total).toBe(20);
		expect(doc?.functions_covered).toBe(18);
		expect(doc?.functions_pct).toBe(90);
	});

	it("parses coverage-final format", () => {
		const finalFixture = {
			"src/index.ts": {
				s: { "0": 1, "1": 0, "2": 1 },
				b: { "0": [1, 0] },
				f: { "0": 1, "1": 0 },
			},
		};
		const [doc] = collectCoverageJs(finalFixture, makeMetadata());
		expect(doc?.lines_total).toBe(3);
		expect(doc?.lines_covered).toBe(2);
		expect(doc?.branches_total).toBe(2);
		expect(doc?.branches_covered).toBe(1);
		expect(doc?.functions_total).toBe(2);
		expect(doc?.functions_covered).toBe(1);
	});

	it("defaults tool to istanbul", () => {
		const [doc] = collectCoverageJs(summaryFixture, makeMetadata());
		expect(doc?.tool).toBe("istanbul");
	});

	it("respects tool override", () => {
		const [doc] = collectCoverageJs(summaryFixture, makeMetadata(), { tool: "c8" });
		expect(doc?.tool).toBe("c8");
	});

	it("auto-detects languages from file keys", () => {
		const finalFixture = {
			"src/app.ts": { s: {}, b: {}, f: {} },
			"lib/util.js": { s: {}, b: {}, f: {} },
		};
		const [doc] = collectCoverageJs(finalFixture, makeMetadata());
		expect(doc?.languages).toContain("ts");
		expect(doc?.languages).toContain("js");
	});

	it("defaults to js when summary format has no file keys", () => {
		const [doc] = collectCoverageJs(summaryFixture, makeMetadata());
		expect(doc?.languages).toEqual(["js"]);
	});

	it("respects language override", () => {
		const [doc] = collectCoverageJs(summaryFixture, makeMetadata(), {
			languages: ["ts"],
		});
		expect(doc?.languages).toEqual(["ts"]);
	});

	it("throws on invalid input", () => {
		expect(() => collectCoverageJs("bad", makeMetadata())).toThrow(
			"Coverage JSON input must be an object",
		);
	});

	it("handles summary with missing metric keys", () => {
		const input = { total: { lines: { total: 10, covered: 5 } } };
		const [doc] = collectCoverageJs(input, makeMetadata());
		expect(doc?.lines_total).toBe(10);
		expect(doc?.branches_total).toBe(0);
		expect(doc?.functions_total).toBe(0);
	});

	it("skips non-record entries in coverage-final format", () => {
		const input = {
			"src/a.ts": { s: { "0": 1 }, b: {}, f: {} },
			badEntry: "not an object",
		};
		const [doc] = collectCoverageJs(input, makeMetadata());
		expect(doc?.lines_total).toBe(1);
	});
});

describe("detectCoverageLanguages", () => {
	it("detects ts from .ts keys", () => {
		expect(detectCoverageLanguages(["src/app.ts"])).toEqual(["ts"]);
	});

	it("detects js from .js keys", () => {
		expect(detectCoverageLanguages(["lib/util.js"])).toEqual(["js"]);
	});

	it("defaults to js for unrecognized extensions", () => {
		expect(detectCoverageLanguages(["total"])).toEqual(["js"]);
	});
});
