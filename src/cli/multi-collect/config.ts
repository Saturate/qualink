import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isRecord } from "../../utils/guards.js";
import { CliError } from "../cli-error.js";
import { expandGlob } from "./discover.js";
import { COLLECTOR_KEYS, type CollectorKey, isCollectorKey } from "./patterns.js";

export interface ConfigEntry {
	type: CollectorKey;
	input: string;
	tags?: string[];
	category?: string;
	project?: string;
	solution?: string;
	url?: string;
}

export interface ResolvedConfigEntry extends ConfigEntry {
	/** Expanded file paths from the input pattern */
	files: string[];
}

function validateEntry(value: unknown, index: number): ConfigEntry {
	if (!isRecord(value)) {
		throw new CliError(`config[${index}]: expected an object`, 2);
	}

	if (typeof value.type !== "string" || value.type.length === 0) {
		throw new CliError(`config[${index}]: missing required field 'type'`, 2);
	}
	if (!isCollectorKey(value.type)) {
		throw new CliError(
			`config[${index}].type: invalid collector type '${value.type}'. Expected: ${COLLECTOR_KEYS.join(", ")}`,
			2,
		);
	}

	if (typeof value.input !== "string" || value.input.length === 0) {
		throw new CliError(`config[${index}]: missing required field 'input'`, 2);
	}

	const entry: ConfigEntry = {
		type: value.type,
		input: value.input,
	};

	if (value.tags !== undefined) {
		if (
			!Array.isArray(value.tags) ||
			!value.tags.every((t): t is string => typeof t === "string")
		) {
			throw new CliError(`config[${index}].tags: must be an array of strings`, 2);
		}
		entry.tags = value.tags;
	}

	if (value.category !== undefined) {
		if (typeof value.category !== "string") {
			throw new CliError(`config[${index}].category: must be a string`, 2);
		}
		entry.category = value.category;
	}

	if (value.project !== undefined) {
		if (typeof value.project !== "string") {
			throw new CliError(`config[${index}].project: must be a string`, 2);
		}
		entry.project = value.project;
	}

	if (value.solution !== undefined) {
		if (typeof value.solution !== "string") {
			throw new CliError(`config[${index}].solution: must be a string`, 2);
		}
		entry.solution = value.solution;
	}

	if (value.url !== undefined) {
		if (typeof value.url !== "string") {
			throw new CliError(`config[${index}].url: must be a string`, 2);
		}
		entry.url = value.url;
	}

	return entry;
}

/**
 * Parse a config value: either an inline JSON string (starts with `[` or `{`)
 * or a file path to read.
 */
export async function parseConfig(configValue: string): Promise<ConfigEntry[]> {
	const trimmed = configValue.trim();
	let raw: unknown;

	if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
		try {
			raw = JSON.parse(trimmed);
		} catch {
			throw new CliError("Failed to parse inline JSON config", 2);
		}
	} else {
		const filePath = resolve(trimmed);
		let content: string;
		try {
			content = await readFile(filePath, "utf-8");
		} catch {
			throw new CliError(`Failed to read config file: ${filePath}`, 2);
		}
		try {
			raw = JSON.parse(content);
		} catch {
			throw new CliError(`Failed to parse config file as JSON: ${filePath}`, 2);
		}
	}

	// Support both bare object (single entry) and array
	const entries = Array.isArray(raw) ? raw : [raw];

	if (entries.length === 0) {
		throw new CliError("Config must contain at least one entry", 2);
	}

	return entries.map((entry, index) => validateEntry(entry, index));
}

/**
 * Resolve config entries by expanding glob patterns in their `input` fields.
 */
export async function resolveConfig(
	entries: ConfigEntry[],
	baseDir: string,
): Promise<ResolvedConfigEntry[]> {
	const resolved: ResolvedConfigEntry[] = [];

	for (const entry of entries) {
		const files = await expandGlob(entry.input, baseDir);
		resolved.push({ ...entry, files });
	}

	return resolved;
}
