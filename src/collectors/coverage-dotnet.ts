import { XMLParser } from "fast-xml-parser";
import { baseDocument } from "../normalize.js";
import type { CommonMetadata, DotnetCoverageMetricDocument } from "../types.js";
import { isRecord } from "../utils/guards.js";
import { ratioPct } from "../utils/metrics.js";

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

function parseCobertura(root: Record<string, unknown>): {
	linesTotal: number;
	linesCovered: number;
	branchesTotal: number;
	branchesCovered: number;
} {
	const linesTotal = readNumber(root, "@_lines-valid");
	const linesCovered = readNumber(root, "@_lines-covered");
	const branchesTotal = readNumber(root, "@_branches-valid");
	const branchesCovered = readNumber(root, "@_branches-covered");

	return { linesTotal, linesCovered, branchesTotal, branchesCovered };
}

function parseOpenCover(root: Record<string, unknown>): {
	linesTotal: number;
	linesCovered: number;
	branchesTotal: number;
	branchesCovered: number;
} {
	const summary = root.Summary;
	if (!isRecord(summary)) {
		return {
			linesTotal: 0,
			linesCovered: 0,
			branchesTotal: 0,
			branchesCovered: 0,
		};
	}

	return {
		linesTotal: readNumber(summary, "@_numSequencePoints"),
		linesCovered: readNumber(summary, "@_visitedSequencePoints"),
		branchesTotal: readNumber(summary, "@_numBranchPoints"),
		branchesCovered: readNumber(summary, "@_visitedBranchPoints"),
	};
}

export function collectCoverageDotnet(
	xmlInput: string,
	metadata: CommonMetadata,
): DotnetCoverageMetricDocument[] {
	const parser = new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: "@_",
		parseAttributeValue: true,
	});

	const parsed = parser.parse(xmlInput) as unknown;
	if (!isRecord(parsed)) {
		throw new Error("Coverage XML could not be parsed");
	}

	let coverageFormat: "cobertura" | "opencover" = "cobertura";
	let linesTotal = 0;
	let linesCovered = 0;
	let branchesTotal = 0;
	let branchesCovered = 0;

	if (isRecord(parsed.coverage)) {
		const totals = parseCobertura(parsed.coverage);
		linesTotal = totals.linesTotal;
		linesCovered = totals.linesCovered;
		branchesTotal = totals.branchesTotal;
		branchesCovered = totals.branchesCovered;
	} else if (isRecord(parsed.CoverageSession)) {
		coverageFormat = "opencover";
		const totals = parseOpenCover(parsed.CoverageSession);
		linesTotal = totals.linesTotal;
		linesCovered = totals.linesCovered;
		branchesTotal = totals.branchesTotal;
		branchesCovered = totals.branchesCovered;
	} else {
		throw new Error("Unsupported coverage XML format. Expected Cobertura or OpenCover");
	}

	const functionsTotal = 0;
	const functionsCovered = 0;

	const doc: DotnetCoverageMetricDocument = {
		...baseDocument({
			metricType: "coverage-dotnet",
			tool: "dotnet-test",
			languages: ["csharp"],
			metadata,
		}),
		coverage_format: coverageFormat,
		lines_total: linesTotal,
		lines_covered: linesCovered,
		lines_pct: ratioPct(linesCovered, linesTotal),
		branches_total: branchesTotal,
		branches_covered: branchesCovered,
		branches_pct: ratioPct(branchesCovered, branchesTotal),
		functions_total: functionsTotal,
		functions_covered: functionsCovered,
		functions_pct: ratioPct(functionsCovered, functionsTotal),
	};

	return [doc];
}
