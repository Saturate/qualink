import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { argValue, type CommonArgs, envOrArg } from "./common-args.js";
import { runGit } from "./git.js";

function isInsideWorkspacePackage(): boolean {
	const gitRoot = runGit(["rev-parse", "--show-toplevel"]);
	if (!gitRoot) {
		return false;
	}
	return resolve(".") !== resolve(gitRoot);
}

function readCsprojName(): string | undefined {
	try {
		const files = readdirSync(".");
		const csproj = files.find((f) => f.endsWith(".csproj"));
		if (csproj) {
			return basename(csproj, ".csproj");
		}
	} catch {
		// ignore
	}
	return undefined;
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

export function detectProjectName(args: CommonArgs): string | undefined {
	const explicit = envOrArg(argValue(args, "project"), "QUALINK_PROJECT");
	if (explicit) {
		return explicit;
	}

	const pnpmName = process.env.PNPM_PACKAGE_NAME;
	if (pnpmName && pnpmName.trim().length > 0) {
		return pnpmName;
	}

	if (isInsideWorkspacePackage()) {
		return readCsprojName() ?? readPackageJsonName();
	}

	return undefined;
}
