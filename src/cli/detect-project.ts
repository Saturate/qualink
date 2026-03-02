import { readdirSync } from "node:fs";
import { basename } from "node:path";
import { argValue, type CommonArgs, envOrArg } from "./common-args.js";
import { isInsideWorkspacePackage } from "./detect-package.js";

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

export function detectProjectName(args: CommonArgs): string | undefined {
	const explicit = envOrArg(argValue(args, "project"), "QUALINK_PROJECT");
	if (explicit) {
		return explicit;
	}

	// Auto-detect from .csproj when running inside a project subdirectory
	if (isInsideWorkspacePackage()) {
		return readCsprojName();
	}

	return undefined;
}
