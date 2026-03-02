import { describe, expect, it } from "vitest";
import { makeMetadata } from "../test-helpers.js";
import { collectEslint, detectEslintLanguages } from "./eslint.js";

const eslintFixture = [
	{
		filePath: "src/index.ts",
		errorCount: 1,
		warningCount: 2,
		fixableErrorCount: 1,
		fixableWarningCount: 1,
		messages: [
			{ ruleId: "no-console" },
			{ ruleId: "@typescript-eslint/no-unused-vars" },
			{ ruleId: "@typescript-eslint/no-unused-vars" },
		],
	},
];

const defaultOptions = {
	includeRules: true,
	topRules: 25,
	includeAllFiles: false,
	topFiles: 0,
};

describe("collectEslint", () => {
	it("aggregates errors and warnings", () => {
		const [doc] = collectEslint(eslintFixture, makeMetadata(), defaultOptions);
		expect(doc?.errors).toBe(1);
		expect(doc?.warnings).toBe(2);
		expect(doc?.fixable_errors).toBe(1);
		expect(doc?.fixable_warnings).toBe(1);
	});

	it("counts rules_violated", () => {
		const [doc] = collectEslint(eslintFixture, makeMetadata(), defaultOptions);
		expect(doc?.rules_violated).toEqual({
			"@typescript-eslint/no-unused-vars": 2,
			"no-console": 1,
		});
	});

	it("populates top_files when topFiles > 0", () => {
		const [doc] = collectEslint(eslintFixture, makeMetadata(), {
			...defaultOptions,
			topFiles: 5,
		});
		expect(doc?.top_files).toHaveLength(1);
		expect(doc?.top_files?.[0]?.path).toBe("src/index.ts");
	});

	it("returns empty aggregation for empty input", () => {
		const [doc] = collectEslint([], makeMetadata(), defaultOptions);
		expect(doc?.errors).toBe(0);
		expect(doc?.warnings).toBe(0);
	});

	it("throws on invalid input", () => {
		expect(() => collectEslint("not-array", makeMetadata(), defaultOptions)).toThrow(
			"ESLint input must be an array",
		);
	});

	it("auto-detects languages from file paths", () => {
		const [doc] = collectEslint(eslintFixture, makeMetadata(), defaultOptions);
		expect(doc?.languages).toContain("ts");
	});

	it("respects language override", () => {
		const [doc] = collectEslint(eslintFixture, makeMetadata(), {
			...defaultOptions,
			languages: ["js"],
		});
		expect(doc?.languages).toEqual(["js"]);
	});

	it("populates all_files when includeAllFiles is true", () => {
		const [doc] = collectEslint(eslintFixture, makeMetadata(), {
			...defaultOptions,
			includeAllFiles: true,
		});
		expect(doc?.all_files).toHaveLength(1);
		expect(doc?.all_files?.[0]?.path).toBe("src/index.ts");
	});

	it("sorts files by total desc, then errors desc, then path asc", () => {
		const fixture = [
			{
				filePath: "b.ts",
				errorCount: 2,
				warningCount: 1,
				fixableErrorCount: 0,
				fixableWarningCount: 0,
				messages: [],
			},
			{
				filePath: "a.ts",
				errorCount: 1,
				warningCount: 2,
				fixableErrorCount: 0,
				fixableWarningCount: 0,
				messages: [],
			},
			{
				filePath: "c.ts",
				errorCount: 1,
				warningCount: 2,
				fixableErrorCount: 0,
				fixableWarningCount: 0,
				messages: [],
			},
		];
		const [doc] = collectEslint(fixture, makeMetadata(), {
			...defaultOptions,
			includeAllFiles: true,
		});
		// All have total 3; b.ts has more errors so it's first; a.ts < c.ts alphabetically
		expect(doc?.all_files?.map((f) => f.path)).toEqual(["b.ts", "a.ts", "c.ts"]);
	});

	it("skips messages with null ruleId in rule counts", () => {
		const fixture = [
			{
				filePath: "x.ts",
				errorCount: 2,
				warningCount: 0,
				fixableErrorCount: 0,
				fixableWarningCount: 0,
				messages: [{ ruleId: null }, { ruleId: "some-rule" }],
			},
		];
		const [doc] = collectEslint(fixture, makeMetadata(), defaultOptions);
		expect(doc?.rules_violated).toEqual({ "some-rule": 1 });
	});

	it("throws on non-record entry in results array", () => {
		expect(() => collectEslint([42], makeMetadata(), defaultOptions)).toThrow(
			"Invalid ESLint result entry",
		);
	});

	it("throws on non-array messages", () => {
		const fixture = [{ filePath: "x.ts", errorCount: 0, warningCount: 0, messages: "bad" }];
		expect(() => collectEslint(fixture, makeMetadata(), defaultOptions)).toThrow(
			"Invalid ESLint messages array",
		);
	});
});

describe("detectEslintLanguages", () => {
	it("detects ts from .ts files", () => {
		const rows = [
			{
				filePath: "src/app.ts",
				errorCount: 0,
				warningCount: 0,
				fixableErrorCount: 0,
				fixableWarningCount: 0,
				messages: [],
			},
		];
		expect(detectEslintLanguages(rows)).toEqual(["ts"]);
	});

	it("detects js from .js files", () => {
		const rows = [
			{
				filePath: "lib/util.js",
				errorCount: 0,
				warningCount: 0,
				fixableErrorCount: 0,
				fixableWarningCount: 0,
				messages: [],
			},
		];
		expect(detectEslintLanguages(rows)).toEqual(["js"]);
	});

	it("detects both ts and js from mixed files", () => {
		const rows = [
			{
				filePath: "src/app.ts",
				errorCount: 0,
				warningCount: 0,
				fixableErrorCount: 0,
				fixableWarningCount: 0,
				messages: [],
			},
			{
				filePath: "lib/util.js",
				errorCount: 0,
				warningCount: 0,
				fixableErrorCount: 0,
				fixableWarningCount: 0,
				messages: [],
			},
		];
		const langs = detectEslintLanguages(rows);
		expect(langs).toContain("ts");
		expect(langs).toContain("js");
	});

	it("detects ts from @typescript-eslint rule IDs", () => {
		const rows = [
			{
				filePath: "unknown",
				errorCount: 0,
				warningCount: 0,
				fixableErrorCount: 0,
				fixableWarningCount: 0,
				messages: [{ ruleId: "@typescript-eslint/no-any" }],
			},
		];
		expect(detectEslintLanguages(rows)).toEqual(["ts"]);
	});

	it("defaults to js when no signals found", () => {
		const rows = [
			{
				filePath: "unknown",
				errorCount: 0,
				warningCount: 0,
				fixableErrorCount: 0,
				fixableWarningCount: 0,
				messages: [],
			},
		];
		expect(detectEslintLanguages(rows)).toEqual(["js"]);
	});
});
