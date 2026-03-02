import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MetaMetricDocument } from "../types.js";
import { sendToSink } from "./send-to-sink.js";

function makeDummyDoc(overrides: Partial<MetaMetricDocument> = {}): MetaMetricDocument {
	return {
		"@timestamp": "2025-01-01T00:00:00.000Z",
		metric_type: "meta",
		tool: "qualink",
		languages: [],
		repo: "test",
		package: null,
		project: null,
		category: null,
		tags: ["repo:test"],
		branch: "main",
		commit_sha: "abc",
		pipeline_run_id: "1",
		pipeline_provider: "local",
		environment: "ci",
		collector_version: "0.1.0",
		...overrides,
	};
}

describe("sendToSink", () => {
	let writeSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
	});

	afterEach(() => {
		writeSpy.mockRestore();
	});

	it("throws when documents empty and allow-empty not set", async () => {
		await expect(sendToSink("meta", {}, [])).rejects.toThrow(/no documents/i);
	});

	it("does not throw when documents empty and allow-empty is true", async () => {
		await expect(
			sendToSink("meta", { "allow-empty": true, sink: "stdout" }, []),
		).resolves.toBeUndefined();
	});

	it("dry-run writes JSON to stdout", async () => {
		const doc = makeDummyDoc();
		await sendToSink("meta", { "dry-run": true }, [doc]);

		expect(writeSpy).toHaveBeenCalledOnce();
		const output = writeSpy.mock.calls[0][0] as string;
		const parsed = JSON.parse(output);
		expect(parsed.dry_run).toBe(true);
		expect(parsed.metric_type).toBe("meta");
		expect(parsed.count).toBe(1);
		expect(parsed.documents).toHaveLength(1);
	});

	it("stdout sink writes payload JSON", async () => {
		const doc = makeDummyDoc();
		await sendToSink("meta", { sink: "stdout" }, [doc]);

		expect(writeSpy).toHaveBeenCalledOnce();
		const output = writeSpy.mock.calls[0][0] as string;
		const parsed = JSON.parse(output);
		expect(parsed.metric_type).toBe("meta");
		expect(parsed.count).toBe(1);
	});

	it("throws on unsupported sink", async () => {
		const doc = makeDummyDoc();
		await expect(sendToSink("meta", { sink: "kafka" }, [doc])).rejects.toThrow(/unsupported sink/i);
	});

	it("throws when elastic sink missing credentials", async () => {
		const doc = makeDummyDoc();
		await expect(sendToSink("meta", { sink: "elastic" }, [doc])).rejects.toThrow(/ELASTIC_URL/);
	});

	it("parses string retry-max into a number", async () => {
		const doc = makeDummyDoc();
		// This exercises parseNumberInput with a string value — should not throw
		await sendToSink("meta", { sink: "stdout", "retry-max": "5", "retry-backoff-ms": "100" }, [
			doc,
		]);
		expect(writeSpy).toHaveBeenCalled();
	});

	it("QUALINK_SINK env overrides default sink", async () => {
		const saved = process.env.QUALINK_SINK;
		process.env.QUALINK_SINK = "stdout";
		try {
			const doc = makeDummyDoc();
			await sendToSink("meta", {}, [doc]);
			expect(writeSpy).toHaveBeenCalled();
		} finally {
			if (saved === undefined) {
				delete process.env.QUALINK_SINK;
			} else {
				process.env.QUALINK_SINK = saved;
			}
		}
	});
});
