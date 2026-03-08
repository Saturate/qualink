import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { argValue, type CommonArgs, envOrArg } from "./common-args.js";
import { runGit } from "./git.js";

function findGitRoot(): string | undefined {
	return runGit(["rev-parse", "--show-toplevel"]);
}

/**
 * Walk up from CWD to git root looking for a .sln file.
 */
function findSlnName(): string | undefined {
	const gitRoot = findGitRoot();
	if (!gitRoot) {
		return undefined;
	}

	let current = resolve(".");
	const boundary = resolve(gitRoot);

	while (current.startsWith(boundary)) {
		try {
			const files = readdirSync(current);
			const sln = files.find((f) => f.endsWith(".sln"));
			if (sln) {
				return basename(sln, ".sln");
			}
		} catch {
			// permission error, keep walking
		}

		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}

	return undefined;
}

/**
 * If CWD is inside a workspace subdirectory, read the git root's
 * package.json name as the workspace root (solution).
 */
function findWorkspaceRootName(): string | undefined {
	const gitRoot = findGitRoot();
	if (!gitRoot) {
		return undefined;
	}

	// Only counts as workspace if CWD != git root
	if (resolve(".") === resolve(gitRoot)) {
		return undefined;
	}

	try {
		const pkgPath = join(gitRoot, "package.json");
		if (!existsSync(pkgPath)) {
			return undefined;
		}
		const raw = JSON.parse(readFileSync(pkgPath, "utf-8")) as unknown;
		if (typeof raw === "object" && raw !== null && "name" in raw && typeof raw.name === "string") {
			return raw.name;
		}
	} catch {
		// ignore
	}
	return undefined;
}

export function detectSolution(args: CommonArgs): string | undefined {
	const explicit = envOrArg(argValue(args, "solution"), "QUALINK_SOLUTION");
	if (explicit) {
		return explicit;
	}

	return findSlnName() ?? findWorkspaceRootName();
}
