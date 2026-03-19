import { collectCoverageCobertura } from "../../collectors/coverage-cobertura.js";
import { createCollectorCommand } from "../command-factory.js";
import { loadTextInput } from "../load-input.js";

export const coverageCoberturaCommand = createCollectorCommand({
	name: "coverage-cobertura",
	description: "Collect Cobertura XML coverage metrics and relay them",
	async collect(args, metadata) {
		const input = await loadTextInput(args);
		const documents = collectCoverageCobertura(input, metadata);
		return { metricType: "coverage-cobertura", documents };
	},
});
