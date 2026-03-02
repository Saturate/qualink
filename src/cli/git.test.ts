import { describe, expect, it } from "vitest";
import { runGit } from "./git.js";

describe("runGit", () => {
	it("returns trimmed output for a valid command", () => {
		const result = runGit(["--version"]);
		expect(result).toMatch(/^git version/);
	});

	it("returns undefined on failure", () => {
		expect(
			runGit(["rev-parse", "--verify", "refs/heads/nonexistent-branch-abc123"]),
		).toBeUndefined();
	});

	it("returns undefined for empty output", () => {
		// `git tag -l` with a pattern that doesn't match produces empty output
		expect(runGit(["tag", "-l", "nonexistent-tag-pattern-abc123"])).toBeUndefined();
	});
});
