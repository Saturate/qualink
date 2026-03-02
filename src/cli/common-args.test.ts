import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { argValue, envOrArg, isDryRun } from "./common-args.js";

describe("argValue", () => {
	it("returns primary key value", () => {
		expect(argValue({ repo: "foo" }, "repo")).toBe("foo");
	});

	it("returns undefined when key missing and no altKey", () => {
		expect(argValue({}, "repo")).toBeUndefined();
	});

	it("falls back to altKey when primary is undefined", () => {
		expect(argValue({ "dry-run": true }, "dryRun", "dry-run")).toBe(true);
	});

	it("prefers primary over altKey", () => {
		expect(argValue({ dryRun: false, "dry-run": true }, "dryRun", "dry-run")).toBe(false);
	});
});

describe("envOrArg", () => {
	let saved: NodeJS.ProcessEnv;

	beforeEach(() => {
		saved = { ...process.env };
	});

	afterEach(() => {
		process.env = saved;
	});

	it("returns arg value when present", () => {
		expect(envOrArg("from-arg", "SOME_KEY")).toBe("from-arg");
	});

	it("returns env value when arg is undefined", () => {
		process.env.SOME_KEY = "from-env";
		expect(envOrArg(undefined, "SOME_KEY")).toBe("from-env");
	});

	it("ignores whitespace-only arg", () => {
		process.env.SOME_KEY = "from-env";
		expect(envOrArg("   ", "SOME_KEY")).toBe("from-env");
	});

	it("ignores whitespace-only env", () => {
		process.env.SOME_KEY = "   ";
		expect(envOrArg(undefined, "SOME_KEY")).toBeUndefined();
	});

	it("returns undefined when neither arg nor env set", () => {
		delete process.env.SOME_KEY;
		expect(envOrArg(undefined, "SOME_KEY")).toBeUndefined();
	});

	it("ignores non-string arg values", () => {
		expect(envOrArg(42, "SOME_KEY")).toBeUndefined();
	});
});

describe("isDryRun", () => {
	it("true when dryRun is true", () => {
		expect(isDryRun({ dryRun: true })).toBe(true);
	});

	it("true when dry-run is true", () => {
		expect(isDryRun({ "dry-run": true })).toBe(true);
	});

	it("false when neither set", () => {
		expect(isDryRun({})).toBe(false);
	});

	it("false when dryRun is false", () => {
		expect(isDryRun({ dryRun: false })).toBe(false);
	});
});
