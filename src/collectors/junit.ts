import { XMLParser } from "fast-xml-parser";
import { baseDocument } from "../normalize.js";
import type { CommonMetadata, JunitMetricDocument } from "../types.js";
import { isRecord } from "../utils/guards.js";

function readNumber(record: Record<string, unknown>, key: string): number {
	const value = record[key];
	if (typeof value === "number") {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Number(value);
		if (!Number.isNaN(parsed)) {
			return parsed;
		}
	}
	return 0;
}

function parseSuite(suite: Record<string, unknown>): {
	tests: number;
	failures: number;
	errors: number;
	skipped: number;
	time: number | null;
} {
	const tests = readNumber(suite, "@_tests");
	const failures = readNumber(suite, "@_failures");
	const errors = readNumber(suite, "@_errors");
	const skipped = readNumber(suite, "@_skipped");

	const rawTime = suite["@_time"];
	const time =
		typeof rawTime === "number"
			? rawTime
			: typeof rawTime === "string" && rawTime.length > 0
				? Number(rawTime)
				: null;

	return {
		tests,
		failures,
		errors,
		skipped,
		time: time !== null && !Number.isNaN(time) ? time : null,
	};
}

function toArray(value: unknown): unknown[] {
	if (Array.isArray(value)) return value;
	if (value !== undefined && value !== null) return [value];
	return [];
}

export function collectJunit(xmlInput: string, metadata: CommonMetadata): JunitMetricDocument[] {
	const parser = new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: "@_",
		parseAttributeValue: true,
	});

	const parsed = parser.parse(xmlInput) as unknown;
	if (!isRecord(parsed)) {
		throw new Error("JUnit XML could not be parsed");
	}

	let suites: Record<string, unknown>[];

	if (parsed.testsuites !== undefined) {
		if (isRecord(parsed.testsuites)) {
			const raw = toArray(parsed.testsuites.testsuite);
			suites = raw.filter(isRecord);
		} else {
			// Empty <testsuites/> — parsed as empty string
			suites = [];
		}
	} else if (isRecord(parsed.testsuite)) {
		suites = [parsed.testsuite];
	} else {
		throw new Error("Unrecognized JUnit XML format. Expected <testsuites> or <testsuite> root");
	}

	let totalTests = 0;
	let totalFailures = 0;
	let totalErrors = 0;
	let totalSkipped = 0;
	let totalTime: number | null = 0;

	for (const suite of suites) {
		const result = parseSuite(suite);
		totalTests += result.tests;
		totalFailures += result.failures;
		totalErrors += result.errors;
		totalSkipped += result.skipped;

		if (result.time !== null && totalTime !== null) {
			totalTime += result.time;
		} else {
			totalTime = null;
		}
	}

	const passed = Math.max(0, totalTests - totalFailures - totalErrors - totalSkipped);
	const durationMs = totalTime !== null ? Math.round(totalTime * 1000) : null;

	const doc: JunitMetricDocument = {
		...baseDocument({
			metricType: "junit",
			tool: "junit",
			languages: [],
			metadata,
		}),
		tests: totalTests,
		passed,
		failures: totalFailures,
		errors: totalErrors,
		skipped: totalSkipped,
		duration_ms: durationMs,
		suites: suites.length,
	};

	return [doc];
}
