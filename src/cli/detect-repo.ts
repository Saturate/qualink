import { basename } from "node:path";
import { argValue, type CommonArgs, envOrArg } from "./common-args.js";
import { runGit } from "./git.js";

export function parseRepoFromRemote(remoteUrl: string): string | undefined {
	if (remoteUrl.length === 0) {
		return undefined;
	}

	const normalized = remoteUrl.replace(/\.git$/, "");
	const slashIndex = normalized.lastIndexOf("/");
	const colonIndex = normalized.lastIndexOf(":");
	const splitIndex = Math.max(slashIndex, colonIndex);

	if (splitIndex < 0 || splitIndex === normalized.length - 1) {
		return undefined;
	}

	return normalized.slice(splitIndex + 1);
}

export function detectRepo(args: CommonArgs): string {
	const explicit = envOrArg(argValue(args, "repo"), "QUALINK_REPO");
	if (explicit) {
		return explicit;
	}

	const ciRepo =
		process.env.BUILD_REPOSITORY_NAME ??
		process.env.GITHUB_REPOSITORY ??
		process.env.CI_PROJECT_PATH;
	if (ciRepo && ciRepo.trim().length > 0) {
		const parsed = parseRepoFromRemote(ciRepo);
		return parsed ?? ciRepo;
	}

	const origin = runGit(["remote", "get-url", "origin"]);
	if (origin) {
		const parsed = parseRepoFromRemote(origin);
		if (parsed) {
			return parsed;
		}
	}

	return basename(process.cwd());
}
