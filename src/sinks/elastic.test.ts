import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedDocument } from "../types.js";
import { buildBulkBody, ElasticSink } from "./elastic.js";

function makeDoc(overrides?: Partial<NormalizedDocument>): NormalizedDocument {
	return {
		"@timestamp": "2024-01-01T00:00:00.000Z",
		metric_type: "eslint",
		tool: "eslint",
		languages: ["ts"],
		repo: "test",
		package: null,
		project: null,
		category: null,
		tags: [],
		branch: "main",
		commit_sha: "abc",
		pipeline_run_id: "1",
		pipeline_provider: "local",
		environment: "ci",
		collector_version: "0.1.0",
		errors: 0,
		warnings: 0,
		fixable_errors: 0,
		fixable_warnings: 0,
		...overrides,
	} as NormalizedDocument;
}

function makeSink(overrides?: { retryMax?: number; retryBackoffMs?: number }) {
	return new ElasticSink({
		url: "https://elastic.example.com",
		apiKey: "test-key",
		retryMax: overrides?.retryMax ?? 2,
		retryBackoffMs: overrides?.retryBackoffMs ?? 0,
	});
}

function mockFetchResponse(status: number, body: unknown, ok?: boolean) {
	return {
		ok: ok ?? (status >= 200 && status < 300),
		status,
		json: async () => body,
		text: async () => JSON.stringify(body),
	} as Response;
}

describe("buildBulkBody", () => {
	it("produces valid NDJSON", () => {
		const docs = [makeDoc()];
		const body = buildBulkBody("codequality-eslint", docs);
		const lines = body.trim().split("\n");
		expect(lines).toHaveLength(2);
		expect(JSON.parse(lines[0] ?? "")).toEqual({ index: { _index: "codequality-eslint" } });
		expect(JSON.parse(lines[1] ?? "")).toMatchObject({ metric_type: "eslint" });
		expect(body.endsWith("\n")).toBe(true);
	});
});

describe("ElasticSink", () => {
	const originalFetch = globalThis.fetch;
	let stderrSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		stderrSpy.mockRestore();
	});

	it("succeeds on 200 with no errors", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(200, { errors: false }));

		const sink = makeSink();
		await sink.send({ metricType: "eslint", documents: [makeDoc()] });
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it("skips send when documents array is empty", async () => {
		globalThis.fetch = vi.fn();
		const sink = makeSink();
		await sink.send({ metricType: "eslint", documents: [] });
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("retries on 429 then succeeds", async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(mockFetchResponse(429, "rate limited", false))
			.mockResolvedValueOnce(mockFetchResponse(200, { errors: false }));

		const sink = makeSink();
		await sink.send({ metricType: "eslint", documents: [makeDoc()] });
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
	});

	it("retries on 500 then succeeds", async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(mockFetchResponse(500, "server error", false))
			.mockResolvedValueOnce(mockFetchResponse(200, { errors: false }));

		const sink = makeSink();
		await sink.send({ metricType: "eslint", documents: [makeDoc()] });
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
	});

	it("fails immediately on 400 without retry", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(400, "bad request", false));

		const sink = makeSink();
		await expect(sink.send({ metricType: "eslint", documents: [makeDoc()] })).rejects.toThrow(
			"Elastic bulk request failed (400)",
		);
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it("fails immediately on 401 without retry", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(401, "unauthorized", false));

		const sink = makeSink();
		await expect(sink.send({ metricType: "eslint", documents: [makeDoc()] })).rejects.toThrow(
			"Elastic bulk request failed (401)",
		);
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it("retries only failed items on partial bulk failure", async () => {
		const docs = [
			makeDoc({ errors: 1 } as Partial<NormalizedDocument>),
			makeDoc({ errors: 2 } as Partial<NormalizedDocument>),
		];

		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(
				mockFetchResponse(200, {
					errors: true,
					items: [
						{ index: { status: 200 } },
						{ index: { status: 429, error: { reason: "rate limited" } } },
					],
				}),
			)
			.mockResolvedValueOnce(mockFetchResponse(200, { errors: false }));

		const sink = makeSink();
		await sink.send({ metricType: "eslint", documents: docs });

		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
		// Second call should only contain the failed doc
		const secondCallBody = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1]?.[1]
			?.body as string;
		const lines = secondCallBody.trim().split("\n");
		expect(lines).toHaveLength(2);
	});

	it("writes dead-letter payload to stderr on final failure", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(500, "server error", false));

		const sink = makeSink({ retryMax: 0 });
		await expect(sink.send({ metricType: "eslint", documents: [makeDoc()] })).rejects.toThrow(
			"Elastic bulk request failed (500)",
		);

		expect(stderrSpy).toHaveBeenCalledWith(
			expect.stringContaining("[qualink] Dead-letter payload:"),
		);
	});

	it("dead-letters retryable items after max retries", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			mockFetchResponse(200, {
				errors: true,
				items: [{ index: { status: 429, error: { reason: "rate limited" } } }],
			}),
		);

		const sink = makeSink({ retryMax: 1, retryBackoffMs: 0 });
		await expect(sink.send({ metricType: "eslint", documents: [makeDoc()] })).rejects.toThrow(
			/failed after .* attempts/,
		);
		// 1 initial + 1 retry = 2
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
		expect(stderrSpy).toHaveBeenCalledWith(
			expect.stringContaining("[qualink] Dead-letter payload:"),
		);
	});

	it("handles empty items array in response", async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValue(mockFetchResponse(200, { errors: true, items: [] }));

		const sink = makeSink();
		await sink.send({ metricType: "eslint", documents: [makeDoc()] });
	});

	it("logs non-retryable item errors to stderr", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			mockFetchResponse(200, {
				errors: true,
				items: [{ index: { status: 400, error: { reason: "mapping error" } } }],
			}),
		);

		const sink = makeSink();
		await expect(sink.send({ metricType: "eslint", documents: [makeDoc()] })).rejects.toThrow(
			"non-retryable item error",
		);

		expect(stderrSpy).toHaveBeenCalledWith(
			expect.stringContaining("Non-retryable bulk item error"),
		);
	});
});
