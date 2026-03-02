import { describe, expect, it } from "vitest";
import { ratioPct, toPctFromUnitScore } from "./metrics.js";

describe("ratioPct", () => {
	it("returns 0 when total is 0", () => {
		expect(ratioPct(0, 0)).toBe(0);
	});

	it("returns 0 when total is negative", () => {
		expect(ratioPct(5, -1)).toBe(0);
	});

	it("calculates percentage correctly", () => {
		expect(ratioPct(91, 100)).toBe(91);
		expect(ratioPct(1, 3)).toBe(33.33);
	});

	it("rounds to 2 decimal places", () => {
		expect(ratioPct(2, 3)).toBe(66.67);
	});
});

describe("toPctFromUnitScore", () => {
	it("returns 0 for undefined", () => {
		expect(toPctFromUnitScore(undefined)).toBe(0);
	});

	it("returns 0 for NaN", () => {
		expect(toPctFromUnitScore(NaN)).toBe(0);
	});

	it("converts unit score to percentage", () => {
		expect(toPctFromUnitScore(0.91)).toBe(91);
		expect(toPctFromUnitScore(0.95)).toBe(95);
		expect(toPctFromUnitScore(1)).toBe(100);
		expect(toPctFromUnitScore(0)).toBe(0);
	});

	it("rounds to 2 decimal places", () => {
		expect(toPctFromUnitScore(0.333)).toBe(33.3);
	});
});
