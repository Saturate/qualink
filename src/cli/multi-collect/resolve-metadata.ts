import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { CommonMetadata } from "../../types.js";
import { runGit } from "../git.js";

function findGitRoot(): string | undefined {
	return runGit(["rev-parse", "--show-toplevel"]);
}

/**
 * Walk up from `startDir` to `stopAt` looking for the nearest package.json.
 * Returns the `name` field if found.
 */
function findNearestPackageName(startDir: string, stopAt: string): string | undefined {
	let current = resolve(startDir);
	const boundary = resolve(stopAt);

	while (current.startsWith(boundary)) {
		const pkgPath = join(current, "package.json");
		if (existsSync(pkgPath)) {
			try {
				const raw = JSON.parse(readFileSync(pkgPath, "utf-8")) as unknown;
				if (
					typeof raw === "object" &&
					raw !== null &&
					"name" in raw &&
					typeof raw.name === "string"
				) {
					return raw.name;
				}
			} catch {
				// malformed package.json, keep walking
			}
		}

		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}

	return undefined;
}

/**
 * Walk up from `startDir` to `stopAt` looking for a .csproj file.
 * Returns the project name (filename without extension) if found.
 */
function findNearestProjectName(startDir: string, stopAt: string): string | undefined {
	let current = resolve(startDir);
	const boundary = resolve(stopAt);

	while (current.startsWith(boundary)) {
		try {
			const files = readdirSync(current);
			const csproj = files.find((f) => f.endsWith(".csproj"));
			if (csproj) {
				return basename(csproj, ".csproj");
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
 * Walk up from `startDir` to `stopAt` looking for a .sln file.
 */
function findNearestSlnName(startDir: string, stopAt: string): string | undefined {
	let current = resolve(startDir);
	const boundary = resolve(stopAt);

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
 * If `fileDir` is different from `gitRoot`, read git root's package.json name
 * as the workspace root (solution).
 */
function findWorkspaceRootName(fileDir: string, gitRoot: string): string | undefined {
	if (resolve(fileDir) === resolve(gitRoot)) {
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

export interface FileMetadataOverrides {
	projectName?: string | null;
	solution?: string | null;
	tags?: string[];
	category?: string | null;
}

/**
 * Resolve metadata for a specific file by walking up from its directory.
 * Returns overrides that should be merged into the base metadata.
 */
export function resolveFileMetadata(filePath: string, collectorKey: string): FileMetadataOverrides {
	const fileDir = dirname(resolve(filePath));
	const gitRoot = findGitRoot();
	const stopAt = gitRoot ?? fileDir;

	const overrides: FileMetadataOverrides = {};

	// Detect project name
	if (collectorKey === "coverage-dotnet" || collectorKey === "sarif") {
		overrides.projectName = findNearestProjectName(fileDir, stopAt) ?? null;
	} else {
		overrides.projectName = findNearestPackageName(fileDir, stopAt) ?? null;
	}

	// Detect solution
	if (gitRoot) {
		overrides.solution =
			findNearestSlnName(fileDir, stopAt) ?? findWorkspaceRootName(fileDir, gitRoot) ?? null;
	} else {
		overrides.solution = null;
	}

	return overrides;
}

/**
 * Merge file-level overrides into base metadata, respecting precedence:
 * explicit config override > CLI arg/env (base metadata) > auto-detected from file
 */
export function mergeMetadata(
	base: CommonMetadata,
	fileOverrides: FileMetadataOverrides,
	configOverrides?: FileMetadataOverrides,
): CommonMetadata {
	return {
		...base,
		projectName:
			configOverrides?.projectName ?? base.projectName ?? fileOverrides.projectName ?? null,
		solution: configOverrides?.solution ?? base.solution ?? fileOverrides.solution ?? null,
		tags: configOverrides?.tags ?? base.tags,
		category: configOverrides?.category !== undefined ? configOverrides.category : base.category,
	};
}
