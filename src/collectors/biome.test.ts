import { describe, expect, it } from "vitest";
import { makeMetadata } from "../test-helpers.js";
import { collectBiome, detectBiomeLanguages } from "./biome.js";

const biomeFixture = {
	diagnostics: [
		{
			code: { value: "lint/correctness/noUnusedImports" },
			location: { path: "src/index.ts" },
			severity: "error",
			fixable: true,
		},
		{
			code: { value: "lint/style/useConst" },
			location: { path: "src/index.ts" },
			severity: "warning",
			fixable: true,
		},
		{
			code: { value: "lint/suspicious/noExplicitAny" },
			location: { path: "src/components/App.tsx" },
			severity: "error",
			fixable: false,
		},
		{
			code: { value: "lint/correctness/noUnusedImports" },
			location: { path: "src/utils/helpers.js" },
			severity: "fatal",
			fixable: true,
		},
		{
			code: { value: "lint/complexity/noForEach" },
			location: { path: "src/utils/helpers.js" },
			severity: "warning",
			fixable: false,
		},
		{
			code: { value: "lint/style/useConst" },
			location: { path: "src/data/config.json" },
			severity: "info",
			fixable: true,
		},
	],
};

const defaultOptions = {
	includeRules: true,
	topRules: 25,
	includeAllFiles: false,
	topFiles: 0,
};

describe("collectBiome", () => {
	it("aggregates errors and warnings correctly", () => {
		const [doc] = collectBiome(biomeFixture, makeMetadata(), defaultOptions);
		// error + error + fatal = 3 errors, warning + warning = 2 warnings, info ignored
		expect(doc?.errors).toBe(3);
		expect(doc?.warnings).toBe(2);
	});

	it("counts fixable separately", () => {
		const [doc] = collectBiome(biomeFixture, makeMetadata(), defaultOptions);
		// fixable errors: noUnusedImports(error) + noUnusedImports(fatal) = 2
		expect(doc?.fixable_errors).toBe(2);
		// fixable warnings: useConst(warning) = 1
		expect(doc?.fixable_warnings).toBe(1);
	});

	it("tracks rules_violated from code.value", () => {
		const [doc] = collectBiome(biomeFixture, makeMetadata(), defaultOptions);
		expect(doc?.rules_violated).toEqual({
			"lint/correctness/noUnusedImports": 2,
			"lint/style/useConst": 2,
			"lint/suspicious/noExplicitAny": 1,
			"lint/complexity/noForEach": 1,
		});
	});

	it("sorts rules_violated by count descending", () => {
		const [doc] = collectBiome(biomeFixture, makeMetadata(), defaultOptions);
		const counts = Object.values(doc?.rules_violated ?? {});
		for (let i = 1; i < counts.length; i++) {
			expect(counts[i]).toBeLessThanOrEqual(counts[i - 1] ?? 0);
		}
	});

	it("populates top_files when enabled", () => {
		const [doc] = collectBiome(biomeFixture, makeMetadata(), {
			...defaultOptions,
			topFiles: 5,
		});
		expect(doc?.top_files).toBeDefined();
		expect(doc?.top_files?.length).toBeGreaterThan(0);
		// Both src/index.ts and src/utils/helpers.js have 2 total (1 err + 1 warn),
		// tiebreak is alphabetical path → src/index.ts first
		const first = doc?.top_files?.[0];
		expect(first?.path).toBe("src/index.ts");
		expect(first?.errors).toBe(1);
		expect(first?.warnings).toBe(1);
	});

	it("populates all_files when enabled", () => {
		const [doc] = collectBiome(biomeFixture, makeMetadata(), {
			...defaultOptions,
			includeAllFiles: true,
		});
		expect(doc?.all_files).toBeDefined();
		// 3 files with errors/warnings (info-only file excluded)
		expect(doc?.all_files).toHaveLength(3);
	});

	it("auto-detects languages from file paths", () => {
		const [doc] = collectBiome(biomeFixture, makeMetadata(), defaultOptions);
		expect(doc?.languages).toContain("ts");
		expect(doc?.languages).toContain("js");
		expect(doc?.languages).toContain("json");
	});

	it("respects language override", () => {
		const [doc] = collectBiome(biomeFixture, makeMetadata(), {
			...defaultOptions,
			languages: ["js", "ts"],
		});
		expect(doc?.languages).toEqual(["js", "ts"]);
	});

	it("handles empty diagnostics array", () => {
		const [doc] = collectBiome({ diagnostics: [] }, makeMetadata(), defaultOptions);
		expect(doc?.errors).toBe(0);
		expect(doc?.warnings).toBe(0);
		expect(doc?.fixable_errors).toBe(0);
		expect(doc?.fixable_warnings).toBe(0);
	});

	it("throws on invalid input (not object)", () => {
		expect(() => collectBiome("not-object", makeMetadata(), defaultOptions)).toThrow(
			"Biome input must be an object with a diagnostics array",
		);
	});

	it("throws on missing diagnostics array", () => {
		expect(() => collectBiome({}, makeMetadata(), defaultOptions)).toThrow(
			"Biome input must be an object with a diagnostics array",
		);
	});

	it("sets metric_type to biome", () => {
		const [doc] = collectBiome(biomeFixture, makeMetadata(), defaultOptions);
		expect(doc?.metric_type).toBe("biome");
	});

	it("limits top_files to requested count", () => {
		const [doc] = collectBiome(biomeFixture, makeMetadata(), {
			...defaultOptions,
			topFiles: 1,
		});
		expect(doc?.top_files).toHaveLength(1);
	});

	it("limits rules_violated to topRules count", () => {
		const [doc] = collectBiome(biomeFixture, makeMetadata(), {
			...defaultOptions,
			topRules: 2,
		});
		expect(Object.keys(doc?.rules_violated ?? {})).toHaveLength(2);
	});

	it("omits rules_violated when includeRules is false", () => {
		const [doc] = collectBiome(biomeFixture, makeMetadata(), {
			...defaultOptions,
			includeRules: false,
		});
		expect(doc?.rules_violated).toBeUndefined();
	});

	it("throws on non-record diagnostic entry", () => {
		expect(() => collectBiome({ diagnostics: [42] }, makeMetadata(), defaultOptions)).toThrow(
			"Invalid Biome diagnostic entry",
		);
	});
});

