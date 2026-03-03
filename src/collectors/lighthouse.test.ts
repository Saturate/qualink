import { describe, expect, it } from "vitest";
import { makeMetadata } from "../test-helpers.js";
import { collectLighthouse } from "./lighthouse.js";

const lighthouseFixture = {
	categories: {
		performance: { score: 0.91 },
		accessibility: { score: 0.95 },
		"best-practices": { score: 0.98 },
		seo: { score: 0.9 },
	},
};

const filmstripItems = [
	{ timing: 300, timestamp: 1234567890, data: "data:image/jpeg;base64,abc123" },
	{ timing: 600, timestamp: 1234567891, data: "data:image/jpeg;base64,def456" },
];

const fixtureWithFilmstrip = {
	categories: {
		performance: { score: 0.91 },
		accessibility: { score: 0.95 },
		"best-practices": { score: 0.98 },
		seo: { score: 0.9 },
	},
	audits: {
		"first-contentful-paint": { score: 0.8, numericValue: 1234.5 },
		"screenshot-thumbnails": {
			score: null,
			details: {
				type: "filmstrip",
				items: filmstripItems,
			},
		},
	},
};

const fixtureWithAudits = {
	categories: {
		performance: { score: 0.91 },
		accessibility: { score: 0.95 },
		"best-practices": { score: 0.98 },
		seo: { score: 0.9 },
	},
	audits: {
		"first-contentful-paint": { score: 0.8, numericValue: 1234.5 },
		"largest-contentful-paint": { score: 0.6, numericValue: 2500 },
		"total-blocking-time": { score: 0.95, numericValue: 50 },
		"cumulative-layout-shift": { score: 0.99, numericValue: 0.003 },
		"speed-index": { score: 0.85, numericValue: 1800 },
		interactive: { score: 0.7, numericValue: 3200 },
		"server-response-time": { score: 0.9, numericValue: 120 },
		"total-byte-weight": { score: 0.5, numericValue: 1500000 },
		"dom-size": { score: 0.75, numericValue: 800 },
		"score-only-audit": { score: 1.0 },
		"value-only-audit": { numericValue: 42 },
		"no-data-audit": { title: "Some audit" },
		"null-score-audit": { score: null, numericValue: 100 },
	},
};

