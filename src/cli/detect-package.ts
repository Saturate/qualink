import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { argValue, type CommonArgs, envOrArg } from "./common-args.js";
import { runGit } from "./git.js";

export function isInsideWorkspacePackage(): boolean {
	const gitRoot = runGit(["rev-parse", "--show-toplevel"]);
	if (!gitRoot) {
		return false;
	}
	return resolve(".") !== resolve(gitRoot);
}

function readPackageJsonName(): string | undefined {
	try {
		const pkgPath = resolve("package.json");
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

export function detectPackageName(args: CommonArgs): string | undefined {
	const explicit = envOrArg(argValue(args, "package"), "QUALINK_PACKAGE");
	if (explicit) {
		return explicit;
	}

	const pnpmName = process.env.PNPM_PACKAGE_NAME;
	if (pnpmName && pnpmName.trim().length > 0) {
		return pnpmName;
	}

	// Auto-detect from ./package.json when running inside a workspace subdirectory
	if (isInsideWorkspacePackage()) {
		return readPackageJsonName();
	}

	return undefined;
}
