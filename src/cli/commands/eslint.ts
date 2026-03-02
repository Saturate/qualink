import { collectEslint } from "../../collectors/eslint.js";
import { createCollectorCommand } from "../command-factory.js";
import { loadJsonInput } from "../load-input.js";
import { parseLanguages } from "../parse-languages.js";

function parseIntWithMin(value: unknown, fallback: number, min: number): number {
	if (typeof value === "number") {
		return value >= min ? Math.floor(value) : fallback;
	}
	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value);
		if (Number.isFinite(parsed) && parsed >= min) {
			return Math.floor(parsed);
		}
	}
	return fallback;
}

export const eslintCommand = createCollectorCommand({
	name: "eslint",
	description: "Collect ESLint metrics and relay them",
	extraArgs: {
		"include-rules": { type: "boolean" as const, default: true },
		"top-rules": { type: "string" as const, default: "25" },
		"include-all-files": { type: "boolean" as const, default: false },
		"top-files": { type: "string" as const, default: "0" },
		language: { type: "string" as const },
	},
	async collect(args, metadata) {
		const input = await loadJsonInput(args);
		const documents = collectEslint(input, metadata, {
			includeRules: (args.includeRules ?? args["include-rules"]) !== false,
			topRules: parseIntWithMin(args.topRules ?? args["top-rules"], 25, 1),
			includeAllFiles: (args.includeAllFiles ?? args["include-all-files"]) === true,
			topFiles: parseIntWithMin(args.topFiles ?? args["top-files"], 0, 0),
			languages: parseLanguages(args.language),
		});
		return { metricType: "eslint", documents };
	},
});
