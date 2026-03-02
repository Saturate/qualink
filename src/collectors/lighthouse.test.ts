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
});
