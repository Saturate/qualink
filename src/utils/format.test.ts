import { describe, expect, it } from "vitest";
import { formatBytes } from "./format.js";

describe("formatBytes", () => {
	it("formats zero bytes", () => {
		expect(formatBytes(0)).toBe("0 B");
	});

	it("formats small byte values", () => {
		expect(formatBytes(142)).toBe("142 B");
		expect(formatBytes(999)).toBe("999 B");
	});

	it("formats kilobytes", () => {
		expect(formatBytes(1000)).toBe("1 kB");
		expect(formatBytes(14200)).toBe("14.2 kB");
		expect(formatBytes(1500)).toBe("1.5 kB");
	});

	it("formats megabytes", () => {
		expect(formatBytes(1_300_000)).toBe("1.3 MB");
		expect(formatBytes(5_000_000)).toBe("5 MB");
	});

	it("formats gigabytes", () => {
		expect(formatBytes(2_500_000_000)).toBe("2.5 GB");
	});

	it("caps at GB for very large values", () => {
		expect(formatBytes(1_500_000_000_000)).toBe("1500 GB");
	});
});
