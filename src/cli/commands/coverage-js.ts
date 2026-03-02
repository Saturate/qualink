import { collectCoverageJs } from "../../collectors/coverage-js.js";
import { createCollectorCommand } from "../command-factory.js";
import { loadJsonInput } from "../load-input.js";
import { parseLanguages } from "../parse-languages.js";

export const coverageJsCommand = createCollectorCommand({
	name: "coverage-js",
	description: "Collect JS coverage metrics and relay them",
	extraArgs: {
		language: { type: "string" as const },
		"tool-name": { type: "string" as const },
	},
	async collect(args, metadata) {
		const input = await loadJsonInput(args);
		const toolName = args["tool-name"];
		const documents = collectCoverageJs(input, metadata, {
			languages: parseLanguages(args.language),
			tool: typeof toolName === "string" && toolName.length > 0 ? toolName : undefined,
		});
		return { metricType: "coverage-js", documents };
	},
});
