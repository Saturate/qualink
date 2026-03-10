import { relative } from "node:path";
import { defineCommand, runMain } from "citty";
import type { MetricType, NormalizedDocument } from "../types.js";
import { CliError } from "./cli-error.js";
import {
	biomeCommand,
	coverageDotnetCommand,
	coverageJsCommand,
	eslintCommand,
	junitCommand,
	lighthouseCommand,
	metaCommand,
	pipelineCommand,
	sarifCommand,
} from "./commands/index.js";
import { type CommonArgs, commonArgs, isDryRun } from "./common-args.js";
import { parseConfig, resolveConfig } from "./multi-collect/config.js";
import { discoverFiles } from "./multi-collect/discover.js";
import type { CollectorKey } from "./multi-collect/patterns.js";
import {
	type FileMetadataOverrides,
	mergeMetadata,
	resolveFileMetadata,
} from "./multi-collect/resolve-metadata.js";
import { type CollectorOutput, runCollector } from "./multi-collect/run-collector.js";
import { parseCommonMetadata } from "./parse-metadata.js";
import { sendToSink } from "./send-to-sink.js";

// Common args without `input` (required by single-collector subcommands but not multi-collect)
const { input: _input, ...multiCollectBaseArgs } = commonArgs;

const collectCommand = defineCommand({
	meta: {
		name: "collect",
		description: "Collect quality metrics from a specific collector",
	},
	args: {
		...multiCollectBaseArgs,
		dir: {
			type: "string" as const,
			description: "Auto-discover report files under a directory",
		},
		config: {
			type: "string" as const,
			description: "Config file path or inline JSON for multi-collection",
		},
	},
	subCommands: {
		biome: biomeCommand,
		eslint: eslintCommand,
		lighthouse: lighthouseCommand,
		"coverage-js": coverageJsCommand,
		sarif: sarifCommand,
		"coverage-dotnet": coverageDotnetCommand,
		junit: junitCommand,
	},
	async run({ args }) {
		const parsedArgs: CommonArgs = args;
		const dirValue = args.dir;
		const configValue = args.config;

		if (typeof dirValue === "string" && typeof configValue === "string") {
			throw new CliError("--dir and --config are mutually exclusive", 2);
		}

		if (typeof dirValue === "string") {
			await runDirMode(dirValue, parsedArgs);
		} else if (typeof configValue === "string") {
			await runConfigMode(configValue, parsedArgs);
		}
		// If neither --dir nor --config, citty will show help for subcommands
	},
});

async function runDirMode(dir: string, args: CommonArgs): Promise<void> {
	const metadata = parseCommonMetadata(args);
	const discovered = await discoverFiles(dir);

	for (const [collectorKey, files] of discovered) {
		for (const filePath of files) {
			process.stderr.write(`  scan: ${relative(dir, filePath)} → ${collectorKey}\n`);
		}
	}

	const accumulated = new Map<MetricType, NormalizedDocument[]>();
	const counts = new Map<CollectorKey, number>();

	for (const [collectorKey, files] of discovered) {
		for (const filePath of files) {
			try {
				const fileOverrides = resolveFileMetadata(filePath, collectorKey);
				const merged = mergeMetadata(metadata, fileOverrides);
				const output = await runCollector(collectorKey, filePath, merged);
				accumulate(accumulated, output);
				counts.set(collectorKey, (counts.get(collectorKey) ?? 0) + output.documents.length);
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				process.stderr.write(`warning: skipping ${filePath} (${collectorKey}): ${msg}\n`);
			}
		}
	}

	await sendAll(accumulated, args);
	printSummary(counts, args);
}

async function runConfigMode(configValue: string, args: CommonArgs): Promise<void> {
	const metadata = parseCommonMetadata(args);
	const entries = await parseConfig(configValue);
	const resolved = await resolveConfig(entries, ".");

	for (const entry of resolved) {
		for (const filePath of entry.files) {
			process.stderr.write(`  scan: ${filePath} → ${entry.type}\n`);
		}
	}

	const accumulated = new Map<MetricType, NormalizedDocument[]>();
	const counts = new Map<CollectorKey, number>();

	for (const entry of resolved) {
		const configOverrides: FileMetadataOverrides = {};
		if (entry.tags !== undefined) configOverrides.tags = entry.tags;
		if (entry.category !== undefined) configOverrides.category = entry.category;
		if (entry.project !== undefined) configOverrides.projectName = entry.project;
		if (entry.solution !== undefined) configOverrides.solution = entry.solution;

		for (const filePath of entry.files) {
			try {
				const fileOverrides = resolveFileMetadata(filePath, entry.type);
				const merged = mergeMetadata(metadata, fileOverrides, configOverrides);
				const output = await runCollector(entry.type, filePath, merged, entry.url);
				accumulate(accumulated, output);
				counts.set(entry.type, (counts.get(entry.type) ?? 0) + output.documents.length);
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				process.stderr.write(`warning: skipping ${filePath} (${entry.type}): ${msg}\n`);
			}
		}
	}

	await sendAll(accumulated, args);
	printSummary(counts, args);
}

function accumulate(map: Map<MetricType, NormalizedDocument[]>, output: CollectorOutput): void {
	const existing = map.get(output.metricType);
	if (existing) {
		existing.push(...output.documents);
	} else {
		map.set(output.metricType, [...output.documents]);
	}
}

async function sendAll(
	accumulated: Map<MetricType, NormalizedDocument[]>,
	args: CommonArgs,
): Promise<void> {
	for (const [metricType, documents] of accumulated) {
		if (documents.length > 0) {
			await sendToSink(metricType, { ...args, "allow-empty": true }, documents);
		}
	}
}

function printSummary(counts: Map<CollectorKey, number>, args: CommonArgs): void {
	const verb = isDryRun(args) ? "dry-run" : "collected";
	const parts: string[] = [];
	let total = 0;
	for (const [key, count] of counts) {
		parts.push(`${count} ${key}`);
		total += count;
	}

	if (total === 0) {
		process.stderr.write("warning: no report files found\n");
		return;
	}

	process.stdout.write(`${verb}: ${parts.join(", ")}\n`);
}

const main = defineCommand({
	meta: {
		name: "qualink",
		version: "0.1.0",
		description: "Collect, normalize, and relay code quality metrics",
	},
	subCommands: {
		collect: collectCommand,
		meta: metaCommand,
		pipeline: pipelineCommand,
	},
});

runMain(main).catch((error: unknown) => {
	if (error instanceof CliError) {
		process.stderr.write(`qualink error: ${error.message}\n`);
		process.exit(error.exitCode);
	}

	if (error instanceof Error) {
		process.stderr.write(`qualink error: ${error.message}\n`);
		process.exit(2);
	}

	process.stderr.write("qualink error: unknown failure\n");
	process.exit(2);
});
