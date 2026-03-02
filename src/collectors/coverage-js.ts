import { baseDocument } from "../normalize.js";
import type { CommonMetadata, CoverageJsMetricDocument, Language } from "../types.js";
import { isRecord } from "../utils/guards.js";
import { ratioPct } from "../utils/metrics.js";

interface Totals {
	linesTotal: number;
	linesCovered: number;
	branchesTotal: number;
	branchesCovered: number;
	functionsTotal: number;
	functionsCovered: number;
}

function numberOrZero(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function fromCoverageSummary(input: Record<string, unknown>): Totals | null {
	const totalUnknown: unknown = input.total;
	if (!isRecord(totalUnknown)) {
		return null;
	}
	const totalRecord = totalUnknown;

	function readMetric(key: string): { total: number; covered: number } {
		const metricUnknown = totalRecord[key];
		if (!isRecord(metricUnknown)) {
			return { total: 0, covered: 0 };
		}

		return {
			total: numberOrZero(metricUnknown.total),
			covered: numberOrZero(metricUnknown.covered),
		};
	}

	const lines = readMetric("lines");
	const branches = readMetric("branches");
	const functions = readMetric("functions");

	return {
		linesTotal: lines.total,
		linesCovered: lines.covered,
		branchesTotal: branches.total,
		branchesCovered: branches.covered,
		functionsTotal: functions.total,
		functionsCovered: functions.covered,
	};
}

function fromCoverageFinal(input: Record<string, unknown>): Totals {
	let linesTotal = 0;
	let linesCovered = 0;
	let branchesTotal = 0;
	let branchesCovered = 0;
	let functionsTotal = 0;
	let functionsCovered = 0;

	for (const value of Object.values(input)) {
		if (!isRecord(value)) {
			continue;
		}

		const statements = value.s;
		if (isRecord(statements)) {
			for (const hits of Object.values(statements)) {
				linesTotal += 1;
				if (numberOrZero(hits) > 0) {
					linesCovered += 1;
				}
			}
		}

		const branches = value.b;
		if (isRecord(branches)) {
			for (const branchHits of Object.values(branches)) {
				if (Array.isArray(branchHits)) {
					for (const hit of branchHits) {
						branchesTotal += 1;
						if (numberOrZero(hit) > 0) {
							branchesCovered += 1;
						}
					}
				}
			}
		}

		const functions = value.f;
		if (isRecord(functions)) {
			for (const hits of Object.values(functions)) {
				functionsTotal += 1;
				if (numberOrZero(hits) > 0) {
					functionsCovered += 1;
				}
			}
		}
	}

	return {
		linesTotal,
		linesCovered,
		branchesTotal,
		branchesCovered,
		functionsTotal,
		functionsCovered,
	};
}

export interface CoverageJsCollectorOptions {
	tool?: string | undefined;
	languages?: Language[] | undefined;
}

const TS_EXTENSIONS = /\.tsx?$/;
const JS_EXTENSIONS = /\.jsx?$/;

export function detectCoverageLanguages(fileKeys: string[]): Language[] {
	const langs = new Set<Language>();
	for (const key of fileKeys) {
		if (TS_EXTENSIONS.test(key)) {
			langs.add("ts");
		}
		if (JS_EXTENSIONS.test(key)) {
			langs.add("js");
		}
	}
	return langs.size > 0 ? [...langs] : ["js"];
}

export function collectCoverageJs(
	input: unknown,
	metadata: CommonMetadata,
	options?: CoverageJsCollectorOptions,
): CoverageJsMetricDocument[] {
	if (!isRecord(input)) {
		throw new Error("Coverage JSON input must be an object");
	}

	const fromSummary = fromCoverageSummary(input);
	const totals = fromSummary ?? fromCoverageFinal(input);

	// coverage-final format has file paths as keys (excluding "total" from summary format)
	const fileKeys = Object.keys(input).filter((k) => k !== "total");
	const languages = options?.languages ?? detectCoverageLanguages(fileKeys);

	const doc: CoverageJsMetricDocument = {
		...baseDocument({
			metricType: "coverage-js",
			tool: options?.tool ?? "istanbul",
			languages,
			metadata,
		}),
		lines_total: totals.linesTotal,
		lines_covered: totals.linesCovered,
		lines_pct: ratioPct(totals.linesCovered, totals.linesTotal),
		branches_total: totals.branchesTotal,
		branches_covered: totals.branchesCovered,
		branches_pct: ratioPct(totals.branchesCovered, totals.branchesTotal),
		functions_total: totals.functionsTotal,
		functions_covered: totals.functionsCovered,
		functions_pct: ratioPct(totals.functionsCovered, totals.functionsTotal),
	};

	return [doc];
}
