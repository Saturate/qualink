import type { SendInput, Sink } from "./types.js";

export class StdoutSink implements Sink {
	public async send(input: SendInput): Promise<void> {
		const payload = {
			metric_type: input.metricType,
			count: input.documents.length,
			documents: input.documents,
		};

		process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
	}
}
