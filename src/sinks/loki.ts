import type { NormalizedDocument } from "../types.js";
import type { SendInput, Sink } from "./types.js";

export interface LokiSinkOptions {
	url: string;
	username?: string | undefined;
	password?: string | undefined;
	tenantId?: string | undefined;
	retryMax: number;
	retryBackoffMs: number;
}

interface LokiStream {
	stream: Record<string, string>;
	values: [string, string][];
}

interface LokiPushPayload {
	streams: LokiStream[];
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
	return status === 429 || status >= 500;
}

function toLabelKey(doc: NormalizedDocument): string {
	return `${doc.metric_type}|${doc.repo}|${doc.environment}`;
}

export function toNanosecondEpoch(isoTimestamp: string): string {
	const ms = new Date(isoTimestamp).getTime();
	return `${ms}000000`;
}

export function buildLokiPayload(documents: NormalizedDocument[]): LokiPushPayload {
	const streamMap = new Map<string, LokiStream>();

	for (const doc of documents) {
		const key = toLabelKey(doc);

		let stream = streamMap.get(key);
		if (!stream) {
			stream = {
				stream: {
					metric_type: doc.metric_type,
					repo: doc.repo,
					environment: doc.environment,
				},
				values: [],
			};
			streamMap.set(key, stream);
		}

		stream.values.push([toNanosecondEpoch(doc["@timestamp"]), JSON.stringify(doc)]);
	}

	return { streams: Array.from(streamMap.values()) };
}

export class LokiSink implements Sink {
	private readonly url: string;
	private readonly username: string | undefined;
	private readonly password: string | undefined;
	private readonly tenantId: string | undefined;
	private readonly retryMax: number;
	private readonly retryBackoffMs: number;

	public constructor(options: LokiSinkOptions) {
		this.url = options.url.replace(/\/$/, "");
		this.username = options.username;
		this.password = options.password;
		this.tenantId = options.tenantId;
		this.retryMax = options.retryMax;
		this.retryBackoffMs = options.retryBackoffMs;
	}

	public async send(input: SendInput): Promise<void> {
		if (input.documents.length === 0) {
			return;
		}

		const payload = buildLokiPayload(input.documents);
		const body = JSON.stringify(payload);

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (this.username && this.password) {
			const encoded = btoa(`${this.username}:${this.password}`);
			headers.Authorization = `Basic ${encoded}`;
		}

		if (this.tenantId) {
			headers["X-Scope-OrgID"] = this.tenantId;
		}

		let attempt = 0;
		for (;;) {
			attempt += 1;

			const response = await fetch(`${this.url}/loki/api/v1/push`, {
				method: "POST",
				headers,
				body,
			});

			if (response.status === 204 || response.ok) {
				return;
			}

			const responseText = await response.text();

			if (!isRetryableStatus(response.status) || attempt > this.retryMax) {
				process.stderr.write(`[qualink] Dead-letter payload:\n${body}\n`);
				throw new Error(`Loki push failed (${response.status}): ${responseText}`);
			}

			await sleep(this.retryBackoffMs * attempt);
		}
	}
}
