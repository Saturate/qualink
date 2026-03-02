import { describe, expect, it } from "vitest";
import { parseRepoFromRemote } from "./detect-repo.js";

describe("parseRepoFromRemote", () => {
	it("extracts name from HTTPS .git URL", () => {
		expect(parseRepoFromRemote("https://github.com/myorg/my-app.git")).toBe("my-app");
	});

	it("extracts name from HTTPS URL without .git", () => {
		expect(parseRepoFromRemote("https://github.com/myorg/my-app")).toBe("my-app");
	});

	it("extracts name from SSH URL", () => {
		expect(parseRepoFromRemote("git@github.com:myorg/my-app.git")).toBe("my-app");
	});

	it("extracts name from Azure DevOps URL", () => {
		expect(parseRepoFromRemote("https://dev.azure.com/org/project/_git/MyRepo")).toBe("MyRepo");
	});

	it("extracts name from Azure DevOps SSH URL", () => {
		expect(parseRepoFromRemote("git@ssh.dev.azure.com:v3/org/project/MyRepo")).toBe("MyRepo");
	});

	it("extracts last segment from slash-separated path", () => {
		expect(parseRepoFromRemote("group/subgroup/repo-name")).toBe("repo-name");
	});

	it("returns undefined for empty string", () => {
		expect(parseRepoFromRemote("")).toBeUndefined();
	});

	it("returns undefined when URL ends with separator", () => {
		expect(parseRepoFromRemote("https://github.com/")).toBeUndefined();
	});
});