describe("detectBiomeLanguages", () => {
	it("detects ts from .ts files", () => {
		const diags = [
			{ code: null, location: { path: "src/app.ts" }, severity: "error", fixable: false },
		];
		expect(detectBiomeLanguages(diags)).toEqual(["ts"]);
	});

	it("detects ts from .tsx files", () => {
		const diags = [
			{ code: null, location: { path: "src/App.tsx" }, severity: "error", fixable: false },
		];
		expect(detectBiomeLanguages(diags)).toEqual(["ts"]);
	});

	it("detects js from .js files", () => {
		const diags = [
			{ code: null, location: { path: "lib/util.js" }, severity: "error", fixable: false },
		];
		expect(detectBiomeLanguages(diags)).toEqual(["js"]);
	});

	it("detects css from .css files", () => {
		const diags = [
			{ code: null, location: { path: "styles/main.css" }, severity: "error", fixable: false },
		];
		expect(detectBiomeLanguages(diags)).toEqual(["css"]);
	});

	it("detects json from .json files", () => {
		const diags = [
			{ code: null, location: { path: "config.json" }, severity: "error", fixable: false },
		];
		expect(detectBiomeLanguages(diags)).toEqual(["json"]);
	});

	it("detects multiple languages from mixed files", () => {
		const diags = [
			{ code: null, location: { path: "src/app.ts" }, severity: "error", fixable: false },
			{ code: null, location: { path: "lib/util.js" }, severity: "error", fixable: false },
		];
		const langs = detectBiomeLanguages(diags);
		expect(langs).toContain("ts");
		expect(langs).toContain("js");
	});

	it("defaults to js when no signals found", () => {
		const diags = [
			{ code: null, location: { path: "unknown" }, severity: "error", fixable: false },
		];
		expect(detectBiomeLanguages(diags)).toEqual(["js"]);
	});
});
