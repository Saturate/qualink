import { ElasticSink } from "./elastic.js";
import { StdoutSink } from "./stdout.js";
import type { Sink } from "./types.js";

export type SinkKind = "elastic" | "stdout";

export interface SinkConfig {
	kind: SinkKind;
	elasticUrl?: string;
	elasticApiKey?: string;
	retryMax: number;
	retryBackoffMs: number;
}

export function createSink(config: SinkConfig): Sink {
	if (config.kind === "stdout") {
		return new StdoutSink();
	}

	if (!config.elasticUrl || !config.elasticApiKey) {
		throw new Error("Elastic sink requires ELASTIC_URL and ELASTIC_API_KEY (or CLI overrides)");
	}

	return new ElasticSink({
		url: config.elasticUrl,
		apiKey: config.elasticApiKey,
		retryMax: config.retryMax,
		retryBackoffMs: config.retryBackoffMs,
	});
}
