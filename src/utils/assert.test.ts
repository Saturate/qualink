import { describe, expect, it } from "vitest";
import { asOptionalString, assertNonEmpty } from "./assert.js";

describe("assertNonEmpty", () => {
	it("returns the string when valid", () => {
		expect(assertNonEmpty("hello", "test")).toBe("hello");
	});

	it("throws on empty string", () => {
		expect(() => assertNonEmpty("", "test")).toThrow("Missing required value: test");
	});

	it("throws on whitespace-only string", () => {
		expect(() => assertNonEmpty("  ", "test")).toThrow("Missing required value: test");
	});

	it("throws on undefined", () => {
		expect(() => assertNonEmpty(undefined, "test")).toThrow("Missing required value: test");
	});

	it("throws on non-string values", () => {
		expect(() => assertNonEmpty(42, "test")).toThrow("Missing required value: test");
		expect(() => assertNonEmpty(null, "test")).toThrow("Missing required value: test");
	});
});

describe("asOptionalString", () => {
	it("returns the string when valid", () => {
		expect(asOptionalString("hello")).toBe("hello");
	});

	it("returns null for empty string", () => {
		expect(asOptionalString("")).toBe(null);
	});

	it("returns null for whitespace-only string", () => {
		expect(asOptionalString("  ")).toBe(null);
	});

	it("returns null for non-string values", () => {
		expect(asOptionalString(null)).toBe(null);
		expect(asOptionalString(undefined)).toBe(null);
		expect(asOptionalString(42)).toBe(null);
	});
});
