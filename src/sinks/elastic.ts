import type { MetricType, NormalizedDocument } from "../types.js";
import { isRecord } from "../utils/guards.js";
import type { SendInput, Sink } from "./types.js";

interface ElasticSinkOptions {
	url: string;
	apiKey: string;
	retryMax: number;
	retryBackoffMs: number;
}

const INDEX_BY_TYPE: Record<MetricType, string> = {
	biome: "codequality-biome",
	eslint: "codequality-eslint",
	lighthouse: "codequality-lighthouse",
	"coverage-js": "codequality-coverage-js",
	sarif: "codequality-sarif",
	"coverage-dotnet": "codequality-coverage-dotnet",
};

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
	return status === 429 || status >= 500;
}

export function buildBulkBody(indexName: string, documents: NormalizedDocument[]): string {
	return `${documents
		.flatMap((document) => [
			JSON.stringify({ index: { _index: indexName } }),
			JSON.stringify(document),
		])
		.join("\n")}\n`;
}

interface BulkItemResult {
	index?: { status?: number; error?: unknown };
}

function extractFailedItems(
	responseBody: unknown,
	documents: NormalizedDocument[],
): { retryable: NormalizedDocument[]; nonRetryableErrors: string[] } {
	const retryable: NormalizedDocument[] = [];
	const nonRetryableErrors: string[] = [];

	if (!isRecord(responseBody) || !Array.isArray(responseBody.items)) {
		return { retryable, nonRetryableErrors };
	}

	const items = responseBody.items as BulkItemResult[];
	for (let i = 0; i < items.length; i++) {
		const item: BulkItemResult | undefined = items[i];
		const status = item?.index?.status ?? 200;
		if (status >= 200 && status < 300) {
			continue;
		}

		const doc = documents[i];
		if (!doc) {
			continue;
		}

		if (isRetryableStatus(status)) {
			retryable.push(doc);
		} else {
			nonRetryableErrors.push(
				`Item ${i} failed (${status}): ${JSON.stringify(item?.index?.error)}`,
			);
		}
	}

	return { retryable, nonRetryableErrors };
}

export class ElasticSink implements Sink {
	private readonly url: string;
	private readonly apiKey: string;
	private readonly retryMax: number;
	private readonly retryBackoffMs: number;

	public constructor(options: ElasticSinkOptions) {
		this.url = options.url.replace(/\/$/, "");
		this.apiKey = options.apiKey;
		this.retryMax = options.retryMax;
		this.retryBackoffMs = options.retryBackoffMs;
	}

	public async send(input: SendInput): Promise<void> {
		if (input.documents.length === 0) {
			return;
		}

		const indexName = INDEX_BY_TYPE[input.metricType];
		let documents = input.documents;

		let attempt = 0;
		for (;;) {
			attempt += 1;

			const body = buildBulkBody(indexName, documents);

			const response = await fetch(`${this.url}/_bulk`, {
				method: "POST",
				headers: {
					Authorization: `ApiKey ${this.apiKey}`,
					"Content-Type": "application/x-ndjson",
				},
				body,
			});

			if (!response.ok) {
				const responseText = await response.text();
				if (!isRetryableStatus(response.status) || attempt > this.retryMax) {
					process.stderr.write(`[qualink] Dead-letter payload:\n${body}`);
					throw new Error(`Elastic bulk request failed (${response.status}): ${responseText}`);
				}

				await sleep(this.retryBackoffMs * attempt);
				continue;
			}

			const result: unknown = await response.json();
			if (isRecord(result) && result.errors === true) {
				const { retryable, nonRetryableErrors } = extractFailedItems(result, documents);

				for (const errMsg of nonRetryableErrors) {
					process.stderr.write(`[qualink] Non-retryable bulk item error: ${errMsg}\n`);
				}

				if (retryable.length === 0) {
					// All failures were non-retryable — nothing left to retry
					if (nonRetryableErrors.length > 0) {
						throw new Error(
							`Elastic bulk request completed with ${nonRetryableErrors.length} non-retryable item error(s)`,
						);
					}
					return;
				}

				if (attempt > this.retryMax) {
					const deadLetterBody = buildBulkBody(indexName, retryable);
					process.stderr.write(`[qualink] Dead-letter payload:\n${deadLetterBody}`);
					throw new Error(
						`Elastic bulk request failed after ${attempt} attempts with ${retryable.length} item error(s)`,
					);
				}

				documents = retryable;
				await sleep(this.retryBackoffMs * attempt);
				continue;
			}

			return;
		}
	}
}
