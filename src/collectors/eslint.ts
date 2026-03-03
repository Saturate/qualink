import { baseDocument } from "../normalize.js";
import type { CommonMetadata, EslintFileIssue, EslintMetricDocument, Language } from "../types.js";
import { isRecord } from "../utils/guards.js";

interface EslintMessage {
	ruleId: string | null;
	severity?: number | undefined;
}

interface EslintFileResult {
	filePath: string;
	errorCount: number;
	warningCount: number;
	fixableErrorCount: number;
	fixableWarningCount: number;
	messages: EslintMessage[];
	suppressedMessages: EslintMessage[];
}

function asEslintResults(input: unknown): EslintFileResult[] {
	if (!Array.isArray(input)) {
		throw new Error("ESLint input must be an array");
	}

	return input.map((entry) => {
		if (!isRecord(entry)) {
			throw new Error("Invalid ESLint result entry");
		}

		const messagesRaw = entry.messages;
		if (!Array.isArray(messagesRaw)) {
			throw new Error("Invalid ESLint messages array");
		}

		const parseMessages = (raw: unknown[]): EslintMessage[] =>
			raw.map((message) => {
				if (!isRecord(message)) {
					return { ruleId: null };
				}
				const ruleValue = message.ruleId;
				const severity = typeof message.severity === "number" ? message.severity : undefined;
				if (typeof ruleValue !== "string" && ruleValue !== null) {
					return { ruleId: null, severity };
				}
				return { ruleId: ruleValue, severity };
			});

		const messages = parseMessages(messagesRaw);

		const suppressedRaw = entry.suppressedMessages;
		const suppressedMessages = Array.isArray(suppressedRaw) ? parseMessages(suppressedRaw) : [];

		return {
			filePath: typeof entry.filePath === "string" ? entry.filePath : "unknown",
			errorCount: typeof entry.errorCount === "number" ? entry.errorCount : 0,
			warningCount: typeof entry.warningCount === "number" ? entry.warningCount : 0,
			fixableErrorCount: typeof entry.fixableErrorCount === "number" ? entry.fixableErrorCount : 0,
			fixableWarningCount:
				typeof entry.fixableWarningCount === "number" ? entry.fixableWarningCount : 0,
			messages,
			suppressedMessages,
		};
	});
}

export interface EslintCollectorOptions {
	includeRules: boolean;
	topRules: number;
	includeAllFiles: boolean;
	topFiles: number;
	languages?: Language[] | undefined;
}

const TS_EXTENSIONS = /\.tsx?$/;
const JS_EXTENSIONS = /\.jsx?$/;
const TS_RULE_PREFIX = "@typescript-eslint/";

export function detectEslintLanguages(rows: EslintFileResult[]): Language[] {
	const langs = new Set<Language>();

	for (const row of rows) {
		if (TS_EXTENSIONS.test(row.filePath)) {
			langs.add("ts");
		}
		if (JS_EXTENSIONS.test(row.filePath)) {
			langs.add("js");
		}
		for (const msg of row.messages) {
			if (msg.ruleId?.startsWith(TS_RULE_PREFIX)) {
				langs.add("ts");
			}
		}
	}

	return langs.size > 0 ? [...langs] : ["js"];
}

export function collectEslint(
	input: unknown,
	metadata: CommonMetadata,
	options: EslintCollectorOptions,
): EslintMetricDocument[] {
	const rows = asEslintResults(input);

	let errors = 0;
	let warnings = 0;
	let fixableErrors = 0;
	let fixableWarnings = 0;
	let suppressedErrors = 0;
	let suppressedWarnings = 0;

	const rules = new Map<string, number>();
	const suppressedRules = new Map<string, number>();
	const files: EslintFileIssue[] = [];

	for (const row of rows) {
		errors += row.errorCount;
		warnings += row.warningCount;
		fixableErrors += row.fixableErrorCount;
		fixableWarnings += row.fixableWarningCount;

		if (row.errorCount > 0 || row.warningCount > 0) {
			files.push({
				path: row.filePath,
				errors: row.errorCount,
				warnings: row.warningCount,
				fixable_errors: row.fixableErrorCount,
				fixable_warnings: row.fixableWarningCount,
			});
		}

		for (const message of row.messages) {
			if (!message.ruleId) {
				continue;
			}
			const existing = rules.get(message.ruleId) ?? 0;
			rules.set(message.ruleId, existing + 1);
		}

		for (const message of row.suppressedMessages) {
			// severity: 2 = error, 1 = warning
			if (message.severity === 2) {
				suppressedErrors++;
			} else {
				suppressedWarnings++;
			}
			if (!message.ruleId) {
				continue;
			}
			const existing = suppressedRules.get(message.ruleId) ?? 0;
			suppressedRules.set(message.ruleId, existing + 1);
		}
	}

	const languages = options.languages ?? detectEslintLanguages(rows);

	const doc: EslintMetricDocument = {
		...baseDocument({
			metricType: "eslint",
			tool: "eslint",
			languages,
			metadata,
		}),
		errors,
		warnings,
		fixable_errors: fixableErrors,
		fixable_warnings: fixableWarnings,
		suppressed_errors: suppressedErrors,
		suppressed_warnings: suppressedWarnings,
	};

	if (options.includeRules) {
		const sortedRules = [...rules.entries()].sort((a, b) => b[1] - a[1]);
		const slice = options.topRules > 0 ? sortedRules.slice(0, options.topRules) : sortedRules;
		doc.rules_violated = Object.fromEntries(slice);

		if (suppressedRules.size > 0) {
			const sortedSuppressed = [...suppressedRules.entries()].sort((a, b) => b[1] - a[1]);
			const suppressedSlice =
				options.topRules > 0 ? sortedSuppressed.slice(0, options.topRules) : sortedSuppressed;
			doc.suppressed_rules = Object.fromEntries(suppressedSlice);
		}
	}

	if (files.length > 0 && (options.topFiles > 0 || options.includeAllFiles)) {
		const sortedFiles = [...files].sort((a, b) => {
			const aTotal = a.errors + a.warnings;
			const bTotal = b.errors + b.warnings;
			if (bTotal !== aTotal) {
				return bTotal - aTotal;
			}
			if (b.errors !== a.errors) {
				return b.errors - a.errors;
			}
			return a.path.localeCompare(b.path);
		});

		if (options.topFiles > 0) {
			const topSlice = options.topFiles > 0 ? sortedFiles.slice(0, options.topFiles) : sortedFiles;
			doc.top_files = topSlice;
		}

		if (options.includeAllFiles) {
			doc.all_files = sortedFiles;
		}
	}

	return [doc];
}
