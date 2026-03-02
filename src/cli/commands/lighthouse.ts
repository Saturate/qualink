import { collectLighthouse } from "../../collectors/lighthouse.js";
import { CliError } from "../cli-error.js";
import { createCollectorCommand } from "../command-factory.js";
import { loadJsonInput } from "../load-input.js";

export const lighthouseCommand = createCollectorCommand({
	name: "lighthouse",
	description: "Collect Lighthouse metrics and relay them",
	extraArgs: {
		url: { type: "string" as const, required: true as const },
	},
	async collect(args, metadata) {
		const url = args.url;
		if (typeof url !== "string" || url.length === 0) {
			throw new CliError("Missing required value: url", 2);
		}
		const input = await loadJsonInput(args);
		const documents = collectLighthouse(input, metadata, url);
		return { metricType: "lighthouse", documents };
	},
});
