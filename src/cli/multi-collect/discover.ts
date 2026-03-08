import { readdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import {
	COLLECTOR_PATTERNS,
	type CollectorKey,
	type FilePattern,
	IGNORED_DIRS,
} from "./patterns.js";

function matchesPattern(filePath: string, pattern: FilePattern): boolean {
	const name = basename(filePath);

	if (pattern.basename !== undefined) {
		return name === pattern.basename;
	}

	if (pattern.prefix !== undefined && !name.startsWith(pattern.prefix)) {
		return false;
	}

	if (pattern.extensions !== undefined) {
		const hasExt = pattern.extensions.some((ext) => name.endsWith(ext));
		if (!hasExt) return false;
	}

	if (pattern.parentDir !== undefined) {
		const parent = basename(dirname(filePath));
		if (parent !== pattern.parentDir) return false;
	}

	return true;
}

function shouldIgnore(relativePath: string): boolean {
	const segments = relativePath.split("/");
	return segments.some((seg) => IGNORED_DIRS.has(seg));
}

/**
 * Walk a directory recursively and match files against known collector patterns.
 * Returns a map of collector key → absolute file paths.
 */
export async function discoverFiles(dir: string): Promise<Map<CollectorKey, string[]>> {
	const rootDir = resolve(dir);
	const entries = await readdir(rootDir, { recursive: true });

	const result = new Map<CollectorKey, string[]>();

	for (const relativePath of entries) {
		if (shouldIgnore(relativePath)) continue;

		for (const [key, patterns] of Object.entries(COLLECTOR_PATTERNS)) {
			const collectorKey = key as CollectorKey;
			for (const pattern of patterns) {
				if (matchesPattern(relativePath, pattern)) {
					const existing = result.get(collectorKey);
					const absolutePath = join(rootDir, relativePath);
					if (existing) {
						existing.push(absolutePath);
					} else {
						result.set(collectorKey, [absolutePath]);
					}
					break;
				}
			}
		}
	}

	return result;
}

/**
 * Expand a simple glob pattern (with `*` in path segments) against a directory.
 * Only supports `*` as a whole-segment wildcard or within a basename pattern.
 */
export async function expandGlob(pattern: string, baseDir: string): Promise<string[]> {
	const rootDir = resolve(baseDir);

	// No wildcard — treat as literal path
	if (!pattern.includes("*")) {
		return [join(rootDir, pattern)];
	}

	const entries = await readdir(rootDir, { recursive: true });
	const matched: string[] = [];

	// Convert glob to regex: escape dots, replace * with [^/]*
	const regexStr = pattern
		.split("/")
		.map((segment) => segment.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*"))
		.join("/");
	const regex = new RegExp(`^${regexStr}$`);

	for (const relativePath of entries) {
		if (shouldIgnore(relativePath)) continue;
		if (regex.test(relativePath)) {
			matched.push(join(rootDir, relativePath));
		}
	}

	return matched;
}