describe("collectLighthouse", () => {
	it("converts unit scores to percentages", () => {
		const [doc] = collectLighthouse(lighthouseFixture, makeMetadata(), "https://example.com");
		expect(doc?.performance).toBe(91);
		expect(doc?.accessibility).toBe(95);
		expect(doc?.best_practices).toBe(98);
		expect(doc?.seo).toBe(90);
	});

	it("sets url on the document", () => {
		const [doc] = collectLighthouse(lighthouseFixture, makeMetadata(), "https://example.com");
		expect(doc?.url).toBe("https://example.com");
	});

	it("returns 0 for missing categories", () => {
		const partial = { categories: { performance: { score: 0.5 } } };
		const [doc] = collectLighthouse(partial, makeMetadata(), "https://x.com");
		expect(doc?.performance).toBe(50);
		expect(doc?.accessibility).toBe(0);
		expect(doc?.seo).toBe(0);
	});

	it("always sets languages to ['js']", () => {
		const [doc] = collectLighthouse(lighthouseFixture, makeMetadata(), "https://example.com");
		expect(doc?.languages).toEqual(["js"]);
	});

	it("throws on invalid input", () => {
		expect(() => collectLighthouse("bad", makeMetadata(), "https://x.com")).toThrow(
			"Lighthouse input must be an object",
		);
	});

	it("throws when categories is missing", () => {
		expect(() => collectLighthouse({}, makeMetadata(), "https://x.com")).toThrow(
			"Lighthouse report missing categories",
		);
	});

	it("returns 0 when score is not a number", () => {
		const input = { categories: { performance: { score: "bad" }, seo: {} } };
		const [doc] = collectLighthouse(input, makeMetadata(), "https://x.com");
		expect(doc?.performance).toBe(0);
		expect(doc?.seo).toBe(0);
	});

	it("extracts flat web vital fields from audits", () => {
		const [doc] = collectLighthouse(fixtureWithAudits, makeMetadata(), "https://example.com");
		expect(doc?.fcp).toBe(1234.5);
		expect(doc?.lcp).toBe(2500);
		expect(doc?.tbt).toBe(50);
		expect(doc?.cls).toBe(0.003);
		expect(doc?.si).toBe(1800);
		expect(doc?.tti).toBe(3200);
		expect(doc?.ttfb).toBe(120);
		expect(doc?.total_byte_weight).toBe(1500000);
		expect(doc?.dom_size).toBe(800);
	});

	it("omits web vital fields when audits are missing", () => {
		const [doc] = collectLighthouse(lighthouseFixture, makeMetadata(), "https://example.com");
		expect(doc?.fcp).toBeUndefined();
		expect(doc?.lcp).toBeUndefined();
		expect(doc?.tbt).toBeUndefined();
		expect(doc?.cls).toBeUndefined();
		expect(doc?.audit_scores).toBeUndefined();
		expect(doc?.audit_values).toBeUndefined();
	});

	it("builds audit_scores map from all audits with numeric scores", () => {
		const [doc] = collectLighthouse(fixtureWithAudits, makeMetadata(), "https://example.com");
		expect(doc?.audit_scores).toBeDefined();
		expect(doc?.audit_scores?.["first-contentful-paint"]).toBe(80);
		expect(doc?.audit_scores?.["score-only-audit"]).toBe(100);
		// null score should be excluded
		expect(doc?.audit_scores?.["null-score-audit"]).toBeUndefined();
		// audit without score should be excluded
		expect(doc?.audit_scores?.["value-only-audit"]).toBeUndefined();
		expect(doc?.audit_scores?.["no-data-audit"]).toBeUndefined();
	});

	it("builds audit_values map from all audits with numericValue", () => {
		const [doc] = collectLighthouse(fixtureWithAudits, makeMetadata(), "https://example.com");
		expect(doc?.audit_values).toBeDefined();
		expect(doc?.audit_values?.["first-contentful-paint"]).toBe(1234.5);
		expect(doc?.audit_values?.["value-only-audit"]).toBe(42);
		// null-score audit still has a valid numericValue
		expect(doc?.audit_values?.["null-score-audit"]).toBe(100);
		// audit without numericValue should be excluded
		expect(doc?.audit_values?.["score-only-audit"]).toBeUndefined();
		expect(doc?.audit_values?.["no-data-audit"]).toBeUndefined();
	});

	it("handles audits with non-record entries gracefully", () => {
		const input = {
			categories: { performance: { score: 0.5 } },
			audits: {
				"valid-audit": { score: 0.9, numericValue: 100 },
				"bad-entry": "not an object",
				"another-bad": null,
			},
		};
		const [doc] = collectLighthouse(input, makeMetadata(), "https://x.com");
		expect(doc?.audit_scores).toEqual({ "valid-audit": 90 });
		expect(doc?.audit_values).toEqual({ "valid-audit": 100 });
	});

	it("omits audit maps when no audits have scores or values", () => {
		const input = {
			categories: { performance: { score: 0.5 } },
			audits: {
				"empty-audit": { title: "nothing useful" },
			},
		};
		const [doc] = collectLighthouse(input, makeMetadata(), "https://x.com");
		expect(doc?.audit_scores).toBeUndefined();
		expect(doc?.audit_values).toBeUndefined();
	});

	it("handles NaN and Infinity in numericValue", () => {
		const input = {
			categories: { performance: { score: 0.5 } },
			audits: {
				"nan-audit": { score: 0.5, numericValue: Number.NaN },
				"inf-audit": { score: 0.5, numericValue: Number.POSITIVE_INFINITY },
				"neg-inf-audit": { score: 0.5, numericValue: Number.NEGATIVE_INFINITY },
			},
		};
		const [doc] = collectLighthouse(input, makeMetadata(), "https://x.com");
		expect(doc?.audit_values).toBeUndefined();
		// scores are still valid
		expect(doc?.audit_scores?.["nan-audit"]).toBe(50);
	});

	it("extracts filmstrip when includeFilmstrip is true", () => {
		const [doc] = collectLighthouse(fixtureWithFilmstrip, makeMetadata(), "https://example.com", {
			includeFilmstrip: true,
		});
		expect(doc?.filmstrip).toEqual([
			{ timing: 300, data: "data:image/jpeg;base64,abc123" },
			{ timing: 600, data: "data:image/jpeg;base64,def456" },
		]);
	});

	it("omits filmstrip when includeFilmstrip is false", () => {
		const [doc] = collectLighthouse(fixtureWithFilmstrip, makeMetadata(), "https://example.com", {
			includeFilmstrip: false,
		});
		expect(doc?.filmstrip).toBeUndefined();
	});

	it("omits filmstrip when options are not provided", () => {
		const [doc] = collectLighthouse(fixtureWithFilmstrip, makeMetadata(), "https://example.com");
		expect(doc?.filmstrip).toBeUndefined();
	});

	it("omits filmstrip when screenshot-thumbnails audit is missing", () => {
		const [doc] = collectLighthouse(fixtureWithAudits, makeMetadata(), "https://example.com", {
			includeFilmstrip: true,
		});
		expect(doc?.filmstrip).toBeUndefined();
	});

	it("omits filmstrip when details type is not filmstrip", () => {
		const input = {
			categories: { performance: { score: 0.5 } },
			audits: {
				"screenshot-thumbnails": {
					score: null,
					details: { type: "table", items: filmstripItems },
				},
			},
		};
		const [doc] = collectLighthouse(input, makeMetadata(), "https://x.com", {
			includeFilmstrip: true,
		});
		expect(doc?.filmstrip).toBeUndefined();
	});

	it("omits filmstrip when details.items is not an array", () => {
		const input = {
			categories: { performance: { score: 0.5 } },
			audits: {
				"screenshot-thumbnails": {
					score: null,
					details: { type: "filmstrip", items: "not-an-array" },
				},
			},
		};
		const [doc] = collectLighthouse(input, makeMetadata(), "https://x.com", {
			includeFilmstrip: true,
		});
		expect(doc?.filmstrip).toBeUndefined();
	});

	it("skips filmstrip items with bad timing or data", () => {
		const input = {
			categories: { performance: { score: 0.5 } },
			audits: {
				"screenshot-thumbnails": {
					score: null,
					details: {
						type: "filmstrip",
						items: [
							{ timing: 300, data: "data:image/jpeg;base64,good" },
							{ timing: "bad", data: "data:image/jpeg;base64,x" },
							{ timing: 600, data: 123 },
							{ timing: Number.NaN, data: "data:image/jpeg;base64,y" },
							"not-an-object",
							{ timing: 900, data: "data:image/jpeg;base64,also-good" },
						],
					},
				},
			},
		};
		const [doc] = collectLighthouse(input, makeMetadata(), "https://x.com", {
			includeFilmstrip: true,
		});
		expect(doc?.filmstrip).toEqual([
			{ timing: 300, data: "data:image/jpeg;base64,good" },
			{ timing: 900, data: "data:image/jpeg;base64,also-good" },
		]);
	});
});
