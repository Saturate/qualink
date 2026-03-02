import type { MetricType, NormalizedDocument } from "../types.js";

export interface SendInput {
	metricType: MetricType;
	documents: NormalizedDocument[];
}

export interface Sink {
	send(input: SendInput): Promise<void>;
}
