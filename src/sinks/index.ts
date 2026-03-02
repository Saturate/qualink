import { ElasticSink } from "./elastic.js";
import { LokiSink } from "./loki.js";
import { StdoutSink } from "./stdout.js";
import type { Sink } from "./types.js";

export type SinkKind = "elastic" | "loki" | "stdout";

export interface SinkConfig {
	kind: SinkKind;
	elasticUrl?: string;
	elasticApiKey?: string;
	lokiUrl?: string;
	lokiUsername?: string;
	lokiPassword?: string;
	lokiTenantId?: string;
	retryMax: number;
	retryBackoffMs: number;
}

export function createSink(config: SinkConfig): Sink {
	if (config.kind === "stdout") {
		return new StdoutSink();
	}

	if (config.kind === "loki") {
		if (!config.lokiUrl) {
			throw new Error("Loki sink requires LOKI_URL (or --loki-url)");
		}

		return new LokiSink({
			url: config.lokiUrl,
			username: config.lokiUsername,
			password: config.lokiPassword,
			tenantId: config.lokiTenantId,
			retryMax: config.retryMax,
			retryBackoffMs: config.retryBackoffMs,
		});
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
