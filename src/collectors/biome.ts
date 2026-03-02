import { baseDocument } from "../normalize.js";
import type { BiomeFileIssue, BiomeMetricDocument, CommonMetadata, Language } from "../types.js";
import { isRecord } from "../utils/guards.js";

interface BiomeDiagnostic {
	code: { value: string } | null;
	location: { path: string };
	severity: string;
	fixable: boolean;
}

function asBiomeDiagnostics(input: unknown): BiomeDiagnostic[] {
	if (!isRecord(input)) {
		throw new Error("Biome input must be an object with a diagnostics array");
	}

	const raw = input.diagnostics;
	if (!Array.isArray(raw)) {
		throw new Error("Biome input must be an object with a diagnostics array");
	}

	return raw.map((entry) => {
		if (!isRecord(entry)) {
			throw new Error("Invalid Biome diagnostic entry");
		}

		const code =
			isRecord(entry.code) && typeof entry.code.value === "string"
				? { value: entry.code.value }
				: null;

		const location =
			isRecord(entry.location) && typeof entry.location.path === "string"
				? { path: entry.location.path }
				: { path: "unknown" };

		const severity = typeof entry.severity === "string" ? entry.severity : "warning";
		const fixable = entry.fixable === true;

		return { code, location, severity, fixable };
	});
}

export interface BiomeCollectorOptions {
	includeRules: boolean;
	topRules: number;
	includeAllFiles: boolean;
	topFiles: number;
	languages?: Language[] | undefined;
}

const EXTENSION_LANGUAGE: Record<string, Language> = {
	".ts": "ts",
	".tsx": "ts",
	".js": "js",
	".jsx": "js",
	".css": "css",
	".json": "json",
};

export function detectBiomeLanguages(diagnostics: BiomeDiagnostic[]): Language[] {
	const langs = new Set<Language>();

	for (const diag of diagnostics) {
		const path = diag.location.path;
		const dotIndex = path.lastIndexOf(".");
		if (dotIndex >= 0) {
			const ext = path.slice(dotIndex).toLowerCase();
			const lang = EXTENSION_LANGUAGE[ext];
			if (lang) {
				langs.add(lang);
			}
		}
	}

	return langs.size > 0 ? [...langs] : ["js"];
}

interface FileAccumulator {
	errors: number;
	warnings: number;
	fixable_errors: number;
	fixable_warnings: number;
}

export function collectBiome(
	input: unknown,
	metadata: CommonMetadata,
	options: BiomeCollectorOptions,
): BiomeMetricDocument[] {
	const diagnostics = asBiomeDiagnostics(input);

	let errors = 0;
	let warnings = 0;
	let fixableErrors = 0;
	let fixableWarnings = 0;

	const rules = new Map<string, number>();
	const fileMap = new Map<string, FileAccumulator>();

	for (const diag of diagnostics) {
		const isError = diag.severity === "error" || diag.severity === "fatal";
		const isWarning = diag.severity === "warning";

		if (isError) {
			errors += 1;
			if (diag.fixable) fixableErrors += 1;
		} else if (isWarning) {
			warnings += 1;
			if (diag.fixable) fixableWarnings += 1;
		}
		// "info" severity is ignored in counts, same as ESLint

		if (diag.code) {
			const existing = rules.get(diag.code.value) ?? 0;
			rules.set(diag.code.value, existing + 1);
		}

		const filePath = diag.location.path;
		let fileAcc = fileMap.get(filePath);
		if (!fileAcc) {
			fileAcc = { errors: 0, warnings: 0, fixable_errors: 0, fixable_warnings: 0 };
			fileMap.set(filePath, fileAcc);
		}
		if (isError) {
			fileAcc.errors += 1;
			if (diag.fixable) fileAcc.fixable_errors += 1;
		} else if (isWarning) {
			fileAcc.warnings += 1;
			if (diag.fixable) fileAcc.fixable_warnings += 1;
		}
	}

	const languages = options.languages ?? detectBiomeLanguages(diagnostics);

	const doc: BiomeMetricDocument = {
		...baseDocument({
			metricType: "biome",
			tool: "biome",
			languages,
			metadata,
		}),
		errors,
		warnings,
		fixable_errors: fixableErrors,
		fixable_warnings: fixableWarnings,
	};

	if (options.includeRules) {
		const sortedRules = [...rules.entries()].sort((a, b) => b[1] - a[1]);
		const slice = options.topRules > 0 ? sortedRules.slice(0, options.topRules) : sortedRules;
		doc.rules_violated = Object.fromEntries(slice);
	}

	const files: BiomeFileIssue[] = [...fileMap.entries()]
		.filter(([, acc]) => acc.errors > 0 || acc.warnings > 0)
		.map(([path, acc]) => ({
			path,
			errors: acc.errors,
			warnings: acc.warnings,
			fixable_errors: acc.fixable_errors,
			fixable_warnings: acc.fixable_warnings,
		}));

	if (files.length > 0 && (options.topFiles > 0 || options.includeAllFiles)) {
		const sortedFiles = [...files].sort((a, b) => {
			const aTotal = a.errors + a.warnings;
			const bTotal = b.errors + b.warnings;
			if (bTotal !== aTotal) return bTotal - aTotal;
			if (b.errors !== a.errors) return b.errors - a.errors;
			return a.path.localeCompare(b.path);
		});

		if (options.topFiles > 0) {
			doc.top_files = sortedFiles.slice(0, options.topFiles);
		}

		if (options.includeAllFiles) {
			doc.all_files = sortedFiles;
		}
	}

	return [doc];
}
