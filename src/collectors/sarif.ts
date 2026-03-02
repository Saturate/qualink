import { baseDocument } from "../normalize.js";
import type { CommonMetadata, Language, SarifMetricDocument } from "../types.js";
import { isRecord } from "../utils/guards.js";

function levelKey(level: string): "errors" | "warnings" | "notes" {
	if (level === "error") {
		return "errors";
	}

	if (level === "warning") {
		return "warnings";
	}

	return "notes";
}

export interface SarifCollectorOptions {
	includeRules: boolean;
	topRules: number;
	languages?: Language[] | undefined;
}

const TOOL_LANGUAGE_MAP: Record<string, Language[]> = {
	roslyn: ["csharp"],
	"microsoft.codeanalysis": ["csharp"],
	eslint: ["ts"],
	semgrep: ["unknown"],
	codeql: ["unknown"],
};

export function detectLanguagesFromTool(toolName: string): Language[] {
	const lower = toolName.toLowerCase();
	for (const [key, langs] of Object.entries(TOOL_LANGUAGE_MAP)) {
		if (lower.includes(key)) {
			return langs;
		}
	}
	return ["unknown"];
}

export function collectSarif(
	input: unknown,
	metadata: CommonMetadata,
	options: SarifCollectorOptions,
): SarifMetricDocument[] {
	if (!isRecord(input)) {
		throw new Error("SARIF input must be an object");
	}

	const runsRaw = input.runs;
	if (!Array.isArray(runsRaw) || runsRaw.length === 0) {
		throw new Error("SARIF input missing runs");
	}

	let errors = 0;
	let warnings = 0;
	let notes = 0;

	const rules = new Map<string, number>();
	let toolName: string | undefined;
	let toolVersion: string | undefined;

	for (const run of runsRaw) {
		if (!isRecord(run)) {
			continue;
		}

		if (!toolName) {
			const tool = run.tool;
			if (isRecord(tool)) {
				const driver = tool.driver;
				if (isRecord(driver)) {
					if (typeof driver.name === "string") {
						toolName = driver.name;
					}
					if (typeof driver.version === "string") {
						toolVersion = driver.version;
					}
				}
			}
		}

		const results = run.results;
		if (!Array.isArray(results)) {
			continue;
		}

		for (const result of results) {
			if (!isRecord(result)) {
				continue;
			}

			const level = typeof result.level === "string" ? result.level : "note";
			const key = levelKey(level);
			if (key === "errors") {
				errors += 1;
			} else if (key === "warnings") {
				warnings += 1;
			} else {
				notes += 1;
			}

			const ruleId = result.ruleId;
			if (typeof ruleId === "string" && ruleId.length > 0) {
				const existing = rules.get(ruleId) ?? 0;
				rules.set(ruleId, existing + 1);
			}
		}
	}

	const languages = options.languages ?? detectLanguagesFromTool(toolName ?? "");

	const doc: SarifMetricDocument = {
		...baseDocument({
			metricType: "sarif",
			tool: toolName ?? "sarif",
			languages,
			metadata,
		}),
		errors,
		warnings,
		notes,
	};

	if (toolName) {
		doc.tool_name = toolName;
	}

	if (toolVersion) {
		doc.tool_version = toolVersion;
	}

	if (options.includeRules) {
		const sortedRules = [...rules.entries()].sort((a, b) => b[1] - a[1]);
		const slice = options.topRules > 0 ? sortedRules.slice(0, options.topRules) : sortedRules;
		doc.rules_violated = Object.fromEntries(slice);
	}

	return [doc];
}
