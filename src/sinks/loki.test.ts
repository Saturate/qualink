import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedDocument } from "../types.js";
import { buildLokiPayload, LokiSink, toNanosecondEpoch } from "./loki.js";

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

function makeSink(overrides?: {
	retryMax?: number;
	retryBackoffMs?: number;
	username?: string;
	password?: string;
	tenantId?: string;
}) {
	return new LokiSink({
		url: "https://loki.example.com",
		username: overrides?.username,
		password: overrides?.password,
		tenantId: overrides?.tenantId,
		retryMax: overrides?.retryMax ?? 2,
		retryBackoffMs: overrides?.retryBackoffMs ?? 0,
	});
}

function mockFetchResponse(status: number, body?: string, ok?: boolean) {
	return {
		ok: ok ?? (status >= 200 && status < 300),
		status,
		text: async () => body ?? "",
	} as Response;
}

describe("toNanosecondEpoch", () => {
	it("converts ISO timestamp to nanosecond unix epoch", () => {
		const result = toNanosecondEpoch("2024-01-01T00:00:00.000Z");
		expect(result).toBe("1704067200000000000");
	});
});

describe("buildLokiPayload", () => {
	it("builds a single stream for docs with same labels", () => {
		const docs = [makeDoc(), makeDoc()];
		const payload = buildLokiPayload(docs);

		expect(payload.streams).toHaveLength(1);
		expect(payload.streams[0]?.stream).toEqual({
			metric_type: "eslint",
			repo: "test",
			environment: "ci",
		});
		expect(payload.streams[0]?.values).toHaveLength(2);
	});

	it("groups documents into separate streams by label set", () => {
		const docs = [
			makeDoc({ repo: "frontend" }),
			makeDoc({ repo: "backend" }),
			makeDoc({ repo: "frontend" }),
		];
		const payload = buildLokiPayload(docs);

		expect(payload.streams).toHaveLength(2);

		const frontendStream = payload.streams.find((s) => s.stream.repo === "frontend");
		const backendStream = payload.streams.find((s) => s.stream.repo === "backend");

		expect(frontendStream?.values).toHaveLength(2);
		expect(backendStream?.values).toHaveLength(1);
	});

	it("serializes full document JSON as the log line value", () => {
		const doc = makeDoc();
		const payload = buildLokiPayload([doc]);

		const logLine = payload.streams[0]?.values[0]?.[1];
		expect(logLine).toBeDefined();
		// biome-ignore lint/style/noNonNullAssertion: guarded by toBeDefined above
		expect(JSON.parse(logLine!)).toMatchObject({ metric_type: "eslint", repo: "test" });
	});

	it("converts @timestamp to nanosecond unix epoch", () => {
		const doc = makeDoc({ "@timestamp": "2024-01-01T00:00:00.000Z" });
		const payload = buildLokiPayload([doc]);

		const timestamp = payload.streams[0]?.values[0]?.[0];
		expect(timestamp).toBe("1704067200000000000");
	});
});

describe("LokiSink", () => {
	const originalFetch = globalThis.fetch;
	let stderrSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		stderrSpy.mockRestore();
	});

	it("sends correct JSON payload to /loki/api/v1/push", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(204));

		const sink = makeSink();
		await sink.send({ metricType: "eslint", documents: [makeDoc()] });

		expect(globalThis.fetch).toHaveBeenCalledTimes(1);

		const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			RequestInit,
		];
		expect(url).toBe("https://loki.example.com/loki/api/v1/push");
		expect(init.method).toBe("POST");
		expect(init.headers).toMatchObject({ "Content-Type": "application/json" });

		const body = JSON.parse(init.body as string);
		expect(body.streams).toHaveLength(1);
		expect(body.streams[0].stream).toEqual({
			metric_type: "eslint",
			repo: "test",
			environment: "ci",
		});
		expect(body.streams[0].values).toHaveLength(1);
	});

	it("sets basic auth header when credentials provided", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(204));

		const sink = makeSink({ username: "user", password: "pass" });
		await sink.send({ metricType: "eslint", documents: [makeDoc()] });

		const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			RequestInit,
		];
		const headers = init.headers as Record<string, string>;
		expect(headers.Authorization).toBe(`Basic ${btoa("user:pass")}`);
	});

	it("sets X-Scope-OrgID header when tenant ID provided", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(204));

		const sink = makeSink({ tenantId: "my-tenant" });
		await sink.send({ metricType: "eslint", documents: [makeDoc()] });

		const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			RequestInit,
		];
		const headers = init.headers as Record<string, string>;
		expect(headers["X-Scope-OrgID"]).toBe("my-tenant");
	});

	it("skips auth header when no credentials", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(204));

		const sink = makeSink();
		await sink.send({ metricType: "eslint", documents: [makeDoc()] });

		const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			RequestInit,
		];
		const headers = init.headers as Record<string, string>;
		expect(headers.Authorization).toBeUndefined();
		expect(headers["X-Scope-OrgID"]).toBeUndefined();
	});

	it("skips send on empty documents", async () => {
		globalThis.fetch = vi.fn();
		const sink = makeSink();
		await sink.send({ metricType: "eslint", documents: [] });
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("retries on 429 then succeeds", async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(mockFetchResponse(429, "rate limited", false))
			.mockResolvedValueOnce(mockFetchResponse(204));

		const sink = makeSink();
		await sink.send({ metricType: "eslint", documents: [makeDoc()] });
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
	});

	it("retries on 500 then succeeds", async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(mockFetchResponse(500, "server error", false))
			.mockResolvedValueOnce(mockFetchResponse(204));

		const sink = makeSink();
		await sink.send({ metricType: "eslint", documents: [makeDoc()] });
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
	});

	it("fails immediately on 400 without retry", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(400, "bad request", false));

		const sink = makeSink();
		await expect(sink.send({ metricType: "eslint", documents: [makeDoc()] })).rejects.toThrow(
			"Loki push failed (400)",
		);
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it("fails immediately on 401 without retry", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(401, "unauthorized", false));

		const sink = makeSink();
		await expect(sink.send({ metricType: "eslint", documents: [makeDoc()] })).rejects.toThrow(
			"Loki push failed (401)",
		);
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it("dead-letters to stderr on final failure", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(500, "server error", false));

		const sink = makeSink({ retryMax: 0 });
		await expect(sink.send({ metricType: "eslint", documents: [makeDoc()] })).rejects.toThrow(
			"Loki push failed (500)",
		);

		expect(stderrSpy).toHaveBeenCalledWith(
			expect.stringContaining("[qualink] Dead-letter payload:"),
		);
	});

	it("dead-letters after exhausting retries on 429", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(429, "rate limited", false));

		const sink = makeSink({ retryMax: 1, retryBackoffMs: 0 });
		await expect(sink.send({ metricType: "eslint", documents: [makeDoc()] })).rejects.toThrow(
			"Loki push failed (429)",
		);
		// 1 initial + 1 retry = 2
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
		expect(stderrSpy).toHaveBeenCalledWith(
			expect.stringContaining("[qualink] Dead-letter payload:"),
		);
	});

	it("strips trailing slash from URL", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(204));

		const sink = new LokiSink({
			url: "https://loki.example.com/",
			retryMax: 2,
			retryBackoffMs: 0,
		});
		await sink.send({ metricType: "eslint", documents: [makeDoc()] });

		const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
		expect(url).toBe("https://loki.example.com/loki/api/v1/push");
	});
});
