import { collectJunit } from "../../collectors/junit.js";
import { createCollectorCommand } from "../command-factory.js";
import { loadTextInput } from "../load-input.js";

export const junitCommand = createCollectorCommand({
	name: "junit",
	description: "Collect JUnit XML test results and relay them",
	async collect(args, metadata) {
		const input = await loadTextInput(args);
		const documents = collectJunit(input, metadata);
		return { metricType: "junit", documents };
	},
});
