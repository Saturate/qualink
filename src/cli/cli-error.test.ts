import { describe, expect, it } from "vitest";
import { CliError } from "./cli-error.js";

describe("CliError", () => {
	it("extends Error", () => {
		const err = new CliError("boom", 2);
		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(CliError);
	});

	it("stores message and exitCode", () => {
		const err = new CliError("something broke", 42);
		expect(err.message).toBe("something broke");
		expect(err.exitCode).toBe(42);
	});
});
