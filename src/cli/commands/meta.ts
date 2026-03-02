import { baseDocument } from "../../normalize.js";
import { createCollectorCommand } from "../command-factory.js";

export const metaCommand = createCollectorCommand({
	name: "meta",
	description: "Detect and display metadata for the current context",
	extraArgs: {
		input: { type: "string" as const },
		sink: { type: "string" as const, default: "stdout" },
	},
	async collect(_args, metadata) {
		const doc = baseDocument({
			metricType: "meta",
			tool: "qualink",
			languages: [],
			metadata,
		});
		return { metricType: "meta", documents: [doc] };
	},
});
