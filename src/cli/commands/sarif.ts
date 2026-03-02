import { collectSarif } from "../../collectors/sarif.js";
import { createCollectorCommand } from "../command-factory.js";
import { loadJsonInput, parseLanguages } from "../shared.js";

function parseTopRules(value: unknown): number {
	if (typeof value === "number") {
		return value;
	}
	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return 25;
}

export const sarifCommand = createCollectorCommand({
	name: "sarif",
	description: "Collect SARIF metrics and relay them",
	extraArgs: {
		"include-rules": { type: "boolean" as const, default: true },
		"top-rules": { type: "string" as const, default: "25" },
		language: { type: "string" as const },
	},
	async collect(args, metadata) {
		const input = await loadJsonInput(args);
		const documents = collectSarif(input, metadata, {
			includeRules: (args.includeRules ?? args["include-rules"]) !== false,
			topRules: parseTopRules(args.topRules ?? args["top-rules"]),
			languages: parseLanguages(args.language),
		});
		return { metricType: "sarif", documents };
	},
});
