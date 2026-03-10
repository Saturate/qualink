import { stat } from "node:fs/promises";
import { defineCommand } from "citty";
import type { CommonMetadata, MetricType, NormalizedDocument } from "../types.js";
import { formatBytes } from "../utils/format.js";
import { CliError } from "./cli-error.js";
import { type CommonArgs, commonArgs, isDryRun } from "./common-args.js";
import { parseCommonMetadata } from "./parse-metadata.js";
import { sendToSink } from "./send-to-sink.js";

interface CollectorResult {
	metricType: MetricType;
	documents: NormalizedDocument[];
}

interface CollectorCommandConfig<TExtra extends Record<string, unknown>> {
	name: string;
	description: string;
	extraArgs?: TExtra;
	collect: (args: CommonArgs, metadata: CommonMetadata) => Promise<CollectorResult>;
}

export function createCollectorCommand<TExtra extends Record<string, unknown>>(
	config: CollectorCommandConfig<TExtra>,
) {
	return defineCommand({
		meta: {
			name: config.name,
			description: config.description,
		},
		args: {
			...commonArgs,
			...config.extraArgs,
		},
		async run({ args }) {
			try {
				const parsedArgs: CommonArgs = args;
				const inputPath = typeof parsedArgs.input === "string" ? parsedArgs.input : undefined;
				if (inputPath) {
					const fileStat = await stat(inputPath);
					process.stderr.write(`  read: ${inputPath} (${formatBytes(fileStat.size)})\n`);
				}
				const metadata = parseCommonMetadata(parsedArgs);
				const { metricType, documents } = await config.collect(parsedArgs, metadata);

				await sendToSink(metricType, parsedArgs, documents);
				const verb = isDryRun(parsedArgs) ? "dry-run produced" : "relayed";
				process.stdout.write(`${verb} ${documents.length} ${metricType} document(s)\n`);
			} catch (error) {
				if (error instanceof CliError) {
					throw error;
				}
				if (error instanceof Error) {
					throw new CliError(error.message, 2);
				}
				throw new CliError("Unknown error", 2);
			}
		},
	});
}
